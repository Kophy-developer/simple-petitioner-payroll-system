import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

type Body = {
  email: string;
  phone: string;
};

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const email = body.email?.trim().toLowerCase() ?? "";
    const phone = body.phone?.trim() ?? "";
    if (!email || !phone) {
      return NextResponse.json({ error: "Email and phone are required." }, { status: 400 });
    }

    const { data: profile, error: rpcError } = await supabase.rpc("complete_onboarding_contact", {
      p_email: email,
      p_phone: phone,
    });
    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 400 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (serviceKey && url) {
      const admin = createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error: authErr } = await admin.auth.admin.updateUserById(user.id, {
        email,
        email_confirm: true,
      });
      if (authErr) {
        return NextResponse.json(
          { error: `Profile saved, but auth email update failed: ${authErr.message}` },
          { status: 400 },
        );
      }
    }

    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save contact info." },
      { status: 500 },
    );
  }
}
