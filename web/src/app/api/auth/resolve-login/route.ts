import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  let identifier = "";
  try {
    const body = (await request.json()) as { identifier?: string };
    identifier = (body.identifier ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!identifier) {
    return NextResponse.json({ error: "No account found for that employee ID." }, { status: 404 });
  }

  if (identifier.includes("@")) {
    return NextResponse.json({ email: identifier.toLowerCase() });
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin
    .from("profiles")
    .select("email, status")
    .eq("employee_id", identifier)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Could not look up account." }, { status: 500 });
  }

  if (!data?.email || data.status === "offboarded") {
    return NextResponse.json({ error: "No account found for that employee ID." }, { status: 404 });
  }

  return NextResponse.json({ email: String(data.email).toLowerCase() });
}
