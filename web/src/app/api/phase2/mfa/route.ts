import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mfaStatusPayload, roleRequiresMfa } from "@/lib/phase2/mfa";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role ?? "petitioner") as Parameters<typeof roleRequiresMfa>[0];
  return NextResponse.json({
    ...mfaStatusPayload(),
    viewerRequiresMfa: roleRequiresMfa(role),
    enroll: {
      available: false,
      message: "Authenticator enrollment UI is scaffolded; server MFA is deferred until Phase 1 testing sign-off.",
    },
  });
}

export async function POST() {
  return NextResponse.json(
    {
      error: "MFA enrollment is deferred. Droplet MFA must not be enabled while Phase 1 testing continues.",
    },
    { status: 503 },
  );
}
