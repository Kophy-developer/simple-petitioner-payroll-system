"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useDemoSession } from "@/lib/demo-session";
import {
  canApproveLoans,
  canAccessMoneyScreens,
  canRunPayroll,
  canUploadValidity,
  canViewAllLedgers,
  isFieldRole,
  isTeamLead,
} from "@/lib/access";
import { getNavForRole } from "@/lib/navigation";
import { formatCurrency } from "@/lib/format";
import {
  authUserId,
  countPendingLoans,
  getExpenseBalance,
  listIssues,
  listNegativeBalanceUsers,
  listSubmissions,
  listValidity,
  type PayrollBalance,
} from "@/lib/api/live";
import { MyRentalCarCard } from "@/components/field-ops/my-rental-car-card";

const emptyBalance: PayrollBalance = {
  totalPay: 0,
  totalUpfront: 0,
  totalHold: 0,
  totalExpenses: 0,
  liveBalance: 0,
};

export default function DashboardPage() {
  const { user } = useDemoSession();
  const [pendingLoans, setPendingLoans] = useState(0);
  const [negativeCount, setNegativeCount] = useState(0);
  const [balance, setBalance] = useState<PayrollBalance>(emptyBalance);
  const [issueCount, setIssueCount] = useState(0);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [validityCount, setValidityCount] = useState(0);
  const [issuesAwaitingValidity, setIssuesAwaitingValidity] = useState(0);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      if (canAccessMoneyScreens(user.role)) {
        const bal = await getExpenseBalance(authUserId(user));
        setBalance(bal);
      } else {
        setBalance(emptyBalance);
      }

      if (canViewAllLedgers(user.role) || canUploadValidity(user.role) || isTeamLead(user.role)) {
        const [issues, submissions, validity] = await Promise.all([
          listIssues(),
          listSubmissions(),
          canUploadValidity(user.role) ? listValidity() : Promise.resolve([]),
        ]);
        setIssueCount(issues.length);
        setSubmissionCount(submissions.length);
        setValidityCount(validity.length);
        setIssuesAwaitingValidity(
          issues.filter((issue) => !validity.some((v) => v.issueId === issue.id)).length,
        );
      }

      if (canApproveLoans(user.role)) {
        setPendingLoans(await countPendingLoans());
      }
      if (canViewAllLedgers(user.role)) {
        const negative = await listNegativeBalanceUsers();
        setNegativeCount(negative.length);
      }
    } catch {
      setBalance(emptyBalance);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user) return null;

  const nav = getNavForRole(user.role).filter((n) => n.href !== "/dashboard");

  const alerts = [
    canApproveLoans(user.role) && pendingLoans > 0
      ? { label: `${pendingLoans} loan requests pending`, href: "/loans", tone: "warning" as const }
      : null,
    canViewAllLedgers(user.role) && negativeCount > 0
      ? { label: `${negativeCount} circulator(s) with negative balance`, href: "/payroll", tone: "danger" as const }
      : null,
    balance.liveBalance < 0 && canAccessMoneyScreens(user.role)
      ? { label: "Your live balance is negative", href: "/payroll", tone: "danger" as const }
      : null,
  ].filter(Boolean) as { label: string; href: string; tone: "warning" | "danger" }[];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Overview"
        title={`Welcome, ${user.firstName}`}
        description="Overview and shortcuts."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {canViewAllLedgers(user.role) ? (
          <>
            <StatCard label="Open issues" value={String(issueCount)} />
            <StatCard label="Submissions" value={String(submissionCount)} />
            {canApproveLoans(user.role) ? (
              <StatCard
                label="Pending loans"
                value={String(pendingLoans)}
                tone={pendingLoans ? "warning" : "default"}
              />
            ) : null}
            <StatCard
              label="Negative balances"
              value={String(negativeCount)}
              tone={negativeCount ? "danger" : "default"}
              hint={canViewAllLedgers(user.role) ? "Global alert for Super Admin" : undefined}
            />
          </>
        ) : null}

        {canAccessMoneyScreens(user.role) && isFieldRole(user.role) ? (
          <>
            <StatCard
              label="Live balance"
              value={formatCurrency(balance.liveBalance)}
              tone={balance.liveBalance < 0 ? "danger" : "success"}
            />
            <StatCard label="Hold balance" value={formatCurrency(balance.totalHold)} />
            <StatCard label="Total pay (YTD)" value={formatCurrency(balance.totalPay)} />
            <StatCard label="Expenses (YTD)" value={formatCurrency(balance.totalExpenses)} />
          </>
        ) : null}

        {isTeamLead(user.role) ? (
          <>
            <StatCard label="Open issues" value={String(issueCount)} />
            <StatCard label="Team submissions" value={String(submissionCount)} />
          </>
        ) : null}

        {canUploadValidity(user.role) ? (
          <>
            <StatCard label="Validity records" value={String(validityCount)} />
            <StatCard
              label="Issues awaiting validity"
              value={String(issuesAwaitingValidity)}
              tone={issuesAwaitingValidity ? "warning" : "default"}
            />
            <StatCard label="Open issues" value={String(issueCount)} />
            <StatCard label="Manual entries" value={String(validityCount)} />
          </>
        ) : null}
      </div>

      {canRunPayroll(user.role) ? (
        <Link
          href="/payroll?tab=payments"
          className="flex items-center justify-between rounded-2xl border border-brass/30 bg-brass/10 px-5 py-4 transition hover:bg-brass/15"
        >
          <div>
            <p className="text-sm font-medium text-ink">Payments & disbursements</p>
            <p className="text-xs text-ink/55">Record paystubs, advances, and funds-hit dates anytime</p>
          </div>
          <ArrowRight size={16} className="text-ink/40" />
        </Link>
      ) : null}

      <MyRentalCarCard />

      {alerts.length > 0 ? (
        <div className="grid gap-3">
          {alerts.map((alert) => (
            <Link
              key={alert.href + alert.label}
              href={alert.href}
              className="flex items-center justify-between rounded-2xl border border-ink/10 bg-white/70 px-5 py-4 transition hover:border-brass/30"
            >
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
        <CardHeader>
          <h2 className="font-display text-xl text-ink">Quick links</h2>
        </CardHeader>
        <CardBody className="grid gap-2 sm:grid-cols-2">
          {nav.slice(0, 8).map((item) => (
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
    </div>
  );
}
