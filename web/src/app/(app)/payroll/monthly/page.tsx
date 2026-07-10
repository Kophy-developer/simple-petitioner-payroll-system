"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardBody } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { getUserName, monthlyPayroll } from "@/lib/demo-data";
import { formatCurrency } from "@/lib/format";

export default function MonthlyPayrollPage() {
  const [month, setMonth] = useState("5");
  const [year, setYear] = useState("2026");

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Configuration" title="Monthly Payroll Generation" description="Preview, run, and lock monthly payroll records."
        actions={
          <div className="flex gap-3">
            <div className="space-y-2"><Label>Month</Label><Select value={month} onChange={(e) => setMonth(e.target.value)}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</Select></div>
            <div className="space-y-2"><Label>Year</Label><Select value={year} onChange={(e) => setYear(e.target.value)}><option>2026</option><option>2025</option></Select></div>
            <Button className="self-end">Run payroll</Button>
          </div>
        }
      />
      <Card><CardBody className="p-0">
        <DataTable>
          <thead><tr><Th>User</Th><Th align="right">Total pay</Th><Th align="right">Expenses</Th><Th align="right">Net payable</Th><Th align="right">Upfront paid</Th><Th align="right">Hold</Th><Th>Status</Th></tr></thead>
          <tbody className="divide-y divide-ink/8 bg-white/50">
            {monthlyPayroll.map((r) => (
              <tr key={r.id}>
                <Td>{getUserName(r.userId)}</Td>
                <Td align="right">{formatCurrency(r.totalPay)}</Td>
                <Td align="right">{formatCurrency(r.totalExpenses)}</Td>
                <Td align="right">{formatCurrency(r.netPayable)}</Td>
                <Td align="right">{formatCurrency(r.upfrontPaid)}</Td>
                <Td align="right">{formatCurrency(r.holdBalance)}</Td>
                <Td><Badge tone={r.status === "locked" ? "success" : "warning"}>{r.status}</Badge></Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </CardBody></Card>
      <p className="text-xs text-ink/50">Payment disbursement — Phase 2. Locked records are immutable.</p>
    </div>
  );
}
