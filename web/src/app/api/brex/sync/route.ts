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

type BrexPage = {
  items?: BrexTxn[];
  next_cursor?: string | null;
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

async function fetchAllCardTransactions(token: string): Promise<{
  items: BrexTxn[];
  error?: string;
}> {
  const bases = [
    "https://api.brex.com/v2/transactions/card/primary",
    "https://platform.brexapis.com/v2/transactions/card/primary",
  ];

  let lastError = "";

  for (const base of bases) {
    const items: BrexTxn[] = [];
    let cursor: string | null = null;
    let pageOk = true;

    while (true) {
      const params = new URLSearchParams({ limit: "100" });
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(`${base}?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const text = await res.text();
        lastError = `Brex API error ${res.status}: ${text.slice(0, 300)}`;
        pageOk = false;
        break;
      }

      const payload = (await res.json()) as BrexPage;
      const batch = payload.items ?? [];
      items.push(...batch);
      cursor = payload.next_cursor ?? null;
      if (!cursor || batch.length === 0) break;
    }

    if (pageOk) return { items };
  }

  return { items: [], error: lastError || "Brex API request failed" };
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

  const { items, error: fetchError } = await fetchAllCardTransactions(token);
  if (fetchError) {
    return NextResponse.json({ error: fetchError }, { status: 502 });
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, first_name, last_name");

  let upserted = 0;
  const upsertErrors: { brex_id: string; message: string }[] = [];

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
    if (!error) {
      upserted += 1;
    } else {
      upsertErrors.push({ brex_id: txn.id, message: error.message });
    }
  }

  return NextResponse.json({
    ok: upsertErrors.length === 0,
    fetched: items.length,
    upserted,
    failed: upsertErrors.length,
    upsert_errors: upsertErrors.slice(0, 25),
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
