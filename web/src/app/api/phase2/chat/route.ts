import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { secureChatStatusPayload } from "@/lib/phase2/secure-chat";
import { canMessageRole, canPostInChannel } from "@/lib/phase2/roles-and-chat-acl";
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
      postAnnouncement: canPostInChannel(role, "announcement"),
    },
  });
}

export async function POST() {
  return NextResponse.json(
    {
      error: "Secure chat is deferred. No messages are stored until dedicated infra is approved.",
    },
    { status: 503 },
  );
}
