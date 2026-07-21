import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient as createServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

type RosterRow = {
  firstName: string;
  lastName: string;
  initials: string;
  role?: UserRole;
};

function tempPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(10);
  let out = "";
  for (let i = 0; i < 10; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function provisionalEmail(employeeId: string) {
  const from = process.env.EMAIL_FROM?.trim();
  const domain = from?.includes("@") ? from.split("@")[1] : null;
  if (domain) return `employee.${employeeId}@${domain}`;
  return `employee.${employeeId}@ballotaccesspros.com`;
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
    return NextResponse.json({ error: "No roster rows provided." }, { status: 400 });
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const created: {
    employeeId: string;
    firstName: string;
    lastName: string;
    initials: string;
    role: UserRole;
    tempPassword: string;
    email: string;
  }[] = [];
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const firstName = row.firstName?.trim() ?? "";
    const lastName = row.lastName?.trim() ?? "";
    let initials = (row.initials?.trim() ?? "").toUpperCase();
    const roleRaw = (row.role ?? "petitioner").toLowerCase();
    const allowed: UserRole[] = [
      "super_admin",
      "account_admin",
      "team_lead",
      "petitioner",
      "validator",
    ];
    const role: UserRole = allowed.includes(roleRaw as UserRole)
      ? (roleRaw as UserRole)
      : "petitioner";

    if (!firstName || !lastName || !initials) {
      errors.push({
        row: i + 1,
        message: `First name, last name, and initials are required (got "${firstName}" / "${lastName}" / "${initials}"). Check Excel headers: First Name, Last Name, Initials.`,
      });
      continue;
    }

    const { data: employeeIdRaw, error: idErr } = await admin.rpc("next_employee_id");
    if (idErr || employeeIdRaw == null || employeeIdRaw === "") {
      errors.push({
        row: i + 1,
        message: `Could not allocate employee ID: ${formatErr(idErr)}`,
      });
      continue;
    }
    const employeeId = String(employeeIdRaw);

    const { data: taken } = await admin
      .from("profiles")
      .select("id, first_name, last_name")
      .eq("initials", initials)
      .maybeSingle();
    if (taken) {
      initials = `${initials}${employeeId.slice(-2)}`.slice(0, 8);
    }

    const password = tempPassword();
    const email = provisionalEmail(employeeId);

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
        employee_id: employeeId,
        status: "active",
        must_change_password: true,
        onboarding_complete: false,
      })
      .eq("id", data.user.id);

    if (profileErr) {
      errors.push({
        row: i + 1,
        message: `Account created but profile update failed for ${firstName} ${lastName}: ${formatErr(profileErr)}`,
      });
      continue;
    }

    created.push({
      employeeId,
      firstName,
      lastName,
      initials,
      role,
      tempPassword: password,
      email,
    });
  }

  return NextResponse.json({ created, errors });
}
