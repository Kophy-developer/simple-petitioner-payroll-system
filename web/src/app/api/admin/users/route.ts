import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { deriveInitials } from "@/lib/roster-import";
import type { UserRole, WageCurrency } from "@/lib/types";

type Body = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  initials?: string;
  phone?: string;
  role: UserRole;
  hourlyWage?: number | null;
  wageCurrency?: WageCurrency | null;
};

function tempPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(10);
  let out = "";
  for (let i = 0; i < 10; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
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

  const body = (await request.json()) as Body;
  if (body.role === "super_admin" && profile?.role !== "super_admin") {
    return NextResponse.json(
      { error: "Only super admin can create a super admin." },
      { status: 403 },
    );
  }
  const password = body.password?.trim() || tempPassword();
  if (!body.email?.trim() || password.length < 8) {
    return NextResponse.json(
      { error: "Email and a password of at least 8 characters are required." },
      { status: 400 },
    );
  }
  if (!body.firstName?.trim() || !body.lastName?.trim()) {
    return NextResponse.json({ error: "First and last name are required." }, { status: 400 });
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const initials = (
    body.initials?.trim() || deriveInitials(body.firstName, body.lastName)
  ).toUpperCase();

  const { data, error } = await admin.auth.admin.createUser({
    email: body.email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: {
      first_name: body.firstName.trim(),
      last_name: body.lastName.trim(),
      initials,
      role: body.role,
      wage_currency: body.wageCurrency ?? null,
      hourly_wage: body.hourlyWage ?? null,
    },
    app_metadata: {
      role: body.role,
      wage_currency: body.wageCurrency ?? null,
      hourly_wage: body.hourlyWage ?? null,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  let employeeId: string | null = null;
  {
    const { data: allocated } = await admin.rpc("allocate_employee_id", {
      p_first_name: body.firstName.trim(),
      p_last_name: body.lastName.trim(),
    });
    if (allocated) employeeId = String(allocated);
    else {
      const { data: nextId } = await admin.rpc("next_employee_id");
      if (nextId) employeeId = String(nextId);
    }
  }

  if (data.user) {
    await admin
      .from("profiles")
      .update({
        first_name: body.firstName.trim(),
        last_name: body.lastName.trim(),
        initials,
        role: body.role,
        phone: body.phone?.trim() || null,
        wage_currency: body.wageCurrency ?? null,
        hourly_wage: body.hourlyWage ?? null,
        status: "inactive",
        employee_id: employeeId,
        must_change_password: true,
        onboarding_complete: false,
        invite_sent_at: null,
      })
      .eq("id", data.user.id);

    await admin.auth.admin.updateUserById(data.user.id, {
      ban_duration: "876000h",
    });
  }

  return NextResponse.json({
    id: data.user?.id,
    email: data.user?.email,
    employeeId,
  });
}
