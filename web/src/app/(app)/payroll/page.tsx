"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardBody } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { PaymentsPanel } from "@/components/payroll/payments-panel";
import { PayrollBatchPanel } from "@/components/payroll/payroll-batch-panel";
import { FieldOpsPanel } from "@/components/admin/field-ops-panel";
import { expenseTypeLabels } from "@/lib/demo-data";
import { useDemoSession } from "@/lib/demo-session";
import { canRunPayroll, isFieldRole } from "@/lib/access";
import { canAccessPayments } from "@/lib/navigation";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  authUserId,
  getExpenseBalance,
  getReceiptSignedUrl,
  listExpenses,
  listProfiles,
  type PayrollBalance,
} from "@/lib/api/live";
import {
  listLodgingProperties,
  listOpenLodgingOccupancies,
  requestHousingCheckout,
  updateHousingRates,
} from "@/lib/api/remodel";
import type { DemoUser, Expense, LodgingOccupancy, LodgingProperty } from "@/lib/types";

const emptyBalance: PayrollBalance = {
  totalPay: 0,
  totalUpfront: 0,
  totalHold: 0,
  totalExpenses: 0,
  liveBalance: 0,
};

type PayrollTab = "expenses" | "payments" | "batch" | "housing-cars";

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
  const [rateDraft, setRateDraft] = useState<Record<string, { full: string; half: string }>>({});

  const lockedToSelf = user ? isFieldRole(user.role) : false;
  const showPayments = user ? canAccessPayments(user.role) : false;
  const showBatch = user ? canRunPayroll(user.role) : false;
  const showHousingCars = user ? canRunPayroll(user.role) : false;
  const tab: PayrollTab =
    showHousingCars && params.get("tab") === "housing-cars"
      ? "housing-cars"
      : showBatch && params.get("tab") === "batch"
        ? "batch"
        : showPayments && params.get("tab") === "payments"
          ? "payments"
          : "expenses";

  const load = useCallback(async () => {
    if (!user || tab === "payments" || tab === "batch" || tab === "housing-cars") return;
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
      const drafts: Record<string, { full: string; half: string }> = {};
      for (const p of props) {
        drafts[p.id] = {
          full: String(p.fullRate ?? p.roomRate ?? ""),
          half: String(p.halfRate ?? ""),
        };
      }
      setRateDraft(drafts);
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
    const nextParams = new URLSearchParams();
    if (next === "payments") nextParams.set("tab", "payments");
    else if (next === "batch") nextParams.set("tab", "batch");
    else if (next === "housing-cars") nextParams.set("tab", "housing-cars");
    const qs = nextParams.toString();
    router.push(qs ? `/payroll?${qs}` : "/payroll");
  }

  async function handleCheckoutRequest(occupancyId: string) {
    setCheckingOut(occupancyId);
    setError("");
    try {
      await requestHousingCheckout(occupancyId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not request checkout.");
    } finally {
      setCheckingOut(null);
    }
  }

  const subject = profiles.find((p) => p.id === selected) ?? user;
  const propertyName = (propertyId: string) =>
    properties.find((p) => p.id === propertyId)?.name ?? "Property";
  const isAdmin = canRunPayroll(user.role);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Payroll"
        title="Live Payroll & Expenses"
        description={
          tab === "batch"
            ? "Enter paid amounts against live balances."
            : tab === "payments"
              ? canRunPayroll(user.role)
                ? "Record payments and advances."
                : "View your payment history."
              : tab === "housing-cars"
                ? "Assign housing and rental cars."
                : "View balance and expenses."
        }
        actions={
          <div className="flex flex-wrap items-end gap-3">
            {showPayments || showBatch || showHousingCars ? (
              <div className="flex rounded-full border border-ink/15 bg-white/70 p-1">
                <Button
                  size="sm"
                  variant={tab === "expenses" ? "primary" : "ghost"}
                  className={tab === "expenses" ? "" : "border-0 bg-transparent"}
                  onClick={() => setTab("expenses")}
                >
                  Expenses
                </Button>
                {showHousingCars ? (
                  <Button
                    size="sm"
                    variant={tab === "housing-cars" ? "primary" : "ghost"}
                    className={tab === "housing-cars" ? "" : "border-0 bg-transparent"}
                    onClick={() => setTab("housing-cars")}
                  >
                    Housing & cars
                  </Button>
                ) : null}
                {showPayments ? (
                  <Button
                    size="sm"
                    variant={tab === "payments" ? "primary" : "ghost"}
                    className={tab === "payments" ? "" : "border-0 bg-transparent"}
                    onClick={() => setTab("payments")}
                  >
                    Payments
                  </Button>
                ) : null}
                {showBatch ? (
                  <Button
                    size="sm"
                    variant={tab === "batch" ? "primary" : "ghost"}
                    className={tab === "batch" ? "" : "border-0 bg-transparent"}
                    onClick={() => setTab("batch")}
                  >
                    Batch pay
                  </Button>
                ) : null}
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

      {tab === "housing-cars" ? (
        <FieldOpsPanel />
      ) : tab === "batch" ? (
        <PayrollBatchPanel />
      ) : tab === "payments" ? (
        <PaymentsPanel />
      ) : (
        <>
          {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
          {loading ? <p className="text-sm text-ink/55">Loading live payroll…</p> : null}
          <p className="text-sm text-ink/60">
            Viewing <span className="font-medium text-ink">{subject.firstName} {subject.lastName}</span>
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Total pay (YTD)" value={formatCurrency(balance.totalPay)} />
            <StatCard label="Total upfront (YTD)" value={formatCurrency(balance.totalUpfront)} />
            <StatCard label="Total hold (YTD)" value={formatCurrency(balance.totalHold)} />
            <StatCard label="Total expenses (YTD)" value={formatCurrency(balance.totalExpenses)} />
            <StatCard
              label="Live balance"
              value={formatCurrency(balance.liveBalance)}
              tone={balance.liveBalance < 0 ? "danger" : "success"}
              hint={balance.liveBalance < 0 ? "Super Admin alerted" : "Upfront − expenses − paid"}
            />
          </div>
          {balance.liveBalance < 0 ? (
            <Card className="border-danger/30 bg-danger/8">
              <CardBody className="flex items-center gap-3">
                <Badge tone="danger">Negative balance</Badge>
                <p className="text-sm text-danger">Expenses exceed upfront allocation this year.</p>
              </CardBody>
            </Card>
          ) : null}
          {isAdmin && properties.length > 0 ? (
            <Card>
              <CardBody className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-ink/50">Housing rates</p>
                  <p className="mt-1 text-sm text-ink/60">Edit full / half rates for open properties.</p>
                </div>
                <div className="space-y-3">
                  {properties.slice(0, 8).map((p) => (
                    <div key={p.id} className="flex flex-wrap items-end gap-3">
                      <div className="min-w-[10rem] flex-1">
                        <p className="text-sm font-medium text-ink">{p.name}</p>
                      </div>
                      <div className="w-28 space-y-1">
                        <Label>Full</Label>
                        <Input
                          value={rateDraft[p.id]?.full ?? ""}
                          onChange={(e) =>
                            setRateDraft((prev) => ({
                              ...prev,
                              [p.id]: { full: e.target.value, half: prev[p.id]?.half ?? "" },
                            }))
                          }
                        />
                      </div>
                      <div className="w-28 space-y-1">
                        <Label>Half</Label>
                        <Input
                          value={rateDraft[p.id]?.half ?? ""}
                          onChange={(e) =>
                            setRateDraft((prev) => ({
                              ...prev,
                              [p.id]: { full: prev[p.id]?.full ?? "", half: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <Button
                        size="sm"
                        onClick={() =>
                          void updateHousingRates(
                            p.id,
                            parseFloat(rateDraft[p.id]?.full || "0") || 0,
                            parseFloat(rateDraft[p.id]?.half || "0") || 0,
                          )
                            .then(load)
                            .catch((e) =>
                              setError(e instanceof Error ? e.message : "Could not update rates"),
                            )
                        }
                      >
                        Save rates
                      </Button>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          ) : null}
          {openStays.length > 0 ? (
            <Card>
              <CardBody className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-ink/50">Open stays</p>
                  <p className="mt-1 text-sm text-ink/60">
                    Request checkout to stop nightly accrual after admin approval.
                  </p>
                </div>
                <DataTable>
                  <thead>
                    <tr>
                      <Th>Property</Th>
                      <Th>Share</Th>
                      <Th>Check-in</Th>
                      <Th align="right">Daily</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/8 bg-white/50">
                    {openStays.map((stay) => (
                      <tr key={stay.id}>
                        <Td>{propertyName(stay.propertyId)}</Td>
                        <Td>{stay.shareKind ?? "full"}</Td>
                        <Td>{formatDate(stay.checkInAt.slice(0, 10))}</Td>
                        <Td align="right">
                          {stay.dailyAmount != null ? formatCurrency(stay.dailyAmount) : "—"}
                        </Td>
                        <Td>
                          {stay.checkoutRequestedAt ? (
                            <Badge tone="warning">Pending approval</Badge>
                          ) : (
                            <Button
                              size="sm"
                              disabled={checkingOut === stay.id}
                              onClick={() => void handleCheckoutRequest(stay.id)}
                            >
                              {checkingOut === stay.id ? "Requesting…" : "Request checkout"}
                            </Button>
                          )}
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
                      <Td className="text-civic-navy">
                        {e.receiptPath && e.receiptName !== "—" ? (
                          <button
                            type="button"
                            className="text-left font-medium text-civic-navy hover:underline"
                            onClick={() => {
                              void (async () => {
                                try {
                                  const url = await getReceiptSignedUrl(e.receiptPath!);
                                  window.open(url, "_blank", "noopener,noreferrer");
                                } catch {
                                  setError("Could not open receipt.");
                                }
                              })();
                            }}
                          >
                            View receipt
                          </button>
                        ) : (
                          "—"
                        )}
                      </Td>
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

