"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { loanStatusLabels } from "@/lib/demo-data";
import { useDemoSession } from "@/lib/demo-session";
import { canApproveLoans, canRequestLoan } from "@/lib/access";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  authUserId,
  getExpenseBalance,
  getProfile,
  listLoans,
  requestLoan,
  type PayrollBalance,
} from "@/lib/api/live";
import type { LoanRequest } from "@/lib/types";

function statusTone(s: keyof typeof loanStatusLabels): "default" | "success" | "warning" | "danger" {
  if (s === "approved") return "success";
  if (s === "pending") return "warning";
  if (s === "rejected" || s === "auto_rejected") return "danger";
  return "default";
}

export default function LoansPage() {
  const { user } = useDemoSession();
  const [amount, setAmount] = useState("50");
  const [note, setNote] = useState("");
  const [declined, setDeclined] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [hold, setHold] = useState(0);
  const [rows, setRows] = useState<LoanRequest[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const isAdmin = user ? canApproveLoans(user.role) : false;
  const canRequest = user ? canRequestLoan(user.role) : false;

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const [loans, balance] = await Promise.all([
        listLoans(),
        getExpenseBalance(authUserId(user)).catch(() => ({ totalHold: 0 } as PayrollBalance)),
      ]);
      setRows(loans);
      setHold(balance.totalHold);

      if (isAdmin) {
        const unique = [...new Set(loans.map((l) => l.userId))];
        const entries = await Promise.all(
          unique.map(async (id) => {
            const profile = await getProfile(id);
            return [id, profile ? `${profile.firstName} ${profile.lastName}` : "Unknown"] as const;
          }),
        );
        setNames(Object.fromEntries(entries));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load loans.");
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user) return null;

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setDeclined(false);
    setSubmitted(false);
    try {
      const created = await requestLoan(parseFloat(amount), note);
      if (created.status === "auto_rejected") {
        setDeclined(true);
      } else {
        setSubmitted(true);
        setNote("");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit request.");
    } finally {
      setSaving(false);
    }
  }

  const visibleRows = canRequest ? rows.filter((l) => l.userId === authUserId(user)) : rows;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Payroll"
        title="Loans & Advances"
        description={isAdmin ? "Review loan and advance requests." : "Request a loan or advance."}
      />
      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
      {loading ? <p className="text-sm text-ink/55">Loading live loan data…</p> : null}

      {canRequest ? (
        <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
          <Card>
            <CardHeader><h2 className="font-display text-xl text-ink">New request</h2></CardHeader>
            <CardBody>
              <form onSubmit={submitRequest} className="space-y-4">
                <div className="rounded-2xl bg-civic-navy/8 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-ink/50">Available hold</p>
                  <p className="font-display text-3xl tabular-nums text-civic-navy">{formatCurrency(hold)}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loan-amount">Amount</Label>
                  <Input
                    id="loan-amount"
                    type="number"
                    min={1}
                    step="0.01"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setDeclined(false);
                      setSubmitted(false);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loan-note">Reason</Label>
                  <textarea
                    id="loan-note"
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Why do you need this advance?"
                    className="w-full rounded-xl border border-ink/15 bg-white/80 px-4 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink/40 focus:border-brass focus:ring-2 focus:ring-brass/20"
                  />
                </div>
                {declined ? (
                  <p className="rounded-xl bg-ink/5 px-4 py-3 text-sm text-ink/70">
                    You are not eligible for an advance at this time.
                  </p>
                ) : null}
                {submitted ? (
                  <p className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
                    Your request has been sent for approval.
                  </p>
                ) : null}
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? "Submitting…" : "Submit request"}
                </Button>
              </form>
            </CardBody>
          </Card>
          <Card>
            <CardHeader><h2 className="font-display text-xl text-ink">Your requests</h2></CardHeader>
            <CardBody className="p-0"><LoanTable rows={visibleRows} /></CardBody>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader><h2 className="font-display text-xl text-ink">Approval queue</h2></CardHeader>
          <CardBody className="p-0"><LoanTable rows={visibleRows} showUser names={names} admin /></CardBody>
        </Card>
      )}
    </div>
  );
}

function LoanTable({
  rows,
  showUser,
  admin,
  names = {},
}: {
  rows: LoanRequest[];
  showUser?: boolean;
  admin?: boolean;
  names?: Record<string, string>;
}) {
  return (
    <DataTable>
      <thead>
        <tr>
          <Th>Date</Th>
          {showUser ? <Th>User</Th> : null}
          <Th align="right">Amount</Th>
          <Th align="right">Hold snapshot</Th>
          <Th>Status</Th>
          <Th align="right">{admin ? "Review" : "Details"}</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-ink/8 bg-white/50">
        {rows.map((row) => (
          <tr key={row.id}>
            <Td>{formatDate(row.createdAt)}</Td>
            {showUser ? <Td>{names[row.userId] ?? "Unknown"}</Td> : null}
            <Td align="right">{formatCurrency(row.amount)}</Td>
            <Td align="right">{formatCurrency(row.holdSnapshot)}</Td>
            <Td><Badge tone={statusTone(row.status)}>{loanStatusLabels[row.status]}</Badge></Td>
            <Td align="right">
              <Link href={`/loans/${row.id}`} className="text-sm font-medium text-civic-navy hover:underline">
                {admin && row.status === "pending" ? "Review" : "View"}
              </Link>
            </Td>
          </tr>
        ))}
        {rows.length === 0 ? (
          <tr>
            <Td colSpan={showUser ? 6 : 5}>
              <p className="py-6 text-center text-sm text-ink/50">No loan requests yet.</p>
            </Td>
          </tr>
        ) : null}
      </tbody>
    </DataTable>
  );
}
