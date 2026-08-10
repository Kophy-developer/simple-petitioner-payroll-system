"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SupabaseTotpEnrollPanel } from "@/components/phase2/supabase-totp-enroll-panel";
import { useDemoSession } from "@/lib/demo-session";
import { canAccessPhase2Console } from "@/lib/access";
import { roleRequiresMfa } from "@/lib/phase2/mfa";

type DryRunResult = {
  ok?: boolean;
  paymentScopesOk?: boolean;
  liveTransferSubmitted?: boolean;
  note?: string;
  error?: string;
  probes?: { path: string; ok: boolean; status: number; itemCount: number | null }[];
  sampleTransferPayload?: Record<string, unknown>;
};

export default function ContractorPayoutsPage() {
  const { user } = useDemoSession();
  const allowed = !!user && canAccessPhase2Console(user.role);
  const mfaOk = !!user && roleRequiresMfa(user.role);

  const [payeeName, setPayeeName] = useState("");
  const [amount, setAmount] = useState("100.00");
  const [memo, setMemo] = useState("Contractor advance (dry-run)");
  const [source, setSource] = useState<"advance" | "payroll" | "reimbursement" | "other">("advance");
  const [result, setResult] = useState<DryRunResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const draft = useMemo(
    () => ({
      payeeDisplayName: payeeName.trim() || "Unnamed payee",
      amountCents: Math.round(Number(amount || "0") * 100),
      currency: "USD" as const,
      memo: memo.trim(),
      source,
      mode: "dry_run" as const,
      requiresMfa: true as const,
    }),
    [payeeName, amount, memo, source],
  );

  useEffect(() => {
    if (!allowed) return;
  }, [allowed]);

  async function runDryRun() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/phase2/brex-contractors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "dry_run", draft }),
      });
      const payload = (await res.json()) as DryRunResult;
      if (!res.ok) {
        setError(payload.error || "Dry-run failed");
        return;
      }
      setResult(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dry-run failed");
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;
  if (!allowed) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Phase 2" title="Contractor payouts" description="Admins only." />
        <p className="text-sm text-danger">You do not have access to contractor payouts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Phase 2 · Brex"
        title="Contractor ACH payouts"
        description="Build a payout draft and validate Brex payment scopes. Live ACH stays off until Phase 1 sign-off and MFA enforcement."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl text-ink">Payout draft</h2>
              <Badge>dry-run</Badge>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payee">Payee display name</Label>
              <Input
                id="payee"
                value={payeeName}
                onChange={(e) => setPayeeName(e.target.value)}
                placeholder="Contractor name"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (USD)</Label>
                <Input
                  id="amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source">Source</Label>
                <select
                  id="source"
                  value={source}
                  onChange={(e) => setSource(e.target.value as typeof source)}
                  className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
                >
                  <option value="advance">Advance</option>
                  <option value="payroll">Payroll</option>
                  <option value="reimbursement">Reimbursement</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="memo">Memo</Label>
              <Input id="memo" value={memo} onChange={(e) => setMemo(e.target.value)} />
            </div>
            <Button type="button" disabled={busy || draft.amountCents <= 0} onClick={() => void runDryRun()}>
              {busy ? "Checking Brex…" : "Validate payment scopes (no ACH)"}
            </Button>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            {result ? (
              <div className="space-y-2 rounded-xl bg-ink/[0.04] p-4 text-sm text-ink/70">
                <p>
                  Scopes OK: {String(result.paymentScopesOk)} · ACH submitted:{" "}
                  {String(result.liveTransferSubmitted)}
                </p>
                <p>{result.note}</p>
                <ul className="list-disc space-y-1 pl-5">
                  {(result.probes ?? []).map((p) => (
                    <li key={p.path}>
                      {p.path} — {p.ok ? "ok" : "fail"} ({p.status}
                      {p.itemCount != null ? `, ${p.itemCount} items` : ""})
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-4">
            <h2 className="font-display text-xl text-ink">MFA step-up (required for live)</h2>
            <p className="text-sm text-ink/55">
              Live transfers will require authenticator step-up. Practice enroll/verify here; droplet AAL
              enforcement is still deferred.
            </p>
            <SupabaseTotpEnrollPanel allowed={mfaOk} purpose="brex_payment" />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
