"use client";

import Link from "next/link";
import { ArrowRight, Clock, MapPin, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useDemoSession } from "@/lib/demo-session";
import { canApproveLoans, canApproveTurnIns, canViewAllLedgers } from "@/lib/access";
import { conversations, getPayrollBalance, issues, loanRequests, liveClockUsers, submissions, turnIns } from "@/lib/demo-data";
import { getNavForRole } from "@/lib/navigation";
import { formatCurrency } from "@/lib/format";

export default function DashboardPage() {
  const { user } = useDemoSession();
  if (!user) return null;

  const nav = getNavForRole(user.role).filter((n) => n.href !== "/dashboard");
  const balance = getPayrollBalance(user.id);
  const pendingTurnIns = turnIns.filter((t) => t.status === "pending").length;
  const pendingLoans = loanRequests.filter((l) => l.status === "pending").length;
  const unread = conversations.reduce((s, c) => s + c.unread, 0);
  const showClock = ["account_admin", "team_lead", "petitioner", "canvasser"].includes(user.role);

  const alerts = [
    canApproveTurnIns(user.role) && pendingTurnIns > 0 ? { label: `${pendingTurnIns} turn-ins awaiting approval`, href: "/turnins", tone: "warning" as const } : null,
    canApproveLoans(user.role) && pendingLoans > 0 ? { label: `${pendingLoans} loan requests pending`, href: "/loans", tone: "warning" as const } : null,
    balance.liveBalance < 0 && user.role === "petitioner" ? { label: "Negative live balance flagged", href: "/payroll", tone: "danger" as const } : null,
  ].filter(Boolean) as { label: string; href: string; tone: "warning" | "danger" }[];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Overview"
        title={`Welcome, ${user.firstName}`}
        description="Role-aware snapshot of what needs your attention today."
        actions={showClock ? <Link href="/clock"><Button><Clock size={16} /> Clock in</Button></Link> : null}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open issues" value={String(issues.length)} />
        <StatCard label="Submissions" value={String(submissions.length)} />
        {canViewAllLedgers(user.role) ? (
          <StatCard label="Pending turn-ins" value={String(pendingTurnIns)} tone={pendingTurnIns ? "warning" : "default"} />
        ) : (
          <StatCard label="Live balance" value={formatCurrency(balance.liveBalance)} tone={balance.liveBalance < 0 ? "danger" : "success"} />
        )}
        <StatCard label="Unread messages" value={String(unread)} hint="Tap Messaging to reply" />
      </div>

      {alerts.length > 0 ? (
        <div className="grid gap-3">
          {alerts.map((alert) => (
            <Link key={alert.href} href={alert.href} className="flex items-center justify-between rounded-2xl border border-ink/10 bg-white/70 px-5 py-4 transition hover:border-brass/30">
              <div className="flex items-center gap-3">
                <Badge tone={alert.tone}>Action needed</Badge>
                <span className="text-sm font-medium text-ink">{alert.label}</span>
              </div>
              <ArrowRight size={16} className="text-ink/40" />
            </Link>
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><h2 className="font-display text-xl text-ink">Quick links</h2></CardHeader>
          <CardBody className="grid gap-2">
            {nav.slice(0, 7).map((item) => (
              <Link key={item.href} href={item.href} className="flex items-center justify-between rounded-xl border border-ink/8 px-4 py-3 transition hover:border-brass/30 hover:bg-brass/5">
                <span className="text-sm font-medium text-ink">{item.label}</span>
                <ArrowRight size={16} className="text-ink/40" />
              </Link>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader><h2 className="font-display text-xl text-ink">Field activity</h2></CardHeader>
          <CardBody className="space-y-4">
            {canViewAllLedgers(user.role) || user.role === "team_lead" ? (
              <Link href="/gps" className="flex items-center justify-between rounded-xl bg-civic-navy/8 px-4 py-3">
                <div className="flex items-center gap-3"><MapPin size={18} className="text-civic-navy" /><span className="text-sm font-medium text-ink">{liveClockUsers.length} live GPS sessions</span></div>
                <ArrowRight size={16} className="text-ink/40" />
              </Link>
            ) : null}
            <Link href="/messages" className="flex items-center justify-between rounded-xl bg-brass/10 px-4 py-3">
              <div className="flex items-center gap-3"><MessageSquare size={18} className="text-ink" /><span className="text-sm font-medium text-ink">{unread} unread conversations</span></div>
              <ArrowRight size={16} className="text-ink/40" />
            </Link>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
