"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useDemoSession } from "@/lib/demo-session";
import {
  circulators,
  getPayrollSummary,
  issues,
  ledgerRows,
  loanRequests,
  submissions,
} from "@/lib/demo-data";
import { getNavForRole } from "@/lib/navigation";
import { formatCurrency } from "@/lib/format";

export default function DashboardPage() {
  const { user } = useDemoSession();
  if (!user) return null;

  const nav = getNavForRole(user.role).filter((n) => n.href !== "/dashboard");
  const payroll =
    user.circulatorId ? getPayrollSummary(user.circulatorId) : null;
  const pendingLoans = loanRequests.filter((l) => l.status === "pending").length;
  const pendingValidity = ledgerRows.filter((l) => l.validityPending).length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Overview"
        title={`Good afternoon, ${user.name.split(" ")[0]}`}
        description="Live demo data across collection, validity, ledger, and payroll workflows."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active Issues" value={String(issues.length)} />
        <StatCard label="Circulators" value={String(circulators.filter((c) => c.status === "active").length)} />
        <StatCard
          label="Submissions"
          value={String(submissions.length)}
          hint="Across all open drives"
        />
        {user.role === "circulator" && payroll ? (
          <StatCard
            label="Payroll Balance"
            value={formatCurrency(payroll.balance)}
            tone={payroll.balance < 0 ? "danger" : "success"}
            hint={payroll.balance < 0 ? "Flagged for review" : "Upfront minus expenses"}
          />
        ) : (
          <StatCard
            label="Pending Loans"
            value={String(pendingLoans)}
            hint="Awaiting Super Admin action"
            tone={pendingLoans > 0 ? "warning" : "default"}
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="font-display text-xl text-ink">Quick navigation</h2>
          </CardHeader>
          <CardBody className="grid gap-2">
            {nav.slice(0, 6).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between rounded-xl border border-ink/8 px-4 py-3 transition hover:border-brass/30 hover:bg-brass/5"
              >
                <span className="text-sm font-medium text-ink">{item.label}</span>
                <ArrowRight size={16} className="text-ink/40" />
              </Link>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-display text-xl text-ink">Operational signals</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-warning/8 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-ink">Validity pending</p>
                <p className="text-xs text-ink/55">
                  Ledger rows waiting on audit upload
                </p>
              </div>
              <Badge tone="warning">{pendingValidity}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-civic-navy/8 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-ink">Open issues</p>
                <p className="text-xs text-ink/55">Active petition drives</p>
              </div>
              <Badge tone="navy">{issues.length}</Badge>
            </div>
            {user.role !== "circulator" ? (
              <div className="flex items-center justify-between rounded-xl bg-danger/8 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">Negative balances</p>
                  <p className="text-xs text-ink/55">Circulators over upfront draw</p>
                </div>
                <Badge tone="danger">1</Badge>
              </div>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
