import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

type BrexTxn = {
  id: string;
  amount?: { amount?: number | string };
  posted_at_date?: string;
  purchased_at?: string;
  merchant?: { raw_descriptor?: string; name?: string };
  description?: string;
  card_id?: string;
};

async function requireAdmin() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "super_admin" && profile?.role !== "account_admin") {
    return { error: NextResponse.json({ error: "Not authorized" }, { status: 403 }) };
  }
  return { user };
}

function matchName(
  cardholder: string,
  profiles: { id: string; first_name: string; last_name: string }[],
) {
  const norm = cardholder.trim().toLowerCase().replace(/\s+/g, " ");
  if (!norm) return null;
  for (const p of profiles) {
    const full = `${p.first_name} ${p.last_name}`.trim().toLowerCase();
    const rev = `${p.last_name} ${p.first_name}`.trim().toLowerCase();
    if (norm === full || norm === rev || norm.includes(full) || full.includes(norm)) {
      return p.id;
    }
  }
  return null;
}

export async function POST() {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;

  const token = process.env.BREX_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "Set BREX_API_TOKEN in the server environment." },
      { status: 500 },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const res = await fetch("https://platform.brexapis.com/v2/transactions/card/primary", {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: `Brex API error ${res.status}: ${text.slice(0, 300)}` },
      { status: 502 },
    );
  }

  const payload = (await res.json()) as { items?: BrexTxn[] };
  const items = payload.items ?? [];

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, first_name, last_name");

  let upserted = 0;
  for (const txn of items) {
    const amountRaw = txn.amount?.amount;
    const amount =
      typeof amountRaw === "number"
        ? amountRaw / 100
        : Math.abs(Number(amountRaw) || 0) / (String(amountRaw).includes(".") ? 1 : 100);
    const cardholder = txn.merchant?.raw_descriptor || "";
    const merchant = txn.merchant?.name || txn.description || null;
    const occurred = txn.posted_at_date || txn.purchased_at || null;
    const matched = matchName(cardholder, profiles ?? []);

    const { error } = await admin.from("brex_transactions").upsert(
      {
        brex_id: txn.id,
        cardholder_name: cardholder || null,
        amount: Math.abs(amount),
        occurred_at: occurred,
        merchant_name: merchant,
        description: txn.description ?? null,
        matched_user_id: matched,
        raw: txn,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "brex_id" },
    );
    if (!error) upserted += 1;
  }

  return NextResponse.json({
    ok: true,
    fetched: items.length,
    upserted,
  });
}

export async function GET() {
  const gate = await requireAdmin();
  if (gate.error) return gate.error;
  return NextResponse.json({
    configured: !!process.env.BREX_API_TOKEN,
    endpoint: "/api/brex/sync",
  });
}
