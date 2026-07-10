"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useDemoSession } from "@/lib/demo-session";
import { canApproveLoans, canUploadValidity, canViewAllLedgers } from "@/lib/access";
import {
  getNegativeBalanceUsers,
  getPayrollBalance,
  issues,
  loanRequests,
  submissions,
  validityRecords,
} from "@/lib/demo-data";
import { getNavForRole } from "@/lib/navigation";
import { formatCurrency } from "@/lib/format";

export default function DashboardPage() {
  const { user } = useDemoSession();
  if (!user) return null;

  const nav = getNavForRole(user.role).filter((n) => n.href !== "/dashboard" && !n.comingSoon);
  const balance = getPayrollBalance(user.id);
  const pendingLoans = loanRequests.filter((l) => l.status === "pending").length;
  const negativeUsers = getNegativeBalanceUsers();
  const issuesAwaitingValidity = issues.filter(
    (issue) => !validityRecords.some((v) => v.issueId === issue.id),
  ).length;

  const alerts = [
    canApproveLoans(user.role) && pendingLoans > 0
      ? { label: `${pendingLoans} loan requests pending`, href: "/loans", tone: "warning" as const }
      : null,
    canViewAllLedgers(user.role) && negativeUsers.length > 0
      ? { label: `${negativeUsers.length} circulator(s) with negative balance`, href: "/payroll", tone: "danger" as const }
      : null,
    balance.liveBalance < 0 && (user.role === "petitioner" || user.role === "canvasser")
      ? { label: "Your live balance is negative", href: "/payroll", tone: "danger" as const }
      : null,
  ].filter(Boolean) as { label: string; href: string; tone: "warning" | "danger" }[];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Overview"
        title={`Welcome, ${user.firstName}`}
        description="Phase 1 workspace — collection, validity, ledger, and payroll."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {canViewAllLedgers(user.role) || user.role === "team_lead" ? (
          <>
            <StatCard label="Open issues" value={String(issues.length)} />
            <StatCard label="Submissions" value={String(submissions.length)} />
            {canApproveLoans(user.role) ? (
              <StatCard label="Pending loans" value={String(pendingLoans)} tone={pendingLoans ? "warning" : "default"} />
            ) : (
              <StatCard label="Team submissions" value={String(submissions.filter((s) => user.teamMemberIds?.includes(s.userId)).length)} />
            )}
            <StatCard
              label="Negative balances"
              value={String(negativeUsers.length)}
              tone={negativeUsers.length ? "danger" : "default"}
              hint={canViewAllLedgers(user.role) ? "Global alert for Super Admin" : undefined}
            />
          </>
        ) : null}

        {(user.role === "petitioner" || user.role === "canvasser") ? (
          <>
            <StatCard label="Live balance" value={formatCurrency(balance.liveBalance)} tone={balance.liveBalance < 0 ? "danger" : "success"} />
            <StatCard label="Hold balance" value={formatCurrency(balance.totalHold)} />
            <StatCard label="Total pay (MTD)" value={formatCurrency(balance.totalPay)} />
            <StatCard label="Expenses (MTD)" value={formatCurrency(balance.totalExpenses)} />
          </>
        ) : null}

        {canUploadValidity(user.role) && user.role === "validator" ? (
          <>
            <StatCard label="Validity records" value={String(validityRecords.length)} />
            <StatCard label="Issues awaiting validity" value={String(issuesAwaitingValidity)} tone={issuesAwaitingValidity ? "warning" : "default"} />
            <StatCard label="Open issues" value={String(issues.length)} />
            <StatCard label="Recent uploads" value="3" hint="Demo count this week" />
          </>
        ) : null}

        {user.role === "account_admin" && !canApproveLoans(user.role) ? null : null}
      </div>

      {canViewAllLedgers(user.role) ? (
        <Link href="/payroll/monthly" className="flex items-center justify-between rounded-2xl border border-brass/30 bg-brass/10 px-5 py-4 transition hover:bg-brass/15">
          <div>
            <p className="text-sm font-medium text-ink">Monthly payroll generation</p>
            <p className="text-xs text-ink/55">Preview, generate, and lock payroll records</p>
          </div>
          <ArrowRight size={16} className="text-ink/40" />
        </Link>
      ) : null}

      {alerts.length > 0 ? (
        <div className="grid gap-3">
          {alerts.map((alert) => (
            <Link key={alert.href + alert.label} href={alert.href} className="flex items-center justify-between rounded-2xl border border-ink/10 bg-white/70 px-5 py-4 transition hover:border-brass/30">
              <div className="flex items-center gap-3">
                <Badge tone={alert.tone}>Action needed</Badge>
                <span className="text-sm font-medium text-ink">{alert.label}</span>
              </div>
              <ArrowRight size={16} className="text-ink/40" />
            </Link>
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader><h2 className="font-display text-xl text-ink">Quick links</h2></CardHeader>
        <CardBody className="grid gap-2 sm:grid-cols-2">
          {nav.slice(0, 8).map((item) => (
            <Link key={item.href} href={item.href} className="flex items-center justify-between rounded-xl border border-ink/8 px-4 py-3 transition hover:border-brass/30 hover:bg-brass/5">
              <span className="text-sm font-medium text-ink">{item.label}</span>
              <ArrowRight size={16} className="text-ink/40" />
            </Link>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
