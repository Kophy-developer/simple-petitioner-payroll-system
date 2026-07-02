"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import {
  getCirculatorName,
  getPayrollSummary,
  loanRequests,
  loanStatusLabels,
} from "@/lib/demo-data";
import { useDemoSession } from "@/lib/demo-session";
import { formatCurrency, formatDate } from "@/lib/format";

function statusTone(
  status: keyof typeof loanStatusLabels,
): "default" | "success" | "warning" | "danger" {
  if (status === "approved") return "success";
  if (status === "pending") return "warning";
  if (status === "rejected" || status === "auto_rejected") return "danger";
  return "default";
}

export default function LoansPage() {
  const { user } = useDemoSession();
  const [amount, setAmount] = useState("50");
  const hold = user?.circulatorId
    ? getPayrollSummary(user.circulatorId).totalHold
    : 0;

  const visibleRequests =
    user?.role === "circulator" && user.circulatorId
      ? loanRequests.filter((l) => l.circulatorId === user.circulatorId)
      : loanRequests;

  const isSuperAdmin = user?.role === "super_admin";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Payroll"
        title="Loan / Advance Requests"
        description={
          isSuperAdmin
            ? "Review circulator advance requests against available hold balances."
            : "Request an advance against your hold reserve. Insufficient hold requests are declined automatically."
        }
      />

      {user?.role === "circulator" ? (
        <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
          <Card>
            <CardHeader>
              <h2 className="font-display text-xl text-ink">Request advance</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="rounded-2xl bg-civic-navy/8 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-ink/50">
                  Available hold
                </p>
                <p className="font-display text-3xl tabular-nums text-civic-navy">
                  {formatCurrency(hold)}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="loan-amount">Amount requested</Label>
                <Input
                  id="loan-amount"
                  type="number"
                  min={1}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <Button className="w-full">Submit request</Button>
              <p className="text-xs leading-6 text-ink/55">
                If hold is insufficient, the request is declined with no reason
                shown in v1.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-display text-xl text-ink">Your requests</h2>
            </CardHeader>
            <CardBody className="p-0">
              <RequestTable rows={visibleRequests} showCirculator={false} />
            </CardBody>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <h2 className="font-display text-xl text-ink">Approval queue</h2>
          </CardHeader>
          <CardBody className="p-0">
            <RequestTable rows={visibleRequests} showCirculator isAdmin />
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function RequestTable({
  rows,
  showCirculator,
  isAdmin,
}: {
  rows: typeof loanRequests;
  showCirculator: boolean;
  isAdmin?: boolean;
}) {
  return (
    <DataTable>
      <thead>
        <tr>
          <Th>Date</Th>
          {showCirculator ? <Th>Circulator</Th> : null}
          <Th align="right">Amount</Th>
          <Th align="right">Hold snapshot</Th>
          <Th>Status</Th>
          {isAdmin ? <Th align="right">Actions</Th> : null}
        </tr>
      </thead>
      <tbody className="divide-y divide-ink/8 bg-white/50">
        {rows.map((row) => (
          <tr key={row.id}>
            <Td>{formatDate(row.createdAt)}</Td>
            {showCirculator ? (
              <Td>{getCirculatorName(row.circulatorId)}</Td>
            ) : null}
            <Td align="right">{formatCurrency(row.amount)}</Td>
            <Td align="right">{formatCurrency(row.holdSnapshot)}</Td>
            <Td>
              <Badge tone={statusTone(row.status)}>
                {loanStatusLabels[row.status]}
              </Badge>
            </Td>
            {isAdmin ? (
              <Td align="right">
                {row.status === "pending" ? (
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="secondary">
                      Approve
                    </Button>
                    <Button size="sm" variant="ghost">
                      Reject
                    </Button>
                  </div>
                ) : (
                  "—"
                )}
              </Td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}
