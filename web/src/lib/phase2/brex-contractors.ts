export const PHASE2_BREX_CONTRACTOR_PAYOUTS_LIVE = false;

export type ContractorPaymentStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "submitted"
  | "paid"
  | "failed"
  | "canceled";

export type ContractorPaymentDraft = {
  payeeUserId: string;
  amount: number;
  currency: "USD";
  memo: string;
  source: "advance" | "payroll" | "reimbursement" | "other";
  requiresMfa: true;
};

const HOSTS = ["https://api.brex.com", "https://platform.brexapis.com"] as const;

export const contractorPaymentFlow = {
  live: PHASE2_BREX_CONTRACTOR_PAYOUTS_LIVE,
  steps: [
    "Field or admin creates payment or advance request",
    "Admin/Super Admin reviews amount and payee",
    "Authenticator step-up (Phase 2 MFA) before submit",
    "Brex contractor/ACH payment API submit",
    "Persist status + audit; refresh payee balance",
  ],
  deferredServerWork: [
    "Brex contractor payment credentials and webhook endpoints",
    "Link loan_requests / advances to payout ids",
    "Idempotent submit keys",
  ],
  note: "Dry-run validates payment scopes (cash accounts, vendors, transfers list). Live ACH stays off until Phase 1 sign-off and MFA gate.",
} as const;

export function contractorPayoutStatusPayload() {
  return {
    ...contractorPaymentFlow,
    payoutMode: (process.env.BREX_PAYOUT_MODE || "dry_run").trim() || "dry_run",
    tokenConfigured: Boolean((process.env.BREX_API_TOKEN || "").trim()),
    status: PHASE2_BREX_CONTRACTOR_PAYOUTS_LIVE ? "live" : "dry_run_ready",
  };
}

type BrexProbe = {
  host: string;
  path: string;
  status: number;
  ok: boolean;
  itemCount: number | null;
  errorSnippet: string | null;
};

async function probeBrex(token: string, path: string): Promise<BrexProbe> {
  let last: BrexProbe = {
    host: HOSTS[0],
    path,
    status: 0,
    ok: false,
    itemCount: null,
    errorSnippet: "No response",
  };

  for (const host of HOSTS) {
    try {
      const res = await fetch(`${host}${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const text = await res.text();
      let itemCount: number | null = null;
      try {
        const json = JSON.parse(text) as { items?: unknown[] };
        if (Array.isArray(json.items)) itemCount = json.items.length;
      } catch {
        itemCount = null;
      }
      last = {
        host,
        path,
        status: res.status,
        ok: res.ok,
        itemCount,
        errorSnippet: res.ok ? null : text.slice(0, 220),
      };
      if (res.ok) return last;
      if (res.status !== 404 && res.status < 500) continue;
    } catch (e) {
      last = {
        host,
        path,
        status: 0,
        ok: false,
        itemCount: null,
        errorSnippet: e instanceof Error ? e.message : "fetch failed",
      };
    }
  }
  return last;
}

export async function runBrexPaymentDryRun() {
  const token = (process.env.BREX_API_TOKEN || "").trim();
  if (!token) {
    return {
      ok: false,
      mode: "dry_run" as const,
      error: "Set BREX_API_TOKEN in the server environment.",
      probes: [] as BrexProbe[],
    };
  }

  const probes = await Promise.all([
    probeBrex(token, "/v2/accounts/cash?limit=10"),
    probeBrex(token, "/v1/vendors?limit=10"),
    probeBrex(token, "/v1/transfers?limit=10"),
    probeBrex(token, "/v1/expenses?limit=1"),
  ]);

  const cash = probes[0];
  const vendors = probes[1];
  const transfers = probes[2];
  const expenses = probes[3];

  const paymentScopesOk = cash.ok && vendors.ok && transfers.ok;
  const sampleTransferPayload = {
    amount: { amount: 100, currency: "USD" },
    counterparty: {
      type: "VENDOR",
      payment_instrument_id: "pdinstl_DRY_RUN_PLACEHOLDER",
    },
    description: "BAP Phase 2 contractor payout dry-run (not submitted)",
    external_memo: "BAP dry-run",
    originating_account: {
      type: "BREX_CASH",
      id: "dpacc_DRY_RUN_PLACEHOLDER",
    },
  };

  return {
    ok: paymentScopesOk,
    mode: "dry_run" as const,
    liveTransferSubmitted: false,
    paymentScopesOk,
    expensesReadable: expenses.ok,
    probes: probes.map((p) => ({
      path: p.path,
      host: p.host,
      status: p.status,
      ok: p.ok,
      itemCount: p.itemCount,
      errorSnippet: p.errorSnippet,
    })),
    sampleTransferPayload,
    note: paymentScopesOk
      ? "Payment scopes work (cash + vendors + transfers list). No ACH was created."
      : "One or more payment endpoints failed. Check token scopes: accounts.cash.readonly, vendors, transfers.",
  };
}
