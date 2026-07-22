"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardBody } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { PaymentsPanel } from "@/components/payroll/payments-panel";
import { expenseTypeLabels } from "@/lib/demo-data";
import { useDemoSession } from "@/lib/demo-session";
import { canRunPayroll, isFieldRole } from "@/lib/access";
import { canAccessPayments } from "@/lib/navigation";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  authUserId,
  getExpenseBalance,
  listExpenses,
  listProfiles,
  type PayrollBalance,
} from "@/lib/api/live";
import {
  checkOutLodging,
  listLodgingProperties,
  listOpenLodgingOccupancies,
} from "@/lib/api/remodel";
import type { DemoUser, Expense, LodgingOccupancy, LodgingProperty } from "@/lib/types";

const emptyBalance: PayrollBalance = {
  totalPay: 0,
  totalUpfront: 0,
  totalHold: 0,
  totalExpenses: 0,
  liveBalance: 0,
};

type PayrollTab = "expenses" | "payments";

function PayrollContent() {
  const { user } = useDemoSession();
  const router = useRouter();
  const params = useSearchParams();
  const [profiles, setProfiles] = useState<DemoUser[]>([]);
  const [selected, setSelected] = useState("");
  const [balance, setBalance] = useState<PayrollBalance>(emptyBalance);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [openStays, setOpenStays] = useState<LodgingOccupancy[]>([]);
  const [properties, setProperties] = useState<LodgingProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkingOut, setCheckingOut] = useState<string | null>(null);

  const lockedToSelf = user ? isFieldRole(user.role) : false;
  const showPayments = user ? canAccessPayments(user.role) : false;
  const tab: PayrollTab =
    showPayments && params.get("tab") === "payments" ? "payments" : "expenses";

  const load = useCallback(async () => {
    if (!user || tab === "payments") return;
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
      const [bal, rows, stays, props] = await Promise.all([
        getExpenseBalance(target),
        listExpenses(target),
        listOpenLodgingOccupancies(lockedToSelf ? authUserId(user) : target),
        listLodgingProperties(),
      ]);
      setBalance(bal);
      setExpenses(rows);
      setOpenStays(stays);
      setProperties(props);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load payroll.");
    } finally {
      setLoading(false);
    }
  }, [user, lockedToSelf, selected, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user) return null;

  function setTab(next: PayrollTab) {
    const nextParams = new URLSearchParams(params.toString());
    if (next === "payments") nextParams.set("tab", "payments");
    else nextParams.delete("tab");
    const qs = nextParams.toString();
    router.push(qs ? `/payroll?${qs}` : "/payroll");
  }

  async function handleCheckout(occupancyId: string) {
    setCheckingOut(occupancyId);
    setError("");
    try {
      await checkOutLodging({ occupancyId });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not check out.");
    } finally {
      setCheckingOut(null);
    }
  }

  const subject = profiles.find((p) => p.id === selected) ?? user;
  const propertyName = (propertyId: string) =>
    properties.find((p) => p.id === propertyId)?.name ?? "Property";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Payroll"
        title="Live Payroll & Expenses"
        description={
          tab === "payments"
            ? canRunPayroll(user.role)
              ? "Record disbursements any day. No period lock. Attach paystubs and the date funds hit the account."
              : "Your payment history. When funds are scheduled, status shows Paid — on the way until that date."
            : "Month-to-date pay, upfront, hold, and live balance from the database."
        }
        actions={
          <div className="flex flex-wrap items-end gap-3">
            {showPayments ? (
              <div className="flex rounded-full border border-ink/15 bg-white/70 p-1">
                <Button
                  size="sm"
                  variant={tab === "expenses" ? "primary" : "ghost"}
                  className={tab === "expenses" ? "" : "border-0 bg-transparent"}
                  onClick={() => setTab("expenses")}
                >
                  Expenses
                </Button>
                <Button
                  size="sm"
                  variant={tab === "payments" ? "primary" : "ghost"}
                  className={tab === "payments" ? "" : "border-0 bg-transparent"}
                  onClick={() => setTab("payments")}
                >
                  Payments
                </Button>
              </div>
            ) : null}
            {tab === "expenses" && !lockedToSelf ? (
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
            {tab === "expenses" ? (
              <Link href="/payroll/expenses/new">
                <Button>
                  <Plus size={16} /> Add expense
                </Button>
              </Link>
            ) : null}
          </div>
        }
      />

      {tab === "payments" ? (
        <PaymentsPanel />
      ) : (
        <>
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
          {openStays.length > 0 ? (
            <Card>
              <CardBody className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-ink/50">Open stays</p>
                  <p className="mt-1 text-sm text-ink/60">
                    Checked in via Airbnb or hotel expense. Check out when you leave.
                  </p>
                </div>
                <DataTable>
                  <thead>
                    <tr>
                      <Th>Property</Th>
                      <Th>Room</Th>
                      <Th>Check-in</Th>
                      <Th align="right">Daily share</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/8 bg-white/50">
                    {openStays.map((stay) => (
                      <tr key={stay.id}>
                        <Td>{propertyName(stay.propertyId)}</Td>
                        <Td>{stay.roomNumber || "—"}</Td>
                        <Td>{formatDate(stay.checkInAt.slice(0, 10))}</Td>
                        <Td align="right">
                          {stay.dailyAmount != null ? formatCurrency(stay.dailyAmount) : "—"}
                        </Td>
                        <Td>
                          <Button
                            size="sm"
                            disabled={checkingOut === stay.id}
                            onClick={() => void handleCheckout(stay.id)}
                          >
                            {checkingOut === stay.id ? "Checking out…" : "Check out"}
                          </Button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
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
        </>
      )}
    </div>
  );
}

export default function PayrollPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center">Loading payroll…</div>}>
      <PayrollContent />
    </Suspense>
  );
}
