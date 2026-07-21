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
  return `${employeeId}@id.ballotaccesspros.internal`;
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
    const initials = (row.initials?.trim() ?? "").toUpperCase();
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
      errors.push({ row: i + 1, message: "First name, last name, and initials are required." });
      continue;
    }

    const { data: employeeId, error: idErr } = await admin.rpc("next_employee_id");
    if (idErr || !employeeId) {
      errors.push({ row: i + 1, message: idErr?.message ?? "Could not allocate employee ID." });
      continue;
    }

    const password = tempPassword();
    const email = provisionalEmail(String(employeeId));

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
      errors.push({ row: i + 1, message: error?.message ?? "Could not create auth user." });
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
        employee_id: String(employeeId),
        status: "active",
        must_change_password: true,
        onboarding_complete: false,
      })
      .eq("id", data.user.id);

    if (profileErr) {
      errors.push({ row: i + 1, message: profileErr.message });
      continue;
    }

    created.push({
      employeeId: String(employeeId),
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
