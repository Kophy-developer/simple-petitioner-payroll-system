"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { demoUsers, getIssue, getLedgerForUser } from "@/lib/demo-data";
import { useDemoSession } from "@/lib/demo-session";
import { visibleUserIds } from "@/lib/access";
import { payModelLabel } from "@/lib/payroll";
import { formatCurrency, formatPercent } from "@/lib/format";

function LedgerContent() {
  const { user } = useDemoSession();
  const params = useSearchParams();
  const queryUser = params.get("user");
  if (!user) return null;

  const allowed = visibleUserIds(user, demoUsers.map((u) => u.id));
  const selectedId = user.role === "petitioner" ? user.id : (queryUser && allowed.includes(queryUser) ? queryUser : allowed[0]);
  const subject = demoUsers.find((u) => u.id === selectedId);
  const rows = getLedgerForUser(selectedId);
  const grouped = rows.reduce<Record<string, typeof rows>>((acc, row) => { (acc[row.issueId] ??= []).push(row); return acc; }, {});

  const sectionTotals = (issueRows: typeof rows) => ({
    totalPay: issueRows.reduce((s, r) => s + (r.totalPay ?? 0), 0),
    upfront: issueRows.reduce((s, r) => s + (r.upfront ?? 0), 0),
    hold: issueRows.reduce((s, r) => s + (r.hold ?? 0), 0),
  });

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Payroll" title="Circulator Ledger" description="Issue-sectioned pay with pay model per drive."
        actions={user.role !== "petitioner" ? (
          <div className="w-56 space-y-2"><Label>User</Label><Select value={selectedId} onChange={(e) => { window.location.href = `/ledger?user=${e.target.value}`; }}>{demoUsers.filter((u) => allowed.includes(u.id)).map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}</Select></div>
        ) : null}
      />
      {subject ? <div className="flex items-center gap-3"><h2 className="font-display text-2xl text-ink">{subject.firstName} {subject.lastName}</h2><Badge tone="navy">{subject.initials}</Badge></div> : null}
      {Object.entries(grouped).map(([issueId, issueRows]) => {
        const issue = getIssue(issueId);
        const totals = sectionTotals(issueRows);
        return (
          <Card key={issueId}>
            <CardHeader className="flex flex-wrap items-center gap-3">
              <h3 className="font-display text-xl text-ink">{issue?.issueNumber}</h3>
              <span className="text-sm text-ink/55">{issue?.name}</span>
              <Badge>{payModelLabel(issueRows[0].payModel)}</Badge>
              {issueRows[0].validityPending ? <Badge tone="warning">Validity pending</Badge> : null}
            </CardHeader>
            <CardBody className="p-0">
              <DataTable>
                <thead><tr><Th align="right">SIGs</Th><Th align="right">Pay</Th><Th align="right">Est.</Th><Th align="right">DUPs</Th><Th align="right">Usable</Th><Th align="right">Valid</Th><Th align="right">Validity%</Th><Th align="right">Rate</Th><Th align="right">Payable</Th><Th align="right">Total</Th><Th align="right">Upfront</Th><Th align="right">Hold</Th></tr></thead>
                <tbody className="divide-y divide-ink/8 bg-white/50">
                  {issueRows.map((row) => (
                    <tr key={row.id}>
                      <Td align="right">{row.sigs}</Td><Td align="right">{formatCurrency(row.pay)}</Td><Td align="right">{formatCurrency(row.estimatedPay)}</Td>
                      <Td align="right">{row.dups ?? "—"}</Td><Td align="right">{row.usable ?? "—"}</Td><Td align="right">{row.valid ?? "—"}</Td>
                      <Td align="right">{formatPercent(row.validityPercent)}</Td><Td align="right">{formatCurrency(row.payRate)}</Td>
                      <Td align="right">{row.payable ?? "—"}</Td><Td align="right">{formatCurrency(row.totalPay)}</Td>
                      <Td align="right">{formatCurrency(row.upfront)}</Td><Td align="right">{formatCurrency(row.hold)}</Td>
                    </tr>
                  ))}
                  <tr className="bg-ink/[0.04] font-medium">
                    <Td highlight>Section total</Td>
                    <Td colSpan={8} />
                    <Td align="right" highlight>{formatCurrency(totals.totalPay)}</Td>
                    <Td align="right" highlight>{formatCurrency(totals.upfront)}</Td>
                    <Td align="right" highlight>{formatCurrency(totals.hold)}</Td>
                  </tr>
                </tbody>
              </DataTable>
            </CardBody>
          </Card>
        );
      })}
      <Link href="/directory" className="text-sm text-civic-navy hover:underline">Employee directory</Link>
    </div>
  );
}

export default function LedgerPage() {
  return <Suspense fallback={<div className="py-20 text-center">Loading ledger…</div>}><LedgerContent /></Suspense>;
}
