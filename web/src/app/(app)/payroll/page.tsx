"use client";

import { useState } from "react";
import { Receipt, Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import {
  circulators,
  expenseTypeLabels,
  getExpensesForCirculator,
  getPayrollSummary,
} from "@/lib/demo-data";
import { useDemoSession } from "@/lib/demo-session";
import { formatCurrency, formatDate } from "@/lib/format";

export default function PayrollPage() {
  const { user } = useDemoSession();
  const [selectedCirculator, setSelectedCirculator] = useState(
    user?.circulatorId ?? circulators[0].id,
  );
  const [amount, setAmount] = useState("45.00");
  const [expenseType, setExpenseType] =
    useState<keyof typeof expenseTypeLabels>("draw");

  const circulatorId =
    user?.role === "circulator" && user.circulatorId
      ? user.circulatorId
      : selectedCirculator;

  const summary = getPayrollSummary(circulatorId);
  const expenseRows = getExpensesForCirculator(circulatorId);
  const circulator = circulators.find((c) => c.id === circulatorId);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Payroll"
        title="Payroll & Expense Tracking"
        description="Upfront allocation, hold reserve, and receipt-backed expenses with automatic balance sync."
        actions={
          user?.role !== "circulator" ? (
            <div className="w-56 space-y-2">
              <Label htmlFor="payroll-circulator">Circulator</Label>
              <Select
                id="payroll-circulator"
                value={selectedCirculator}
                onChange={(e) => setSelectedCirculator(e.target.value)}
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
        <p className="text-sm text-ink/60">
          Viewing payroll for{" "}
          <span className="font-medium text-ink">
            {circulator.firstName} {circulator.lastName}
          </span>
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total upfront"
          value={formatCurrency(summary.totalUpfront)}
          hint="Sum of ledger upfront allocations"
        />
        <StatCard
          label="Total expenses"
          value={formatCurrency(summary.totalExpenses)}
        />
        <StatCard
          label="Balance"
          value={formatCurrency(summary.balance)}
          tone={summary.balance < 0 ? "danger" : "success"}
          hint={
            summary.balance < 0
              ? "Flagged for Super Admin review"
              : "Upfront minus expenses"
          }
        />
        <StatCard
          label="Total hold"
          value={formatCurrency(summary.totalHold)}
          hint="Reserve not reduced by expenses"
        />
      </div>

      {summary.balance < 0 ? (
        <Card className="border-danger/30 bg-danger/8">
          <CardBody className="flex items-center gap-3 text-danger">
            <Badge tone="danger">Negative balance</Badge>
            <p className="text-sm">
              Expenses exceed upfront allocation. Super Admin visibility is
              required.
            </p>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <h2 className="font-display text-xl text-ink">Log expense</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="expense-type">Expense type</Label>
              <Select
                id="expense-type"
                value={expenseType}
                onChange={(e) =>
                  setExpenseType(e.target.value as keyof typeof expenseTypeLabels)
                }
              >
                {Object.entries(expenseTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-ink/15 px-4 py-8 text-sm text-ink/60 transition hover:border-brass/40">
              <Upload size={16} />
              Attach receipt photo
              <input type="file" className="hidden" accept="image/*,.pdf" />
            </label>
            <Button className="w-full">
              <Receipt size={16} />
              Save expense
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-display text-xl text-ink">Expense history</h2>
          </CardHeader>
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
                {expenseRows.map((expense) => (
                  <tr key={expense.id}>
                    <Td>{formatDate(expense.date)}</Td>
                    <Td>{expenseTypeLabels[expense.type]}</Td>
                    <Td align="right">{formatCurrency(expense.amount)}</Td>
                    <Td className="text-civic-navy">{expense.receiptName}</Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
