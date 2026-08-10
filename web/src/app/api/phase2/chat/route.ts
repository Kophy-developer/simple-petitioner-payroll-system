import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { secureChatStatusPayload } from "@/lib/phase2/secure-chat";
import {
  canMessageRole,
  canPostInChannel,
  canReactInChannel,
  type ChatChannelKind,
} from "@/lib/phase2/roles-and-chat-acl";
import type { UserRole } from "@/lib/types";

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
  const role = (profile?.role ?? "petitioner") as UserRole;

  return NextResponse.json({
    ...secureChatStatusPayload(),
    viewerRole: role,
    samples: {
      messageAdmin: canMessageRole(role, "super_admin"),
      messageField: canMessageRole(role, "petitioner"),
      postAnnouncement: canPostInChannel(role, "announcement"),
      reactAnnouncement: canReactInChannel(role, "announcement"),
      postTeam: canPostInChannel(role, "team"),
    },
  });
}

export async function POST(request: Request) {
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
  const role = (profile?.role ?? "petitioner") as UserRole;

  let body: { toRole?: UserRole; channel?: ChatChannelKind; body?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  if (body.channel) {
    const decision = canPostInChannel(role, body.channel);
    return NextResponse.json(
      {
        stored: false,
        acl: decision,
        error: "Secure chat is deferred. No messages are stored until dedicated infra is approved.",
      },
      { status: 503 },
    );
  }

  if (body.toRole) {
    const decision = canMessageRole(role, body.toRole);
    return NextResponse.json(
      {
        stored: false,
        acl: decision,
        error: "Secure chat is deferred. No messages are stored until dedicated infra is approved.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      error: "Secure chat is deferred. No messages are stored until dedicated infra is approved.",
    },
    { status: 503 },
  );
}
