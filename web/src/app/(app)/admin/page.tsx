"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { PayRatesPanel } from "@/components/admin/pay-rates-panel";
import { ExpenseConfigPanel } from "@/components/admin/expense-config-panel";
import { FieldOpsPanel } from "@/components/admin/field-ops-panel";
import { getBenchmark } from "@/lib/api/live";
import { useDemoSession } from "@/lib/demo-session";
import {
  canAccessExpenseConfig,
  canAccessFieldOps,
  canAccessPayRates,
} from "@/lib/navigation";

type AdminTab = "overview" | "pay-rates" | "expense-config" | "field-ops";

function AdminContent() {
  const { user } = useDemoSession();
  const router = useRouter();
  const params = useSearchParams();
  const [benchmark, setBenchmark] = useState(75);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const canPayRates = user ? canAccessPayRates(user.role) : false;
  const canExpense = user ? canAccessExpenseConfig(user.role) : false;
  const canField = user ? canAccessFieldOps(user.role) : false;

  const requested = params.get("tab");
  const tab: AdminTab =
    requested === "pay-rates" && canPayRates
      ? "pay-rates"
      : requested === "expense-config" && canExpense
        ? "expense-config"
        : requested === "field-ops" && canField
          ? "field-ops"
          : "overview";

  useEffect(() => {
    if (tab !== "overview") {
      setLoading(false);
      return;
    }
    void getBenchmark()
      .then(setBenchmark)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load admin data."))
      .finally(() => setLoading(false));
  }, [tab]);

  if (!user) return null;

  function setTab(next: AdminTab) {
    const nextParams = new URLSearchParams();
    if (next !== "overview") nextParams.set("tab", next);
    const qs = nextParams.toString();
    router.push(qs ? `/admin?${qs}` : "/admin");
  }

  const title =
    tab === "pay-rates"
      ? "Pay Rates"
      : tab === "expense-config"
        ? "Car & Housing"
        : tab === "field-ops"
          ? "Field Operations"
          : "Admin Panel";

  const description =
    tab === "pay-rates"
      ? "Per petition / issue pay rates and the system-wide payable benchmark."
      : tab === "expense-config"
        ? "Standard rates plus optional per-issue overrides."
        : tab === "field-ops"
          ? "Active cars, Airbnbs, and hotels. Map comes later; this view is the live occupancy board."
          : "System settings. People management lives in Employee Directory.";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Configuration"
        title={title}
        description={description}
        actions={
          <div className="flex flex-wrap rounded-full border border-ink/15 bg-white/70 p-1">
            <Button
              size="sm"
              variant={tab === "overview" ? "primary" : "ghost"}
              className={tab === "overview" ? "" : "border-0 bg-transparent"}
              onClick={() => setTab("overview")}
            >
              Overview
            </Button>
            {canPayRates ? (
              <Button
                size="sm"
                variant={tab === "pay-rates" ? "primary" : "ghost"}
                className={tab === "pay-rates" ? "" : "border-0 bg-transparent"}
                onClick={() => setTab("pay-rates")}
              >
                Pay Rates
              </Button>
            ) : null}
            {canExpense ? (
              <Button
                size="sm"
                variant={tab === "expense-config" ? "primary" : "ghost"}
                className={tab === "expense-config" ? "" : "border-0 bg-transparent"}
                onClick={() => setTab("expense-config")}
              >
                Car & Housing
              </Button>
            ) : null}
            {canField ? (
              <Button
                size="sm"
                variant={tab === "field-ops" ? "primary" : "ghost"}
                className={tab === "field-ops" ? "" : "border-0 bg-transparent"}
                onClick={() => setTab("field-ops")}
              >
                Field Operations
              </Button>
            ) : null}
          </div>
        }
      />

      {tab === "pay-rates" ? (
        <PayRatesPanel />
      ) : tab === "expense-config" ? (
        <ExpenseConfigPanel />
      ) : tab === "field-ops" ? (
        <FieldOpsPanel />
      ) : (
        <>
          {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
          {loading ? <p className="text-sm text-ink/55">Loading…</p> : null}

          <Card className="max-w-sm">
            <CardBody>
              <p className="text-xs uppercase tracking-[0.2em] text-ink/50">Benchmark %</p>
              <p className="font-display text-4xl tabular-nums">{benchmark}%</p>
              {canPayRates ? (
                <button
                  type="button"
                  onClick={() => setTab("pay-rates")}
                  className="mt-3 inline-block text-sm text-civic-navy hover:underline"
                >
                  Edit via pay rates
                </button>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3">
              <p className="text-xs uppercase tracking-[0.2em] text-ink/50">Configuration</p>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/directory" className="font-medium text-civic-navy hover:underline">
                    Employee Directory
                  </Link>
                  <span className="text-ink/55"> — import employees, teams, create &amp; edit users</span>
                </li>
                {canPayRates ? (
                  <li>
                    <button
                      type="button"
                      onClick={() => setTab("pay-rates")}
                      className="font-medium text-civic-navy hover:underline"
                    >
                      Pay Rates
                    </button>
                    <span className="text-ink/55"> — rates and benchmark</span>
                  </li>
                ) : null}
                {canExpense ? (
                  <li>
                    <button
                      type="button"
                      onClick={() => setTab("expense-config")}
                      className="font-medium text-civic-navy hover:underline"
                    >
                      Car &amp; Housing
                    </button>
                    <span className="text-ink/55"> — expense defaults</span>
                  </li>
                ) : null}
                {canField ? (
                  <li>
                    <button
                      type="button"
                      onClick={() => setTab("field-ops")}
                      className="font-medium text-civic-navy hover:underline"
                    >
                      Field Operations
                    </button>
                    <span className="text-ink/55"> — offices and field settings</span>
                  </li>
                ) : null}
              </ul>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center">Loading admin…</div>}>
      <AdminContent />
    </Suspense>
  );
}
