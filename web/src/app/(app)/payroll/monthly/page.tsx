"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardBody } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import {
  getProfile,
  listMonthlyPayroll,
  lockMonthlyPayroll,
  runMonthlyPayroll,
} from "@/lib/api/live";
import type { MonthlyPayrollRecord } from "@/lib/types";

export default function MonthlyPayrollPage() {
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [rows, setRows] = useState<MonthlyPayrollRecord[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const records = await listMonthlyPayroll(parseInt(month, 10), parseInt(year, 10));
      setRows(records);
      const unique = [...new Set(records.map((r) => r.userId))];
      const entries = await Promise.all(
        unique.map(async (id) => {
          const profile = await getProfile(id);
          return [id, profile ? `${profile.firstName} ${profile.lastName}` : "Unknown"] as const;
        }),
      );
      setNames(Object.fromEntries(entries));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load payroll.");
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    void load();
  }, [load]);

  const isLocked = rows.some((r) => r.status === "locked");
  const hasDraft = rows.some((r) => r.status === "draft");

  async function generateDraft() {
    setRunning(true);
    setError("");
    setMessage("");
    try {
      await runMonthlyPayroll(parseInt(month, 10), parseInt(year, 10), false);
      setMessage("Draft payroll generated. Review totals, then lock.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate draft.");
    } finally {
      setRunning(false);
    }
  }

  async function lock() {
    setRunning(true);
    setError("");
    setMessage("");
    try {
      await lockMonthlyPayroll(parseInt(month, 10), parseInt(year, 10));
      setMessage("Payroll locked. Records are immutable.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not lock payroll.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Configuration"
        title="Monthly Payroll Generation"
        description="Generate a draft, review totals, then lock the period."
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label>Month</Label>
              <Select value={month} onChange={(e) => setMonth(e.target.value)}>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i + 1}>{i + 1}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Select value={year} onChange={(e) => setYear(e.target.value)}>
                <option>2026</option>
                <option>2025</option>
              </Select>
            </div>
            <Button className="self-end" disabled={running || isLocked} onClick={() => void generateDraft()}>
              {running ? "Working…" : hasDraft ? "Refresh draft" : "Generate draft"}
            </Button>
            <Button
              className="self-end"
              variant="secondary"
              disabled={running || isLocked || !hasDraft}
              onClick={() => void lock()}
            >
              Lock payroll
            </Button>
          </div>
        }
      />
      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
      {message ? <p className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">{message}</p> : null}
      {loading ? <p className="text-sm text-ink/55">Loading…</p> : null}
      <Card>
        <CardBody className="p-0">
          <DataTable>
            <thead>
              <tr>
                <Th>User</Th>
                <Th align="right">Total pay</Th>
                <Th align="right">Expenses</Th>
                <Th align="right">Net payable</Th>
                <Th align="right">Upfront paid</Th>
                <Th align="right">Hold</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8 bg-white/50">
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td>{names[r.userId] ?? "Unknown"}</Td>
                  <Td align="right">{formatCurrency(r.totalPay)}</Td>
                  <Td align="right">{formatCurrency(r.totalExpenses)}</Td>
                  <Td align="right">{formatCurrency(r.netPayable)}</Td>
                  <Td align="right">{formatCurrency(r.upfrontPaid)}</Td>
                  <Td align="right">{formatCurrency(r.holdBalance)}</Td>
                  <Td>
                    <Badge tone={r.status === "locked" ? "success" : "warning"}>{r.status}</Badge>
                  </Td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <Td colSpan={7}>
                    <p className="py-6 text-center text-sm text-ink/50">
                      No payroll records for this month yet. Generate a draft to preview.
                    </p>
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </DataTable>
        </CardBody>
      </Card>
      <p className="text-xs text-ink/50">Locked records are immutable.</p>
    </div>
  );
}
