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
  const requires = roleRequiresMfa(role);
  return NextResponse.json({
    ...mfaStatusPayload(),
    viewerRequiresMfa: requires,
    enroll: {
      available: true,
      ui: "/profile",
      adminConsole: "/phase2",
      payouts: "/brex/contractor-payouts",
      message:
        "Use Supabase Auth MFA TOTP (authenticator app). Enroll on Profile; practice payout step-up on contractor payouts. Droplet AAL enforcement remains deferred while Phase 1 testing continues.",
    },
  });
}

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Enroll via the browser Supabase MFA client (TOTP). Server-side force-enroll and AAL gates stay deferred on the droplet.",
      provider: "supabase_totp",
    },
    { status: 503 },
  );
}
