"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  circulators,
  getCirculator,
  getIssue,
  getLedgerForCirculator,
  ledgerRows,
} from "@/lib/demo-data";
import { useDemoSession } from "@/lib/demo-session";
import { formatCurrency, formatPercent } from "@/lib/format";

export default function LedgerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-pulse rounded-full bg-brass/40" />
        </div>
      }
    >
      <LedgerContent />
    </Suspense>
  );
}

function LedgerContent() {
  const { user } = useDemoSession();
  const searchParams = useSearchParams();
  const queryCirculator = searchParams.get("circulator");

  const selectedId = useMemo(() => {
    if (user?.role === "circulator" && user.circulatorId) {
      return user.circulatorId;
    }
    return queryCirculator ?? circulators[0].id;
  }, [user, queryCirculator]);

  const circulator = getCirculator(selectedId);
  const rows =
    user?.role === "circulator" && user.circulatorId
      ? getLedgerForCirculator(user.circulatorId)
      : ledgerRows.filter((r) => r.circulatorId === selectedId);

  const grouped = rows.reduce<Record<string, typeof rows>>((acc, row) => {
    const key = row.issueId;
    acc[key] = acc[key] ? [...acc[key], row] : [row];
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Payroll"
        title="Circulator Ledger"
        description="Issue-sectioned pay history with validity, payable signatures, and upfront/hold splits."
        actions={
          user?.role !== "circulator" ? (
            <div className="w-56 space-y-2">
              <Label htmlFor="circulator">Circulator</Label>
              <Select
                id="circulator"
                value={selectedId}
                onChange={(e) => {
                  window.location.href = `/ledger?circulator=${e.target.value}`;
                }}
              >
                {circulators.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </option>
                ))}
              </Select>
            </div>
          ) : null
        }
      />

      {circulator ? (
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-2xl text-ink">
            {circulator.firstName} {circulator.lastName}
          </h2>
          <Badge tone="navy">{circulator.initials}</Badge>
          {user?.role !== "circulator" ? (
            <Link
              href="/directory"
              className="text-sm text-civic-navy hover:underline"
            >
              Back to directory
            </Link>
          ) : null}
        </div>
      ) : null}

      {Object.entries(grouped).map(([issueId, issueRows]) => {
        const issue = getIssue(issueId);
        return (
          <Card key={issueId}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-display text-xl text-ink">
                  {issue?.issueNumber}
                </h3>
                <span className="text-sm text-ink/55">{issue?.name}</span>
                {issueRows[0]?.validityPending ? (
                  <Badge tone="warning">Validity pending</Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardBody className="p-0">
              <DataTable>
                <thead>
                  <tr>
                    <Th align="right">SIGs</Th>
                    <Th align="right">Pay</Th>
                    <Th align="right">Est. Pay</Th>
                    <Th align="right">DUPs</Th>
                    <Th align="right">Usable</Th>
                    <Th align="right">Valid</Th>
                    <Th align="right">Validity %</Th>
                    <Th align="right">Pay Rate</Th>
                    <Th align="right">Payable</Th>
                    <Th align="right">Total Pay</Th>
                    <Th align="right">Upfront</Th>
                    <Th align="right">Hold</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/8 bg-white/50">
                  {issueRows.map((row) => (
                    <tr key={row.id}>
                      <Td align="right">{row.sigs}</Td>
                      <Td align="right">{formatCurrency(row.pay)}</Td>
                      <Td align="right">{formatCurrency(row.estimatedPay)}</Td>
                      <Td align="right">{row.dups ?? "—"}</Td>
                      <Td align="right">{row.usable ?? "—"}</Td>
                      <Td align="right">{row.valid ?? "—"}</Td>
                      <Td align="right">
                        {formatPercent(row.validityPercent)}
                      </Td>
                      <Td align="right">{formatCurrency(row.payRate)}</Td>
                      <Td align="right">{row.payable ?? "—"}</Td>
                      <Td align="right">{formatCurrency(row.totalPay)}</Td>
                      <Td align="right">{formatCurrency(row.upfront)}</Td>
                      <Td align="right">{formatCurrency(row.hold)}</Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
