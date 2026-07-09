"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardBody } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { demoUsers, expenseTypeLabels, getExpensesForUser, getPayrollBalance } from "@/lib/demo-data";
import { useDemoSession } from "@/lib/demo-session";
import { visibleUserIds } from "@/lib/access";
import { formatCurrency, formatDate } from "@/lib/format";

export default function PayrollPage() {
  const { user } = useDemoSession();
  const [selected, setSelected] = useState(user?.id ?? demoUsers[0].id);
  if (!user) return null;

  const allowed = visibleUserIds(user, demoUsers.map((u) => u.id));
  const userId = user.role === "petitioner" || user.role === "canvasser" ? user.id : selected;
  const balance = getPayrollBalance(userId);
  const expenses = getExpensesForUser(userId);
  const subject = demoUsers.find((u) => u.id === userId);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Payroll" title="Live Payroll & Expenses" description="Month-to-date pay, upfront, hold, and live balance."
        actions={
          <div className="flex flex-wrap gap-2">
            {user.role !== "petitioner" && user.role !== "canvasser" ? (
              <div className="w-48 space-y-2"><Label>User</Label><Select value={userId} onChange={(e) => setSelected(e.target.value)}>{demoUsers.filter((u) => allowed.includes(u.id)).map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}</Select></div>
            ) : null}
            <Link href="/payroll/expenses/new"><Button><Plus size={16} /> Add expense</Button></Link>
          </div>
        }
      />
      {subject ? <p className="text-sm text-ink/60">Viewing <span className="font-medium text-ink">{subject.firstName} {subject.lastName}</span></p> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total pay (MTD)" value={formatCurrency(balance.totalPay)} />
        <StatCard label="Total upfront (MTD)" value={formatCurrency(balance.totalUpfront)} />
        <StatCard label="Total hold (MTD)" value={formatCurrency(balance.totalHold)} />
        <StatCard label="Total expenses (MTD)" value={formatCurrency(balance.totalExpenses)} />
        <StatCard label="Live balance" value={formatCurrency(balance.liveBalance)} tone={balance.liveBalance < 0 ? "danger" : "success"} hint={balance.liveBalance < 0 ? "Super Admin alerted" : "Upfront − expenses"} />
      </div>
      {balance.liveBalance < 0 ? (
        <Card className="border-danger/30 bg-danger/8"><CardBody className="flex items-center gap-3"><Badge tone="danger">Negative balance</Badge><p className="text-sm text-danger">Expenses exceed upfront allocation this month.</p></CardBody></Card>
      ) : null}
      <Card>
        <CardBody className="p-0">
          <DataTable>
            <thead><tr><Th>Date</Th><Th>Type</Th><Th align="right">Amount</Th><Th>Receipt</Th></tr></thead>
            <tbody className="divide-y divide-ink/8 bg-white/50">
              {expenses.map((e) => (
                <tr key={e.id}><Td>{formatDate(e.date)}</Td><Td>{expenseTypeLabels[e.type]}</Td><Td align="right">{formatCurrency(e.amount)}</Td><Td className="text-civic-navy">{e.receiptName}</Td></tr>
              ))}
            </tbody>
          </DataTable>
        </CardBody>
      </Card>
      <Link href="/payroll/monthly" className="text-sm text-civic-navy hover:underline">Monthly payroll generation</Link>
    </div>
  );
}
