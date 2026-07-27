import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { nameSimilarity, normalizePersonName } from "@/lib/name-similarity";

type Money = { amount?: number | string; currency?: string | null };

type BrexUser = {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
};

type BrexCard = {
  id: string;
  last_four?: string;
  owner?: { type?: string; user_id?: string };
};

type BrexExpense = {
  id: string;
  memo?: string | null;
  status?: string | null;
  payment_status?: string | null;
  purchased_at?: string | null;
  user_id?: string | null;
  user?: BrexUser | null;
  budget_id?: string | null;
  budget?: { id?: string; name?: string } | null;
  merchant?: { raw_descriptor?: string; name?: string } | null;
  original_amount?: Money | null;
  billing_amount?: Money | null;
  purchased_amount?: Money | null;
  usd_equivalent_amount?: Money | null;
  payment?: {
    id?: string;
    paymentInstrument?: { type?: string; id?: string } | null;
  } | null;
  receipts?: { id?: string }[] | null;
  card_transaction_reference_id?: string | null;
};

type BrexPage<T> = {
  items?: T[];
  next_cursor?: string | null;
};

type MatchMethod =
  | "email"
  | "card_owner_email"
  | "brex_user_id"
  | "name_exact"
  | "name_similar";

type ProfileRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  brex_user_id: string | null;
};

type MatchResult = {
  matchedUserId: string | null;
  matchMethod: MatchMethod | null;
  matchConfidence: number | null;
};

const HOSTS = ["https://api.brex.com", "https://platform.brexapis.com"] as const;

const EXCLUDED_EXPENSE_STATUSES = new Set([
  "CANCELED",
  "CANCELLED",
  "VOIDED",
  "DRAFT",
]);

const EXCLUDED_PAYMENT_STATUSES = new Set([
  "CANCELED",
  "CANCELLED",
  "DECLINED",
  "VOIDED",
]);

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

function normalizeEmail(value: string | null | undefined) {
  const email = (value ?? "").trim().toLowerCase();
  return email || null;
}

