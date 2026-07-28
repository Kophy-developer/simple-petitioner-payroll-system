import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  const limited = rateLimit(`resolve-login:${ip}`, 30, 60_000);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((limited.retryAfterMs ?? 60_000) / 1000)),
        },
      },
    );
  }

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
