"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { authUserId, listProfiles } from "@/lib/api/live";
import {
  createPaymentEvent,
  listPaymentEvents,
  uploadPaymentReceipt,
} from "@/lib/api/remodel";
import { useDemoSession } from "@/lib/demo-session";
import { canRunPayroll } from "@/lib/access";
import { formatCurrency, formatDate } from "@/lib/format";
import type { DemoUser, PaymentBucket, PaymentEvent, PaymentEventType } from "@/lib/types";

export function PaymentsPanel({ showRecordAction = true }: { showRecordAction?: boolean }) {
  const { user } = useDemoSession();
  const [rows, setRows] = useState<PaymentEvent[]>([]);
  const [people, setPeople] = useState<DemoUser[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState("");
  const [bucket, setBucket] = useState<PaymentBucket>("paid");
  const [eventType, setEventType] = useState<PaymentEventType>("onpay");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [fundsHitAt, setFundsHitAt] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const isAdmin = user ? canRunPayroll(user.role) : false;

  async function load() {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const selfId = authUserId(user);
      const [events, profiles] = await Promise.all([
        listPaymentEvents(isAdmin ? undefined : selfId),
        isAdmin ? listProfiles() : Promise.resolve([]),
      ]);
      setRows(events);
      setPeople(profiles);
      if (!userId && profiles[0]) setUserId(profiles[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load payments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [user?.authId, isAdmin]);

  if (!user) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      let receiptPath: string | null = null;
      if (file) receiptPath = await uploadPaymentReceipt(userId, file);
      await createPaymentEvent({
        userId,
        bucket,
        eventType,
        amount: parseFloat(amount) || 0,
        notes,
        receiptPath,
        eventDate: eventDate || undefined,
        fundsHitAt: fundsHitAt || null,
      });
      setOpen(false);
      setAmount("");
      setNotes("");
      setFile(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create payment.");
    } finally {
      setSaving(false);
    }
  }

  const names = Object.fromEntries(
    people.map((p) => [p.id, `${p.firstName} ${p.lastName}`]),
  );

  return (
    <div className="space-y-6">
      {isAdmin && showRecordAction ? (
        <div className="flex justify-end">
          <Button onClick={() => setOpen(true)}>Record payment</Button>
        </div>
      ) : null}
      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
      {loading ? <p className="text-sm text-ink/55">Loading…</p> : null}
      <Card>
        <CardBody className="p-0">
          <DataTable>
            <thead>
              <tr>
                <Th>Date</Th>
                {isAdmin ? <Th>User</Th> : null}
                <Th>Type</Th>
                <Th>Bucket</Th>
                <Th align="right">Amount</Th>
                <Th>Funds hit</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8 bg-white/50">
              {rows.map((row) => {
                const future =
                  row.fundsHitAt && new Date(row.fundsHitAt) > new Date(new Date().toDateString());
                return (
                  <tr key={row.id}>
                    <Td>{formatDate(row.eventDate)}</Td>
                    {isAdmin ? <Td>{names[row.userId] ?? "Unknown"}</Td> : null}
                    <Td>{row.eventType}</Td>
                    <Td>{row.bucket}</Td>
                    <Td align="right">{formatCurrency(row.amount)}</Td>
                    <Td>{row.fundsHitAt ? formatDate(row.fundsHitAt) : "—"}</Td>
                    <Td>
                      {future ? (
                        <Badge tone="warning">Paid — on the way</Badge>
                      ) : row.receiptPath ? (
                        <Badge tone="success">Recorded</Badge>
                      ) : (
                        <Badge>Logged</Badge>
                      )}
                    </Td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <Td colSpan={isAdmin ? 7 : 6}>
                    <p className="py-6 text-center text-sm text-ink/50">No payments yet.</p>
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </DataTable>
        </CardBody>
      </Card>

      {isAdmin ? (
        <Modal open={open} onClose={() => setOpen(false)} title="Record payment">
          <form className="space-y-4" onSubmit={(e) => void submit(e)}>
            <div className="space-y-2">
              <Label>User</Label>
              <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value as PaymentEventType)}
                >
                  {(
                    [
                      "onpay",
                      "cashapp",
                      "full_pay",
                      "upfront",
                      "validity_hold",
                      "advances",
                      "flight_advance",
                      "bonus",
                      "expenses",
                      "housing",
                      "paid",
                      "other",
                    ] as PaymentEventType[]
                  ).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Bucket</Label>
                <Select value={bucket} onChange={(e) => setBucket(e.target.value as PaymentBucket)}>
                  {(
                    [
                      "payroll",
                      "chargebacks",
                      "loans_advances",
                      "hotel_expense",
                      "reimburse",
                      "paid",
                    ] as PaymentBucket[]
                  ).map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input required type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Event date</Label>
                <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Funds hit account</Label>
                <Input type="date" value={fundsHitAt} onChange={(e) => setFundsHitAt(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Paystub / receipt (optional)</Label>
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Saving…" : "Save payment"}
            </Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
