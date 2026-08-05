import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { phase2StatusPayload } from "@/lib/phase2";

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
  const role = profile?.role as string | undefined;
  if (role !== "super_admin" && role !== "account_admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { supabase, user, role };
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;
  return NextResponse.json(phase2StatusPayload());
}
