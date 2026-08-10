import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { agoraEnvStatus, buildAgoraRtcToken } from "@/lib/phase2/agora";

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

export async function POST() {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const env = agoraEnvStatus();
  if (!env.configured) {
    return NextResponse.json(
      { ok: false, error: "Agora credentials are not configured." },
      { status: 503 },
    );
  }

  const channelName = `bap-sim-${Date.now().toString(36)}`;
  const publisher = buildAgoraRtcToken({
    channelName,
    uid: 1001,
    role: "publisher",
    expireSeconds: 600,
  });
  const subscriber = buildAgoraRtcToken({
    channelName,
    uid: 2002,
    role: "subscriber",
    expireSeconds: 600,
  });

  return NextResponse.json({
    ok: true,
    simulation: "token_pair",
    channelName,
    publisher: {
      uid: publisher.uid,
      role: publisher.role,
      expireAt: publisher.expireAt,
      tokenPrefix: publisher.token.slice(0, 12),
      tokenLength: publisher.token.length,
      looksValid: publisher.token.startsWith("007"),
    },
    subscriber: {
      uid: subscriber.uid,
      role: subscriber.role,
      expireAt: subscriber.expireAt,
      tokenPrefix: subscriber.token.slice(0, 12),
      tokenLength: subscriber.token.length,
      looksValid: subscriber.token.startsWith("007"),
    },
    appId: publisher.appId,
    note: "Credentials mint valid RTC tokens. Use /phase2/agora-lab to join a live voice/video channel in the browser.",
  });
}
