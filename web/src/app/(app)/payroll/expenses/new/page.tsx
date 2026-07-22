"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardBody } from "@/components/ui/card";
import { expenseTypeLabels } from "@/lib/demo-data";
import { formatCurrency } from "@/lib/format";
import { createExpense, listIssues, suggestedExpenseAmount, uploadReceipt } from "@/lib/api/live";
import type { ExpenseType, Issue } from "@/lib/types";

const rangeTypes: ExpenseType[] = ["hotel_travel", "car_rental", "housing"];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function rangeLabels(type: ExpenseType) {
  if (type === "hotel_travel") return { start: "Check-in", end: "Check-out" };
  if (type === "car_rental") return { start: "Pick-up", end: "Return" };
  return { start: "Start date", end: "End date" };
}

export default function NewExpensePage() {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<ExpenseType>("upfront_draw");
  const [amount, setAmount] = useState("");
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [issueId, setIssueId] = useState("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [dateError, setDateError] = useState("");
  const [error, setError] = useState("");
  const [suggested, setSuggested] = useState<number | undefined>();
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [tollsAmount, setTollsAmount] = useState("0");
  const [carActive, setCarActive] = useState(true);

  const usesRange = rangeTypes.includes(type);
  const labels = rangeLabels(type);

  useEffect(() => {
    void listIssues()
      .then((rows) => {
        setIssues(rows);
        if (rows[0]) setIssueId(rows[0].id);
      })
      .catch(() => setIssues([]));
  }, []);

  useEffect(() => {
    if (type !== "car_rental" && type !== "housing") {
      setSuggested(undefined);
      return;
    }
    void suggestedExpenseAmount(type, issueId || null)
      .then((value) => {
        setSuggested(value);
        if (value !== undefined) setAmount(String(value));
      })
      .catch(() => setSuggested(undefined));
  }, [type, issueId]);

  function handleTypeChange(next: ExpenseType) {
    setType(next);
    setDateError("");
    if (rangeTypes.includes(next) && endDate < startDate) setEndDate(startDate);
  }

  function handleStartChange(value: string) {
    setStartDate(value);
    setDateError("");
    if (usesRange && endDate < value) setEndDate(value);
  }

  function handleEndChange(value: string) {
    setEndDate(value);
    if (value < startDate) {
      setDateError("End date cannot be before the start date.");
      return;
    }
    setDateError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (usesRange && endDate < startDate) {
      setDateError("End date cannot be before the start date.");
      return;
    }
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
        endDate: usesRange ? endDate : null,
        issueId: issueId || null,
        receiptPath,
        tollsAmount: type === "car_rental" ? parseFloat(tollsAmount) || 0 : 0,
        carActive: type === "car_rental" ? carActive : false,
      });
      setSaved(true);
      setTimeout(() => {
        window.location.href = "/payroll";
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save expense.");
      setSaving(false);
    }
  }

  const issueLabel = useMemo(
    () => issues.find((i) => i.id === issueId)?.issueNumber,
    [issues, issueId],
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Payroll"
        title="Add Expense"
        description="Log a receipt-backed expense. It applies immediately to live balance."
        actions={
          <Link href="/payroll" className="text-sm text-civic-navy hover:underline">
            Back to payroll
          </Link>
        }
      />
      <Card className="max-w-xl">
        <CardBody>
          <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
            <div className="space-y-2">
              <Label htmlFor="expense-type">Type</Label>
              <Select
                id="expense-type"
                value={type}
                onChange={(e) => handleTypeChange(e.target.value as ExpenseType)}
              >
                {Object.entries(expenseTypeLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>

            {(type === "car_rental" || type === "housing" || type === "hotel_travel" || type === "chargeback") && issues.length > 0 ? (
              <div className="space-y-2">
                <Label htmlFor="issue">Issue (optional)</Label>
                <Select id="issue" value={issueId} onChange={(e) => setIssueId(e.target.value)}>
                  {issues.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.issueNumber}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min={0}
                required={suggested === undefined}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={suggested !== undefined ? formatCurrency(suggested) : undefined}
              />
              {suggested !== undefined && (type === "car_rental" || type === "housing") ? (
                <p className="text-xs text-ink/50">
                  Suggested from config{issueLabel ? ` (${issueLabel})` : ""}: {formatCurrency(suggested)}. You can override.
                </p>
              ) : null}
            </div>

            {usesRange ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="start-date">{labels.start}</Label>
                  <Input
                    id="start-date"
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => handleStartChange(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date">{labels.end}</Label>
                  <Input
                    id="end-date"
                    type="date"
                    required
                    min={startDate}
                    value={endDate}
                    onChange={(e) => handleEndChange(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => handleStartChange(e.target.value)}
                />
              </div>
            )}

            {dateError ? (
              <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{dateError}</p>
            ) : null}
            {error ? (
              <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
            ) : null}

            {usesRange ? (
              <p className="text-xs text-ink/50">
                {labels.end} can be the same day as {labels.start.toLowerCase()}, but not earlier.
              </p>
            ) : null}

            {type === "car_rental" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tolls">Tolls</Label>
                  <Input
                    id="tolls"
                    type="number"
                    step="0.01"
                    min={0}
                    value={tollsAmount}
                    onChange={(e) => setTollsAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="car-active">Active in Field Operations</Label>
                  <Select
                    id="car-active"
                    value={carActive ? "yes" : "no"}
                    onChange={(e) => setCarActive(e.target.value === "yes")}
                  >
                    <option value="yes">Yes — show on Field Operations</option>
                    <option value="no">No</option>
                  </Select>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="receipt">Receipt</Label>
              <Input
                id="receipt"
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
              />
              {receiptFile ? (
                <p className="text-xs text-ink/55">Selected: {receiptFile.name}</p>
              ) : null}
            </div>

            <Button type="submit" className="w-full" disabled={!!dateError || saving || saved}>
              {saved ? "Saved — redirecting…" : saving ? "Saving…" : "Save expense"}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
