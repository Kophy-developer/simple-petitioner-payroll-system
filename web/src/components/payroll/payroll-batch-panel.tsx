"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { getExpenseBalance, listProfiles } from "@/lib/api/live";
import { createPaymentEvent, uploadPaymentReceipt } from "@/lib/api/remodel";
import { formatCurrency } from "@/lib/format";
import { sortDirectoryUsers } from "@/lib/roster-import";
import type { DemoUser } from "@/lib/types";

type RowState = {
  userId: string;
  liveBalance: number;
  hold: number;
  paidAmount: string;
  receipt: File | null;
};

export function PayrollBatchPanel() {
  const [rows, setRows] = useState<RowState[]>([]);
  const [people, setPeople] = useState<DemoUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const profiles = sortDirectoryUsers(await listProfiles()).filter(
        (p) => p.status !== "offboarded" && !p.isLotus,
      );
      setPeople(profiles);
      const balances = await Promise.all(
        profiles.map(async (p) => {
          const bal = await getExpenseBalance(p.id);
          return {
            userId: p.id,
            liveBalance: bal.liveBalance,
            hold: bal.totalHold,
            paidAmount: "",
            receipt: null as File | null,
          };
        }),
      );
      setRows(balances);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load payroll batch.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const names = Object.fromEntries(people.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));

  async function runBatch() {
    const toPay = rows.filter((r) => parseFloat(r.paidAmount) > 0);
    if (!toPay.length) {
      setError("Enter at least one paid amount.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      for (const row of toPay) {
        let receiptPath: string | null = null;
        if (row.receipt) {
          receiptPath = await uploadPaymentReceipt(row.userId, row.receipt);
        }
        await createPaymentEvent({
          userId: row.userId,
          bucket: "payroll",
          eventType: "paid",
          amount: parseFloat(row.paidAmount) || 0,
          notes: "Payroll batch",
          receiptPath,
        });
      }
      setMessage(`Recorded ${toPay.length} payment(s). Live balances updated.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not run payroll batch.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink/65">
          Enter paid amounts manually. Receipts are optional and can be uploaded later.
        </p>
        <Button onClick={() => void runBatch()} disabled={saving || loading}>
          {saving ? "Paying…" : "Pay selected amounts"}
        </Button>
      </div>
      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
      {message ? (
        <p className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">{message}</p>
      ) : null}
      {loading ? <p className="text-sm text-ink/55">Loading balances…</p> : null}
      <Card>
        <CardBody className="p-0">
          <DataTable>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th align="right">Live balance</Th>
                <Th align="right">Hold</Th>
                <Th align="right">Amount to pay</Th>
                <Th>Receipt</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8 bg-white/50">
              {rows.map((row) => (
                <tr key={row.userId}>
                  <Td>{names[row.userId] ?? "Unknown"}</Td>
                  <Td align="right">{formatCurrency(row.liveBalance)}</Td>
                  <Td align="right">{formatCurrency(row.hold)}</Td>
                  <Td align="right">
                    <Input
                      className="ml-auto w-28"
                      type="number"
                      step="0.01"
                      value={row.paidAmount}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r) =>
                            r.userId === row.userId
                              ? { ...r, paidAmount: e.target.value }
                              : r,
                          ),
                        )
                      }
                    />
                  </Td>
                  <Td>
                    <Input
                      type="file"
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r) =>
                            r.userId === row.userId
                              ? { ...r, receipt: e.target.files?.[0] ?? null }
                              : r,
                          ),
                        )
                      }
                    />
                  </Td>
                </tr>
              ))}
              {rows.length === 0 && !loading ? (
                <tr>
                  <Td colSpan={5}>
                    <p className="py-6 text-center text-sm text-ink/50">No people to pay.</p>
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </DataTable>
        </CardBody>
      </Card>
    </div>
  );
}
