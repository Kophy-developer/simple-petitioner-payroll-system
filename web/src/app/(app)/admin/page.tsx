"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { PayRatesPanel } from "@/components/admin/pay-rates-panel";
import { getBenchmark, getHoldPct } from "@/lib/api/live";
import { useDemoSession } from "@/lib/demo-session";
import {
  canAccessFieldOps,
  canAccessPayRates,
} from "@/lib/navigation";

type AdminTab = "overview" | "pay-rates";

function AdminContent() {
  const { user } = useDemoSession();
  const router = useRouter();
  const params = useSearchParams();
  const [benchmark, setBenchmark] = useState(75);
  const [holdPct, setHoldPct] = useState(15);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const canPayRates = user ? canAccessPayRates(user.role) : false;
  const canField = user ? canAccessFieldOps(user.role) : false;

  useEffect(() => {
    if (params.get("tab") === "field-ops") {
      router.replace("/payroll?tab=housing-cars");
    }
    if (params.get("tab") === "expense-config") {
      router.replace("/admin");
    }
  }, [params, router]);

  const requested = params.get("tab");
  const tab: AdminTab =
    requested === "pay-rates" && canPayRates ? "pay-rates" : "overview";

  useEffect(() => {
    if (tab !== "overview") {
      setLoading(false);
      return;
    }
    void Promise.all([getBenchmark(), getHoldPct()])
      .then(([bench, hold]) => {
        setBenchmark(bench);
        setHoldPct(hold);
      })
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

  const title = tab === "pay-rates" ? "Pay Rates" : "Admin Panel";
  const description =
    tab === "pay-rates"
      ? "Set pay rates, benchmark, and hold percent."
      : "System settings and shortcuts.";

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
          </div>
        }
      />

      {tab === "pay-rates" ? (
        <PayRatesPanel />
      ) : (
        <>
          {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
          {loading ? <p className="text-sm text-ink/55">Loading…</p> : null}

          <div className="grid gap-4 sm:grid-cols-2">
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
            <Card className="max-w-sm">
              <CardBody>
                <p className="text-xs uppercase tracking-[0.2em] text-ink/50">Hold %</p>
                <p className="font-display text-4xl tabular-nums">{holdPct}%</p>
                <p className="mt-1 text-sm text-ink/55">Live pay {100 - holdPct}%</p>
                {user.role === "super_admin" ? (
                  <button
                    type="button"
                    onClick={() => setTab("pay-rates")}
                    className="mt-3 inline-block text-sm text-civic-navy hover:underline"
                  >
                    Edit hold percent
                  </button>
                ) : null}
              </CardBody>
            </Card>
          </div>

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
                    <span className="text-ink/55"> — rates, benchmark, and hold</span>
                  </li>
                ) : null}
                {canField ? (
                  <li>
                    <Link
                      href="/payroll?tab=housing-cars"
                      className="font-medium text-civic-navy hover:underline"
                    >
                      Housing &amp; cars
                    </Link>
                    <span className="text-ink/55"> — assign stays and rentals</span>
                  </li>
                ) : null}
                <li>
                  <Link href="/admin/clock" className="font-medium text-civic-navy hover:underline">
                    Clock breadcrumbs
                  </Link>
                  <span className="text-ink/55"> — GPS clock-in paths on Mapbox</span>
                </li>
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
