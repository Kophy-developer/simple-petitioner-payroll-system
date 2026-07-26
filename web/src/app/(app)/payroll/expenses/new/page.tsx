"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardBody } from "@/components/ui/card";
import { expenseFormTypes, expenseTypeLabels } from "@/lib/demo-data";
import { createExpense, listIssues, uploadReceipt } from "@/lib/api/live";
import type { ExpenseType, Issue } from "@/lib/types";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function NewExpensePage() {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<ExpenseType>("flight");
  const [amount, setAmount] = useState("");
  const [startDate, setStartDate] = useState(todayIso());
  const [issueId, setIssueId] = useState("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [error, setError] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [markBrex, setMarkBrex] = useState(false);

  useEffect(() => {
    void listIssues()
      .then((rows) => {
        setIssues(rows);
        if (rows[0]) setIssueId(rows[0].id);
      })
      .catch(() => setIssues([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      let receiptPath: string | null = null;
      if (receiptFile) {
        receiptPath = await uploadReceipt(receiptFile);
      }
      await createExpense({
        type,
        amount: amount === "" ? null : parseFloat(amount),
        expenseDate: startDate,
        issueId: issueId || null,
        receiptPath,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save expense.");
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Payroll" title="Expense saved" description="Expense recorded." />
        <Card>
          <CardBody className="space-y-4">
            <p className="text-sm text-ink/70">
              {expenseTypeLabels[type]} · {amount ? `$${amount}` : "suggested amount"}
              {markBrex ? " · flagged for Brex reimbursement review when matched" : ""}
            </p>
            <div className="flex gap-3">
              <Link href="/payroll">
                <Button>Back to payroll</Button>
              </Link>
              <Button
                variant="ghost"
                onClick={() => {
                  setSaved(false);
                  setAmount("");
                  setReceiptFile(null);
                  setMarkBrex(false);
                }}
              >
                Add another
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Payroll"
        title="Add expense"
        description="Flights, gas, and other only. Housing and rental cars are assigned in Field Ops."
        actions={
          <Link href="/payroll" className="text-sm text-civic-navy hover:underline">
            Back
          </Link>
        }
      />
      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
      <Card className="max-w-xl">
        <CardBody>
          <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onChange={(e) => setType(e.target.value as ExpenseType)}>
                {expenseFormTypes.map((t) => (
                  <option key={t} value={t}>
                    {expenseTypeLabels[t]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  required
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Issue (optional)</Label>
              <Select value={issueId} onChange={(e) => setIssueId(e.target.value)}>
                <option value="">None</option>
                {issues.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Receipt (optional)</Label>
              <Input type="file" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} />
            </div>
            <label className="flex items-center gap-2 text-sm text-ink/70">
              <input
                type="checkbox"
                checked={markBrex}
                onChange={(e) => setMarkBrex(e.target.checked)}
                className="h-4 w-4 accent-brass"
              />
              Mark for Brex reimbursement when card sync matches
            </label>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Saving…" : "Save expense"}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
