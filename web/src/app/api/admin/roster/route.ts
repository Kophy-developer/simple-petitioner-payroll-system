import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { deriveInitials, normalizeRoleLabel } from "@/lib/roster-import";
import type { UserRole } from "@/lib/types";

type RosterRow = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  initials?: string;
  role?: UserRole | string;
};

function tempPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(10);
  let out = "";
  for (let i = 0; i < 10; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function formatErr(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error && err.message && err.message !== "{}") return err.message;
  const e = err as Record<string, unknown>;
  for (const key of ["message", "msg", "error_description", "details", "hint", "error"]) {
    const value = e[key];
    if (typeof value === "string" && value.trim() && value !== "{}") return value;
  }
  try {
    const raw = JSON.stringify(err);
    if (raw && raw !== "{}") return raw;
  } catch {
    /* ignore */
  }
  return "Unknown error";
}

export async function POST(request: Request) {
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

  const body = (await request.json()) as { rows?: RosterRow[] };
  const rows = body.rows ?? [];
  if (!rows.length) {
    return NextResponse.json({ error: "No employee rows provided." }, { status: 400 });
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const created: {
    employeeId: string;
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
    phone?: string;
    tempPassword: string;
  }[] = [];
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const firstName = row.firstName?.trim() ?? "";
    const lastName = row.lastName?.trim() ?? "";
    const email = (row.email?.trim() ?? "").toLowerCase();
    const phone = row.phone?.trim() || null;
    let initials = (row.initials?.trim() || deriveInitials(firstName, lastName)).toUpperCase();
    const role = normalizeRoleLabel(String(row.role ?? "petitioner")) ?? "petitioner";

    if (!firstName || !lastName || !email || !email.includes("@")) {
      errors.push({
        row: i + 1,
        message: `First name, last name, and email are required (got "${firstName}" / "${lastName}" / "${email}").`,
      });
      continue;
    }

    let employeeId = "";
    try {
      const { data: allocated, error: allocErr } = await admin.rpc("allocate_employee_id", {
        p_first_name: firstName,
        p_last_name: lastName,
      });
      if (!allocErr && allocated) {
        employeeId = String(allocated);
      } else {
        const { data: nextId, error: nextErr } = await admin.rpc("next_employee_id");
        if (nextErr || nextId == null) throw nextErr ?? new Error("Could not allocate employee ID");
        employeeId = String(nextId);
      }
    } catch (e) {
      errors.push({
        row: i + 1,
        message: `Could not allocate employee ID: ${formatErr(e)}`,
      });
      continue;
    }

    const { data: taken } = await admin
      .from("profiles")
      .select("id")
      .eq("initials", initials)
      .maybeSingle();
    if (taken) {
      initials = `${initials}${employeeId.replace(/\D/g, "").slice(-2)}`.slice(0, 8);
    }

    const password = tempPassword();

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        initials,
        role,
      },
      app_metadata: { role },
    });

    if (error || !data.user) {
      errors.push({
        row: i + 1,
        message: `Could not create login for ${firstName} ${lastName}: ${formatErr(error)}`,
      });
      continue;
    }

    const { error: profileErr } = await admin
      .from("profiles")
      .update({
        first_name: firstName,
        last_name: lastName,
        initials,
        role,
        email,
        phone,
        employee_id: employeeId,
        status: "inactive",
        must_change_password: true,
        onboarding_complete: false,
        invite_sent_at: null,
      })
      .eq("id", data.user.id);

    if (profileErr) {
      errors.push({
        row: i + 1,
        message: `Account created but profile update failed for ${firstName} ${lastName}: ${formatErr(profileErr)}`,
      });
      continue;
    }

    await admin.auth.admin.updateUserById(data.user.id, {
      ban_duration: "876000h",
    });

    created.push({
      employeeId,
      firstName,
      lastName,
      email,
      role,
      phone: phone ?? undefined,
      tempPassword: password,
    });
  }

  return NextResponse.json({ created, errors });
}
