"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { getBenchmark, getHoldPct } from "@/lib/api/live";
import { useDemoSession } from "@/lib/demo-session";
import { canManageUsers } from "@/lib/access";
import { canAccessFieldOps, canAccessPayRates } from "@/lib/navigation";

const tools = [
  {
    href: "/directory",
    title: "Employee directory",
    description: "Create and edit people, invites, and wages.",
    show: (role: string) => canManageUsers(role as never),
  },
  {
    href: "/admin/teams",
    title: "Teams",
    description: "Assign petitioners and canvassers to team leads.",
    show: (role: string) => canManageUsers(role as never),
  },
  {
    href: "/admin/pay-rates",
    title: "Pay rates",
    description: "Rates, validity benchmark, and hold percent.",
    show: (role: string) => canAccessPayRates(role as never),
  },
  {
    href: "/admin/field-ops",
    title: "Housing & cars",
    description: "Assign stays and rental cars.",
    show: (role: string) => canAccessFieldOps(role as never),
  },
  {
    href: "/admin/clock",
    title: "Clock breadcrumbs",
    description: "GPS clock-in paths on the map.",
    show: () => true,
  },
  {
    href: "/imports",
    title: "Imports",
    description: "Employee roster and collection uploads.",
    show: (role: string) => canManageUsers(role as never) || canAccessPayRates(role as never),
  },
] as const;

function AdminOverview() {
  const { user } = useDemoSession();
  const router = useRouter();
  const params = useSearchParams();
  const [benchmark, setBenchmark] = useState(75);
  const [holdPct, setHoldPct] = useState(15);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const tab = params.get("tab");
    if (tab === "pay-rates") router.replace("/admin/pay-rates");
    if (tab === "field-ops") router.replace("/admin/field-ops");
    if (tab === "expense-config") router.replace("/admin");
  }, [params, router]);

  useEffect(() => {
    void Promise.all([getBenchmark(), getHoldPct()])
      .then(([bench, hold]) => {
        setBenchmark(bench);
        setHoldPct(hold);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load admin data."))
      .finally(() => setLoading(false));
  }, []);

  if (!user) return null;

  const visibleTools = tools.filter((t) => t.show(user.role));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Configuration"
        title="Admin overview"
        description="Shortcuts into configuration tools. The same destinations are in the sidebar."
      />
      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
      {loading ? <p className="text-sm text-ink/55">Loading…</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardBody>
            <p className="text-xs uppercase tracking-[0.2em] text-ink/50">Benchmark %</p>
            <p className="font-display text-4xl tabular-nums">{benchmark}%</p>
            <Link href="/admin/pay-rates" className="mt-3 inline-block text-sm text-civic-navy hover:underline">
              Edit in pay rates
            </Link>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs uppercase tracking-[0.2em] text-ink/50">Hold %</p>
            <p className="font-display text-4xl tabular-nums">{holdPct}%</p>
            <p className="mt-1 text-sm text-ink/55">Live pay {100 - holdPct}%</p>
            <Link href="/admin/pay-rates" className="mt-3 inline-block text-sm text-civic-navy hover:underline">
              Edit in pay rates
            </Link>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {visibleTools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="flex items-center justify-between rounded-2xl border border-ink/10 bg-white/70 px-5 py-4 transition hover:border-brass/30 hover:bg-brass/5"
          >
            <div>
              <p className="text-sm font-medium text-ink">{tool.title}</p>
              <p className="mt-1 text-xs text-ink/55">{tool.description}</p>
            </div>
            <ArrowRight size={16} className="shrink-0 text-ink/35" />
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center">Loading admin…</div>}>
      <AdminOverview />
    </Suspense>
  );
}
