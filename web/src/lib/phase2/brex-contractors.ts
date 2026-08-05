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
  note: "Scaffolding only. Do not call live Brex payout APIs against production until Phase 1 testing sign-off and MFA gate are ready.",
} as const;

export function contractorPayoutStatusPayload() {
  return {
    ...contractorPaymentFlow,
    status: PHASE2_BREX_CONTRACTOR_PAYOUTS_LIVE ? "live" : "scaffolded_deferred",
  };
}
