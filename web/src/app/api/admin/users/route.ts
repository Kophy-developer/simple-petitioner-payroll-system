import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import type { UserRole, WageCurrency } from "@/lib/types";

type Body = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  initials: string;
  role: UserRole;
  hourlyWage?: number | null;
  wageCurrency?: WageCurrency | null;
};

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

  if (profile?.role !== "super_admin") {
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
  if (!body.email?.trim() || !body.password || body.password.length < 8) {
    return NextResponse.json(
      { error: "Email and a password of at least 8 characters are required." },
      { status: 400 },
    );
  }
  if (!body.firstName?.trim() || !body.lastName?.trim() || !body.initials?.trim()) {
    return NextResponse.json({ error: "Name and initials are required." }, { status: 400 });
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.auth.admin.createUser({
    email: body.email.trim().toLowerCase(),
    password: body.password,
    email_confirm: true,
    user_metadata: {
      first_name: body.firstName.trim(),
      last_name: body.lastName.trim(),
      initials: body.initials.trim().toUpperCase(),
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
  const { data: nextId } = await admin.rpc("next_employee_id");
  if (nextId) employeeId = String(nextId);

  if (data.user) {
    await admin
      .from("profiles")
      .update({
        first_name: body.firstName.trim(),
        last_name: body.lastName.trim(),
        initials: body.initials.trim().toUpperCase(),
        role: body.role,
        wage_currency: body.wageCurrency ?? null,
        hourly_wage: body.hourlyWage ?? null,
        status: "active",
        employee_id: employeeId,
        must_change_password: true,
        onboarding_complete: true,
      })
      .eq("id", data.user.id);
  }

  return NextResponse.json({
    id: data.user?.id,
    email: data.user?.email,
    employeeId,
  });
}
