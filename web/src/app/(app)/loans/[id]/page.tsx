"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { loanStatusLabels } from "@/lib/demo-data";
import { useDemoSession } from "@/lib/demo-session";
import { canApproveLoans } from "@/lib/access";
import { roleLabel } from "@/lib/navigation";
import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  authUserId,
  getExpenseBalance,
  getLoan,
  getProfile,
  reviewLoan,
  type PayrollBalance,
} from "@/lib/api/live";
import { createPaymentEvent, listPaymentEvents, uploadPaymentReceipt } from "@/lib/api/remodel";
import type { DemoUser, LoanRequest, LoanStatus, PaymentEvent } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function statusTone(s: LoanStatus): "default" | "success" | "warning" | "danger" {
  if (s === "approved") return "success";
  if (s === "pending") return "warning";
  if (s === "rejected" || s === "auto_rejected") return "danger";
  return "default";
}

const emptyBalance: PayrollBalance = {
  totalPay: 0,
  totalUpfront: 0,
  totalHold: 0,
  totalExpenses: 0,
  liveBalance: 0,
};

export default function LoanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useDemoSession();
  const [request, setRequest] = useState<LoanRequest | null>(null);
  const [requester, setRequester] = useState<DemoUser | null>(null);
  const [reviewerName, setReviewerName] = useState("");
  const [balance, setBalance] = useState<PayrollBalance>(emptyBalance);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [paidEvent, setPaidEvent] = useState<PaymentEvent | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [fundsHitAt, setFundsHitAt] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const loan = await getLoan(id);
      if (!loan) {
        setRequest(null);
        return;
      }
      const isApprover = canApproveLoans(user.role);
      const isAdminPlus = user.role === "super_admin" || user.role === "account_admin";
      const canView = isApprover || isAdminPlus || loan.userId === authUserId(user);
      if (!canView) {
        setRequest(null);
        return;
      }
      setRequest(loan);
      const [profile, bal, events] = await Promise.all([
        getProfile(loan.userId),
        getExpenseBalance(loan.userId),
        listPaymentEvents(loan.userId),
      ]);
      setRequester(profile);
      setBalance(bal);
      setPaidEvent(events.find((e) => e.loanId === loan.id) ?? null);
      if (loan.reviewedBy) {
        const reviewer = await getProfile(loan.reviewedBy);
        setReviewerName(reviewer ? `${reviewer.firstName} ${reviewer.lastName}` : "");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load request.");
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user) return null;

  if (loading) {
    return <p className="py-16 text-center text-sm text-ink/55">Loading request…</p>;
  }

  if (!request) {
    return (
      <div className="space-y-4 py-16 text-center">
        <p className="text-ink/70">Advance request not found.</p>
        <Link href="/loans" className="text-sm text-civic-navy hover:underline">Back to loans</Link>
      </div>
    );
  }

  const isApprover = canApproveLoans(user.role);
  const isAdminPlus = user.role === "super_admin" || user.role === "account_admin";
  const canAct = isApprover && request.status === "pending";
  const exceedsHold = request.amount > request.holdSnapshot;
  const exceedsCurrentHold = request.amount > balance.totalHold;

  async function act(approve: boolean) {
    setActing(true);
    setError("");
    setMessage("");
    try {
      const updated = await reviewLoan(request!.id, approve);
      setRequest(updated);
      setMessage(approve ? "Advance approved." : "Advance rejected.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update request.");
    } finally {
      setActing(false);
    }
  }

  async function markPaid() {
    if (!request) return;
    setActing(true);
    setError("");
    setMessage("");
    try {
      let receiptPath: string | null = null;
      if (receiptFile) {
        receiptPath = await uploadPaymentReceipt(request.userId, receiptFile);
      }
      await createPaymentEvent({
        userId: request.userId,
        bucket: "loans_advances",
        eventType: "advances",
        amount: request.amount,
        notes: `Advance payment for loan ${request.id}`,
        receiptPath,
        fundsHitAt: fundsHitAt || null,
        loanId: request.id,
      });
      setMessage(
        receiptFile
          ? "Advance marked paid with receipt."
          : "Advance marked paid. Receipt can be uploaded later.",
      );
      setReceiptFile(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record payment.");
    } finally {
      setActing(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Payroll"
        title="Advance request"
        description="Review and act on this request."
        actions={
          <Link href="/loans" className="text-sm text-civic-navy hover:underline">
            Back to queue
          </Link>
        }
      />

      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={statusTone(request.status)}>{loanStatusLabels[request.status]}</Badge>
        <p className="text-sm text-ink/55">Submitted {formatDateTime(request.createdAt)}</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <h2 className="font-display text-xl text-ink">Request details</h2>
          </CardHeader>
          <CardBody className="space-y-6">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-[0.18em] text-ink/45">Requested amount</dt>
                <dd className="mt-1 font-display text-3xl tabular-nums text-civic-navy">
                  {formatCurrency(request.amount)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.18em] text-ink/45">Hold at request</dt>
                <dd className="mt-1 font-display text-3xl tabular-nums text-ink">
                  {formatCurrency(request.holdSnapshot)}
                </dd>
              </div>
            </dl>

            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Reason</p>
              <p className="mt-2 text-sm leading-relaxed text-ink/80">
                {request.note?.trim() || "No reason provided."}
              </p>
            </div>

            {exceedsHold || exceedsCurrentHold ? (
              <div className="rounded-xl bg-warning/15 px-4 py-3 text-sm text-ink/80">
                Hold shown for context only. Advances deduct from live balance and may go negative.
                {exceedsHold
                  ? " Requested amount exceeds the hold recorded at submission."
                  : " Requested amount exceeds current hold."}
              </div>
            ) : (
              <div className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
                Hold at submission covers this amount (context only — deduction is from live balance).
              </div>
            )}

            {request.reviewedAt ? (
              <p className="text-sm text-ink/55">
                Reviewed {formatDateTime(request.reviewedAt)}
                {reviewerName ? ` by ${reviewerName}` : ""}
              </p>
            ) : null}

            {canAct ? (
              <div className="flex flex-wrap gap-3 border-t border-ink/10 pt-5">
                <Button disabled={acting} onClick={() => void act(true)}>
                  {acting ? "Saving…" : "Approve advance"}
                </Button>
                <Button variant="ghost" disabled={acting} onClick={() => void act(false)}>
                  Reject
                </Button>
              </div>
            ) : null}

            {isAdminPlus && request.status === "approved" && !paidEvent ? (
              <div className="space-y-3 border-t border-ink/10 pt-5">
                <p className="text-sm text-ink/70">
                  Approved is not paid. Receipt and funds-hit date are optional and can be added later.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="loan-receipt">Receipt (optional)</Label>
                  <Input
                    id="loan-receipt"
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loan-funds-hit">Funds hit account</Label>
                  <Input
                    id="loan-funds-hit"
                    type="date"
                    value={fundsHitAt}
                    onChange={(e) => setFundsHitAt(e.target.value)}
                  />
                </div>
                <Button disabled={acting} onClick={() => void markPaid()}>
                  {acting ? "Saving…" : "Mark paid"}
                </Button>
              </div>
            ) : null}

            {paidEvent ? (
              <p className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
                Paid via payment event on {paidEvent.eventDate}
                {paidEvent.fundsHitAt ? ` · funds hit ${paidEvent.fundsHitAt}` : ""}.
              </p>
            ) : null}

            {message ? (
              <p className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">{message}</p>
            ) : null}
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="font-display text-xl text-ink">Requester</h2>
            </CardHeader>
            <CardBody className="space-y-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Name</p>
                <p className="mt-1 font-medium text-ink">
                  {requester ? `${requester.firstName} ${requester.lastName}` : "Unknown"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Email</p>
                <p className="mt-1 text-ink/80">{requester?.email ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Role</p>
                <p className="mt-1 text-ink/80">{requester ? roleLabel(requester.role) : "—"}</p>
              </div>
            </CardBody>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <StatCard label="Current hold" value={formatCurrency(balance.totalHold)} />
            <StatCard label="Live balance" value={formatCurrency(balance.liveBalance)} tone={balance.liveBalance < 0 ? "danger" : "default"} />
            <StatCard label="Total pay (YTD)" value={formatCurrency(balance.totalPay)} />
            <StatCard label="Expenses (YTD)" value={formatCurrency(balance.totalExpenses)} />
          </div>
        </div>
      </div>
    </div>
  );
}
