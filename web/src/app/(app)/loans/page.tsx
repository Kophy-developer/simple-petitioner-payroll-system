"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { getPayrollBalance, getUserName, loanRequests, loanStatusLabels } from "@/lib/demo-data";
import { useDemoSession } from "@/lib/demo-session";
import { canApproveLoans, canRequestLoan } from "@/lib/access";
import { formatCurrency, formatDate } from "@/lib/format";

function statusTone(s: keyof typeof loanStatusLabels): "default" | "success" | "warning" | "danger" {
  if (s === "approved") return "success";
  if (s === "pending") return "warning";
  if (s === "rejected" || s === "auto_rejected") return "danger";
  return "default";
}

export default function LoansPage() {
  const { user } = useDemoSession();
  const [amount, setAmount] = useState("50");
  const [ineligible, setIneligible] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  if (!user) return null;

  const hold = getPayrollBalance(user.id).totalHold;
  const myRequests = loanRequests.filter((l) => l.userId === user.id);
  const isAdmin = canApproveLoans(user.role);
  const canRequest = canRequestLoan(user.role);

  function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    const req = parseFloat(amount);
    if (req > hold) {
      setIneligible(true);
      setSubmitted(false);
      return;
    }
    setIneligible(false);
    setSubmitted(true);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Payroll"
        title="Loans & Advances"
        description={isAdmin ? "Review and approve advance requests." : "Request an advance against your hold reserve."}
      />
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
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    min={1}
                    step="0.01"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setIneligible(false);
                      setSubmitted(false);
                    }}
                  />
                </div>
                {ineligible ? (
                  <p className="rounded-xl bg-ink/5 px-4 py-3 text-sm text-ink/70">
                    You are not eligible for an advance at this time.
                  </p>
                ) : null}
                {submitted ? (
                  <p className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
                    Your request has been sent for approval.
                  </p>
                ) : null}
                <Button type="submit" className="w-full">Submit request</Button>
              </form>
            </CardBody>
          </Card>
          <Card>
            <CardHeader><h2 className="font-display text-xl text-ink">Your requests</h2></CardHeader>
            <CardBody className="p-0"><LoanTable rows={myRequests} /></CardBody>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader><h2 className="font-display text-xl text-ink">Approval queue</h2></CardHeader>
          <CardBody className="p-0"><LoanTable rows={loanRequests} showUser admin /></CardBody>
        </Card>
      )}
    </div>
  );
}

function LoanTable({ rows, showUser, admin }: { rows: typeof loanRequests; showUser?: boolean; admin?: boolean }) {
  return (
    <DataTable>
      <thead><tr><Th>Date</Th>{showUser ? <Th>User</Th> : null}<Th align="right">Amount</Th><Th align="right">Hold snapshot</Th><Th>Status</Th>{admin ? <Th align="right">Actions</Th> : null}</tr></thead>
      <tbody className="divide-y divide-ink/8 bg-white/50">
        {rows.map((row) => (
          <tr key={row.id}>
            <Td>{formatDate(row.createdAt)}</Td>
            {showUser ? <Td>{getUserName(row.userId)}</Td> : null}
            <Td align="right">{formatCurrency(row.amount)}</Td>
            <Td align="right">{formatCurrency(row.holdSnapshot)}</Td>
            <Td><Badge tone={statusTone(row.status)}>{loanStatusLabels[row.status]}</Badge></Td>
            {admin ? <Td align="right">{row.status === "pending" ? <div className="flex justify-end gap-2"><Button size="sm" variant="secondary">Approve</Button><Button size="sm" variant="ghost">Reject</Button></div> : "—"}</Td> : null}
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}
