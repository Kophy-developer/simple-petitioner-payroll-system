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
    viewerRequiresLoginMfa: false,
    enroll: {
      available: true,
      ui: "/brex/contractor-payouts",
      adminConsole: "/phase2",
      payouts: "/brex/contractor-payouts",
      message:
        "Login 2FA is off. Authenticator enroll/step-up is only for Brex contractor payouts testing. Droplet AAL stays off.",
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
