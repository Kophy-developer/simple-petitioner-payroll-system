import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAgoraRtcToken, agoraEnvStatus } from "@/lib/phase2/agora";

async function requireSignedIn() {
  if (process.env.AGORA_LAB_OPEN === "1" && process.env.NODE_ENV !== "production") {
    return { user: { id: "lab" } };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { user };
}

export async function GET(request: Request) {
  const auth = await requireSignedIn();
  if ("error" in auth && auth.error) return auth.error;

  const env = agoraEnvStatus();
  if (!env.configured) {
    return NextResponse.json({ error: "Agora credentials are not configured." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const channelName = (searchParams.get("channel") || "bap-phase2-sim").trim();
  const role = searchParams.get("role") === "subscriber" ? "subscriber" : "publisher";
  const uidParam = searchParams.get("uid");
  const uid = uidParam && /^\d+$/.test(uidParam) ? Number(uidParam) : uidParam || 0;

  try {
    const token = buildAgoraRtcToken({ channelName, uid, role });
    return NextResponse.json(token);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Token generation failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireSignedIn();
  if ("error" in auth && auth.error) return auth.error;

  const env = agoraEnvStatus();
  if (!env.configured) {
    return NextResponse.json({ error: "Agora credentials are not configured." }, { status: 503 });
  }

  let body: { channelName?: string; uid?: number | string; role?: string; expireSeconds?: number } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  try {
    const token = buildAgoraRtcToken({
      channelName: body.channelName || "bap-phase2-sim",
      uid: body.uid ?? 0,
      role: body.role === "subscriber" ? "subscriber" : "publisher",
      expireSeconds: body.expireSeconds,
    });
    return NextResponse.json(token);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Token generation failed" },
      { status: 500 },
    );
  }
}