function normalizeStatus(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function isSuccessfulExpense(expense: BrexExpense) {
  const expenseStatus = normalizeStatus(expense.status);
  const paymentStatus = normalizeStatus(expense.payment_status);
  if (expenseStatus && EXCLUDED_EXPENSE_STATUSES.has(expenseStatus)) return false;
  if (paymentStatus && EXCLUDED_PAYMENT_STATUSES.has(paymentStatus)) return false;
  return true;
}

function moneyToDollars(money: Money | null | undefined) {
  const raw = money?.amount;
  if (raw === undefined || raw === null || raw === "") return 0;
  if (typeof raw === "number") return Math.abs(raw) / 100;
  const asString = String(raw);
  if (asString.includes(".")) return Math.abs(Number(asString) || 0);
  return Math.abs(Number(asString) || 0) / 100;
}

function exactOneProfileId(ids: string[] | undefined) {
  if (!ids || ids.length !== 1) return null;
  return ids[0];
}

function resolveNameMatch(
  brexFullName: string | null,
  profileNames: { id: string; fullName: string }[],
): MatchResult {
  if (!brexFullName) {
    return { matchedUserId: null, matchMethod: null, matchConfidence: null };
  }

  const candidates = profileNames
    .map((profile) => ({
      id: profile.id,
      score: nameSimilarity(brexFullName, profile.fullName),
    }))
    .filter((row) => row.score >= 0.8);

  if (candidates.length !== 1) {
    return { matchedUserId: null, matchMethod: null, matchConfidence: null };
  }

  const best = candidates[0];
  if (best.score === 1) {
    return {
      matchedUserId: best.id,
      matchMethod: "name_exact",
      matchConfidence: 1,
    };
  }

  return {
    matchedUserId: best.id,
    matchMethod: "name_similar",
    matchConfidence: Number(best.score.toFixed(3)),
  };
}

async function brexFetchJson<T>(
  token: string,
  pathAndQuery: string,
): Promise<{ data?: T; error?: string }> {
  let lastError = "";
  for (const host of HOSTS) {
    const res = await fetch(`${host}${pathAndQuery}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (res.ok) {
      return { data: (await res.json()) as T };
    }
    const text = await res.text();
    lastError = `Brex API error ${res.status}: ${text.slice(0, 300)}`;
    if (res.status !== 404 && res.status < 500) continue;
  }
  return { error: lastError || "Brex API request failed" };
}

async function paginateBrex<T>(
  token: string,
  path: string,
  buildQuery: (cursor: string | null) => URLSearchParams,
): Promise<{ items: T[]; error?: string }> {
  let lastError = "";

  for (const host of HOSTS) {
    const hostItems: T[] = [];
    let hostCursor: string | null = null;
    let pageOk = true;

    while (true) {
      const params = buildQuery(hostCursor);
      const res = await fetch(`${host}${path}?${params.toString()}`, {
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
      const payload = (await res.json()) as BrexPage<T>;
      const batch = payload.items ?? [];
      hostItems.push(...batch);
      hostCursor = payload.next_cursor ?? null;
      if (!hostCursor || batch.length === 0) break;
    }

    if (pageOk) return { items: hostItems };
  }

  return { items: [], error: lastError || "Brex API request failed" };
}

async function fetchAllExpenses(token: string) {
  return paginateBrex<BrexExpense>(token, "/v1/expenses", (cursor) => {
    const params = new URLSearchParams({ limit: "100" });
    for (const expand of ["merchant", "user", "budget", "payment", "receipts"] as const) {
      params.append("expand[]", expand);
    }
    if (cursor) params.set("cursor", cursor);
    return params;
  });
}

async function fetchAllUsers(token: string) {
  return paginateBrex<BrexUser>(token, "/v2/users", (cursor) => {
    const params = new URLSearchParams({ limit: "100" });
    if (cursor) params.set("cursor", cursor);
    return params;
  });
}

async function fetchCard(token: string, cardId: string, cache: Map<string, BrexCard | null>) {
  if (cache.has(cardId)) return cache.get(cardId) ?? null;
  const { data, error } = await brexFetchJson<BrexCard>(token, `/v2/cards/${encodeURIComponent(cardId)}`);
  if (error || !data) {
    cache.set(cardId, null);
    return null;
  }
  cache.set(cardId, data);
  return data;
}

function resolveMatch(params: {
  expenseUserId: string | null;
  expenseUserEmail: string | null;
  cardOwnerEmail: string | null;
  brexFullName: string | null;
  emailToProfileIds: Map<string, string[]>;
  brexUserIdToProfileIds: Map<string, string[]>;
  profileNames: { id: string; fullName: string }[];
}): MatchResult {
  const byExpenseEmail = exactOneProfileId(
    params.expenseUserEmail
      ? params.emailToProfileIds.get(params.expenseUserEmail)
      : undefined,
  );
  if (byExpenseEmail) {
    return { matchedUserId: byExpenseEmail, matchMethod: "email", matchConfidence: 1 };
  }

  const byCardOwnerEmail = exactOneProfileId(
    params.cardOwnerEmail
      ? params.emailToProfileIds.get(params.cardOwnerEmail)
      : undefined,
  );
  if (byCardOwnerEmail) {
    return {
      matchedUserId: byCardOwnerEmail,
      matchMethod: "card_owner_email",
      matchConfidence: 1,
    };
  }

  if (params.expenseUserId) {
    const byBrexId = exactOneProfileId(
      params.brexUserIdToProfileIds.get(params.expenseUserId),
    );
    if (byBrexId) {
      return { matchedUserId: byBrexId, matchMethod: "brex_user_id", matchConfidence: 1 };
    }
  }

  return resolveNameMatch(params.brexFullName, params.profileNames);
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

  const { items: expenses, error: expensesError } = await fetchAllExpenses(token);
  if (expensesError) {
    return NextResponse.json({ error: expensesError }, { status: 502 });
  }

  const { items: users, error: usersError } = await fetchAllUsers(token);
  if (usersError) {
    return NextResponse.json({ error: usersError }, { status: 502 });
  }

  const usersById = new Map<string, BrexUser>();
  for (const user of users) {
    if (user.id) usersById.set(user.id, user);
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, email, first_name, last_name, brex_user_id");
  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  const { data: disputedRows, error: disputedError } = await admin
    .from("brex_transactions")
    .select("brex_id, matched_user_id, match_method, match_confidence")
    .not("disputed_at", "is", null);
  if (disputedError) {
    return NextResponse.json({ error: disputedError.message }, { status: 500 });
  }

  const disputedByBrexId = new Map(
    ((disputedRows ?? []) as {
      brex_id: string;
      matched_user_id: string | null;
      match_method: MatchMethod | null;
      match_confidence: number | null;
    }[]).map((row) => [row.brex_id, row]),
  );

  const emailToProfileIds = new Map<string, string[]>();
  const brexUserIdToProfileIds = new Map<string, string[]>();
  const profileNames: { id: string; fullName: string }[] = [];
  for (const profile of (profiles ?? []) as ProfileRow[]) {
    const email = normalizeEmail(profile.email);
    if (email) {
      const existing = emailToProfileIds.get(email) ?? [];
      existing.push(profile.id);
      emailToProfileIds.set(email, existing);
    }
    const brexUserId = (profile.brex_user_id ?? "").trim();
    if (brexUserId) {
      const existing = brexUserIdToProfileIds.get(brexUserId) ?? [];
      existing.push(profile.id);
      brexUserIdToProfileIds.set(brexUserId, existing);
    }
    const fullName = normalizePersonName(profile.first_name, profile.last_name);
    if (fullName) profileNames.push({ id: profile.id, fullName });
  }

  const cardCache = new Map<string, BrexCard | null>();
  let upserted = 0;
  let matchedByEmail = 0;
  let matchedByCard = 0;
  let matchedByBrexId = 0;
  let matchedByNameExact = 0;
  let matchedByNameSimilar = 0;
  let skippedUnsuccessful = 0;
  let unmatched = 0;
  const upsertErrors: { brex_id: string; message: string }[] = [];

  for (const expense of expenses) {
    const expenseUserId = expense.user_id?.trim() || expense.user?.id?.trim() || null;
    const teamUser = expenseUserId ? usersById.get(expenseUserId) : undefined;
    const expenseUserEmail = normalizeEmail(teamUser?.email ?? expense.user?.email);

    const cardId = expense.payment?.paymentInstrument?.id?.trim() || null;
    let card: BrexCard | null = null;
    let cardOwnerEmail: string | null = null;
    if (cardId) {
      card = await fetchCard(token, cardId, cardCache);
      const ownerUserId = card?.owner?.user_id?.trim() || null;
      if (ownerUserId) {
        cardOwnerEmail = normalizeEmail(usersById.get(ownerUserId)?.email);
      }
    }

    const first = teamUser?.first_name?.trim() || expense.user?.first_name?.trim() || "";
    const last = teamUser?.last_name?.trim() || expense.user?.last_name?.trim() || "";
    const displayName = `${first} ${last}`.trim() || null;
    const brexFullName = normalizePersonName(first, last);

    const disputed = disputedByBrexId.get(expense.id);
    let matchedUserId: string | null = null;
    let matchMethod: MatchMethod | null = null;
    let matchConfidence: number | null = null;

    if (disputed) {
      matchedUserId = disputed.matched_user_id;
      matchMethod = disputed.match_method;
      matchConfidence = disputed.match_confidence;
    } else if (!isSuccessfulExpense(expense)) {
      skippedUnsuccessful += 1;
    } else {
      const match = resolveMatch({
        expenseUserId,
        expenseUserEmail,
        cardOwnerEmail,
        brexFullName,
        emailToProfileIds,
        brexUserIdToProfileIds,
        profileNames,
      });
      matchedUserId = match.matchedUserId;
      matchMethod = match.matchMethod;
      matchConfidence = match.matchConfidence;
    }

    if (!disputed) {
      if (matchMethod === "email") matchedByEmail += 1;
      else if (matchMethod === "card_owner_email") matchedByCard += 1;
      else if (matchMethod === "brex_user_id") matchedByBrexId += 1;
      else if (matchMethod === "name_exact") matchedByNameExact += 1;
      else if (matchMethod === "name_similar") matchedByNameSimilar += 1;
      else if (isSuccessfulExpense(expense)) unmatched += 1;
    }

    const amount = moneyToDollars(
      expense.billing_amount ??
        expense.usd_equivalent_amount ??
        expense.purchased_amount ??
        expense.original_amount,
    );
    const merchantRaw = expense.merchant?.raw_descriptor?.trim() || null;
    const merchantName = expense.merchant?.name?.trim() || merchantRaw;
    const receipts = expense.receipts ?? [];
    const budgetName = expense.budget?.name?.trim() || null;

    const { error } = await admin.from("brex_transactions").upsert(
      {
        brex_id: expense.id,
        cardholder_name: displayName,
        amount: Math.abs(amount),
        occurred_at: expense.purchased_at ?? null,
        merchant_name: merchantName,
        merchant_raw: merchantRaw,
        description: expense.memo ?? merchantRaw,
        memo: expense.memo ?? null,
        expense_status: expense.status ?? null,
        payment_status: expense.payment_status ?? null,
        budget_id: expense.budget_id ?? expense.budget?.id ?? null,
        budget_name: budgetName,
        assigned_to: budgetName,
        brex_user_id: expenseUserId,
        brex_user_email: expenseUserEmail,
        has_receipts: receipts.length > 0,
        receipt_count: receipts.length,
        card_id: cardId,
        card_last_four: card?.last_four ?? null,
        card_transaction_reference_id: expense.card_transaction_reference_id ?? null,
        matched_user_id: matchedUserId,
        match_method: matchMethod,
        match_confidence: matchConfidence,
        raw: expense,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "brex_id" },
    );

    if (!error) {
      upserted += 1;
    } else {
      upsertErrors.push({ brex_id: expense.id, message: error.message });
    }
  }

  return NextResponse.json({
    ok: upsertErrors.length === 0,
    fetched: expenses.length,
    upserted,
    matched_by_email: matchedByEmail,
    matched_by_card: matchedByCard,
    matched_by_brex_id: matchedByBrexId,
    matched_by_name_exact: matchedByNameExact,
    matched_by_name_similar: matchedByNameSimilar,
    skipped_unsuccessful: skippedUnsuccessful,
    unmatched,
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
