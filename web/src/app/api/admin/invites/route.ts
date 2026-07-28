import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { INVITE_ENV_HINT, sendUserInviteEmail } from "@/lib/invite-email";

export async function POST() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "super_admin" && profile?.role !== "account_admin") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) {
    return NextResponse.json(
      { error: "Server is missing SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 },
    );
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: pending, error } = await admin
    .from("profiles")
    .select("id, email, first_name, last_name")
    .is("invite_sent_at", null)
    .neq("status", "offboarded");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const sent: string[] = [];
  const failures: { id: string; message: string }[] = [];
  const now = new Date().toISOString();
  let emailProvider: string | null = null;

  for (const row of pending ?? []) {
    try {
      const mail = await sendUserInviteEmail(admin, {
        email: row.email,
        firstName: row.first_name ?? "",
      });
      if (!mail.emailed) {
        failures.push({
          id: row.id,
          message: mail.message || `Invite email not sent. ${INVITE_ENV_HINT}`,
        });
        continue;
      }
      emailProvider = mail.provider;

      await admin.auth.admin.updateUserById(row.id, { ban_duration: "none" });
      const { error: updErr } = await admin
        .from("profiles")
        .update({
          invite_sent_at: now,
          status: "active",
          must_change_password: true,
        })
        .eq("id", row.id);
      if (updErr) throw updErr;
      sent.push(row.id);
    } catch (e) {
      failures.push({
        id: row.id,
        message: e instanceof Error ? e.message : "Failed to send invite",
      });
    }
  }

  const noteParts: string[] = [];
  if (sent.length) {
    noteParts.push(`Emailed and activated ${sent.length} account(s) via ${emailProvider ?? "mail"}.`);
  }
  if (failures.length) {
    noteParts.push(`${failures.length} invite(s) failed. ${INVITE_ENV_HINT}`);
  }
  if (!sent.length && !failures.length) {
    noteParts.push("No pending invites.");
  }

  return NextResponse.json({
    sent: sent.length,
    failures,
    emailProvider,
    note: noteParts.join(" "),
    envHint: INVITE_ENV_HINT,
  });
}
