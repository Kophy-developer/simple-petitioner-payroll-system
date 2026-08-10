import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  contractorPayoutStatusPayload,
  runBrexPaymentDryRun,
} from "@/lib/phase2/brex-contractors";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "super_admin" && profile?.role !== "account_admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true as const };
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;
  return NextResponse.json(contractorPayoutStatusPayload());
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  let mode = "dry_run";
  try {
    const body = (await request.json()) as { mode?: string };
    if (body.mode) mode = body.mode;
  } catch {
    mode = "dry_run";
  }

  if (mode !== "dry_run") {
    return NextResponse.json(
      {
        error:
          "Live Brex contractor payouts are deferred. Use mode dry_run only until Phase 1 testing sign-off and MFA step-up are ready.",
      },
      { status: 503 },
    );
  }

  const result = await runBrexPaymentDryRun();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
