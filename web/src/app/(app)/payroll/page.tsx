"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardBody } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { expenseTypeLabels } from "@/lib/demo-data";
import { useDemoSession } from "@/lib/demo-session";
import { canRunPayroll, isFieldRole } from "@/lib/access";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  authUserId,
  getExpenseBalance,
  listExpenses,
  listProfiles,
  type PayrollBalance,
} from "@/lib/api/live";
import type { DemoUser, Expense } from "@/lib/types";

const emptyBalance: PayrollBalance = {
  totalPay: 0,
  totalUpfront: 0,
  totalHold: 0,
  totalExpenses: 0,
  liveBalance: 0,
};

export default function PayrollPage() {
  const { user } = useDemoSession();
  const [profiles, setProfiles] = useState<DemoUser[]>([]);
  const [selected, setSelected] = useState("");
  const [balance, setBalance] = useState<PayrollBalance>(emptyBalance);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const lockedToSelf = user ? isFieldRole(user.role) : false;

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const people = lockedToSelf ? [user] : await listProfiles();
      setProfiles(people);
      const target =
        lockedToSelf
          ? authUserId(user)
          : selected && people.some((p) => p.id === selected)
            ? selected
            : people[0]?.id ?? authUserId(user);
      if (!selected || lockedToSelf) setSelected(target);
      const [bal, rows] = await Promise.all([
        getExpenseBalance(target),
        listExpenses(target),
      ]);
      setBalance(bal);
      setExpenses(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load payroll.");
    } finally {
      setLoading(false);
    }
  }, [user, lockedToSelf, selected]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user) return null;

  const subject = profiles.find((p) => p.id === selected) ?? user;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Payroll"
        title="Live Payroll & Expenses"
        description="Month-to-date pay, upfront, hold, and live balance from the database."
        actions={
          <div className="flex flex-wrap items-end gap-3">
            {!lockedToSelf ? (
              <div className="w-48 space-y-2">
                <Label>User</Label>
                <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
                  {profiles.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
            <Link href="/payroll/expenses/new">
              <Button>
                <Plus size={16} /> Add expense
              </Button>
            </Link>
          </div>
        }
      />
      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
      {loading ? <p className="text-sm text-ink/55">Loading live payroll…</p> : null}
      <p className="text-sm text-ink/60">
        Viewing <span className="font-medium text-ink">{subject.firstName} {subject.lastName}</span>
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total pay (MTD)" value={formatCurrency(balance.totalPay)} />
        <StatCard label="Total upfront (MTD)" value={formatCurrency(balance.totalUpfront)} />
        <StatCard label="Total hold (MTD)" value={formatCurrency(balance.totalHold)} />
        <StatCard label="Total expenses (MTD)" value={formatCurrency(balance.totalExpenses)} />
        <StatCard
          label="Live balance"
          value={formatCurrency(balance.liveBalance)}
          tone={balance.liveBalance < 0 ? "danger" : "success"}
          hint={balance.liveBalance < 0 ? "Super Admin alerted" : "Upfront − expenses"}
        />
      </div>
      {balance.liveBalance < 0 ? (
        <Card className="border-danger/30 bg-danger/8">
          <CardBody className="flex items-center gap-3">
            <Badge tone="danger">Negative balance</Badge>
            <p className="text-sm text-danger">Expenses exceed upfront allocation this month.</p>
          </CardBody>
        </Card>
      ) : null}
      <Card>
        <CardBody className="p-0">
          <DataTable>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Type</Th>
                <Th align="right">Amount</Th>
                <Th>Receipt</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8 bg-white/50">
              {expenses.map((e) => (
                <tr key={e.id}>
                  <Td>
                    {e.endDate
                      ? e.endDate === e.date
                        ? formatDate(e.date)
                        : `${formatDate(e.date)} – ${formatDate(e.endDate)}`
                      : formatDate(e.date)}
                  </Td>
                  <Td>{expenseTypeLabels[e.type]}</Td>
                  <Td align="right">{formatCurrency(e.amount)}</Td>
                  <Td className="text-civic-navy">{e.receiptName}</Td>
                </tr>
              ))}
              {expenses.length === 0 ? (
                <tr>
                  <Td colSpan={4}>
                    <p className="py-6 text-center text-sm text-ink/50">No expenses yet.</p>
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </DataTable>
        </CardBody>
      </Card>
      {canRunPayroll(user.role) ? (
        <Link href="/payroll/monthly" className="text-sm text-civic-navy hover:underline">
          Monthly payroll generation
        </Link>
      ) : null}
    </div>
  );
}
