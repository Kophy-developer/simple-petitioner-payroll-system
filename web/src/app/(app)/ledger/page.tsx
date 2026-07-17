"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { useDemoSession } from "@/lib/demo-session";
import { canViewAllLedgers, isFieldRole } from "@/lib/access";
import { payModelLabel } from "@/lib/payroll";
import { formatCurrency, formatDateTime, formatPercent } from "@/lib/format";
import {
  authUserId,
  listIssues,
  listLedger,
  listLedgerOverview,
  listProfiles,
  type LedgerOverviewRow,
} from "@/lib/api/live";
import type { DemoUser, Issue, LedgerRow } from "@/lib/types";

const PAGE_SIZE = 50;

function canUseOverview(role: DemoUser["role"]) {
  return canViewAllLedgers(role);
}

function LedgerContent() {
  const { user } = useDemoSession();
  const router = useRouter();
  const params = useSearchParams();

  const queryView = params.get("view");
  const queryUser = params.get("user");
  const queryQ = params.get("q") ?? "";
  const queryIssue = params.get("issue") ?? "";
  const queryPending = params.get("pending") === "1";
  const queryPage = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);

  const multiUser = !!user && canUseOverview(user.role);
  const view: "all" | "individual" = !multiUser
    ? "individual"
    : queryView === "all"
      ? "all"
      : queryView === "individual" || (!!queryUser && queryView !== "all")
        ? "individual"
        : "all";

  const [profiles, setProfiles] = useState<DemoUser[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [overview, setOverview] = useState<LedgerOverviewRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [searchDraft, setSearchDraft] = useState(queryQ);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setSearchDraft(queryQ);
  }, [queryQ]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (searchDraft === queryQ) return;
      const next = new URLSearchParams(params.toString());
      next.set("view", "all");
      next.set("page", "1");
      if (searchDraft.trim()) next.set("q", searchDraft.trim());
      else next.delete("q");
      router.replace(`/ledger?${next.toString()}`);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [searchDraft, queryQ, params, router]);

  const loadMeta = useCallback(async () => {
    if (!user) return [] as DemoUser[];
    const locked = isFieldRole(user.role);
    const [people, issueRows] = await Promise.all([
      locked ? Promise.resolve([user]) : listProfiles(),
      listIssues(),
    ]);
    setIssues(issueRows);
    const picker = locked
      ? people
      : people.filter((p) => ["petitioner", "canvasser"].includes(p.role));
    const next = picker.length ? picker : people;
    setProfiles(next);
    return next;
  }, [user]);

  const loadOverview = useCallback(async () => {
    if (!user || view !== "all") return;
    setLoading(true);
    setError("");
    try {
      const result = await listLedgerOverview({
        q: queryQ,
        issueId: queryIssue || null,
        pendingOnly: queryPending,
        limit: PAGE_SIZE,
        offset: (queryPage - 1) * PAGE_SIZE,
      });
      setOverview(result.rows);
      setTotalCount(result.totalCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load ledger overview.");
      setOverview([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [user, view, queryQ, queryIssue, queryPending, queryPage]);

  const loadIndividual = useCallback(async () => {
    if (!user || view !== "individual") return;
    setLoading(true);
    setError("");
    try {
      const picker = await loadMeta();
      const locked = isFieldRole(user.role);
      const target = locked
        ? authUserId(user)
        : queryUser && picker.some((p) => p.id === queryUser)
          ? queryUser
          : picker[0]?.id ?? authUserId(user);

      setSelectedId(target);
      setRows(await listLedger(target));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load ledger.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [user, view, queryUser, loadMeta]);

  useEffect(() => {
    if (!user) return;
    void listIssues().then(setIssues).catch(() => setIssues([]));
  }, [user]);

  useEffect(() => {
    if (view === "all") void loadOverview();
    else void loadIndividual();
  }, [view, loadOverview, loadIndividual]);

  if (!user) return null;

  function setView(next: "all" | "individual", userId?: string) {
    const nextParams = new URLSearchParams();
    nextParams.set("view", next);
    if (next === "individual") {
      const id = userId || selectedId || queryUser;
      if (id) nextParams.set("user", id);
    } else {
      if (queryQ) nextParams.set("q", queryQ);
      if (queryIssue) nextParams.set("issue", queryIssue);
      if (queryPending) nextParams.set("pending", "1");
      nextParams.set("page", "1");
    }
    router.push(`/ledger?${nextParams.toString()}`);
  }

  function updateAllFilters(patch: {
    issue?: string;
    pending?: boolean;
    page?: number;
  }) {
    const next = new URLSearchParams(params.toString());
    next.set("view", "all");
    if (patch.issue !== undefined) {
      if (patch.issue) next.set("issue", patch.issue);
      else next.delete("issue");
      next.set("page", "1");
    }
    if (patch.pending !== undefined) {
      if (patch.pending) next.set("pending", "1");
      else next.delete("pending");
      next.set("page", "1");
    }
    if (patch.page !== undefined) next.set("page", String(patch.page));
    router.replace(`/ledger?${next.toString()}`);
  }

  const subject = profiles.find((u) => u.id === selectedId) ?? user;
  const issueMap = Object.fromEntries(issues.map((i) => [i.id, i]));
  const grouped = rows.reduce<Record<string, LedgerRow[]>>((acc, row) => {
    (acc[row.issueId] ??= []).push(row);
    return acc;
  }, {});

  const sectionTotals = (issueRows: LedgerRow[]) => ({
    totalPay: issueRows.reduce((s, r) => s + (r.totalPay ?? 0), 0),
    upfront: issueRows.reduce((s, r) => s + (r.upfront ?? 0), 0),
    hold: issueRows.reduce((s, r) => s + (r.hold ?? 0), 0),
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pageStart = totalCount === 0 ? 0 : (queryPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(queryPage * PAGE_SIZE, totalCount);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Payroll"
        title="Circulator Ledger"
        description={
          view === "all"
            ? "Summary of all circulators you can view. Open a person for issue-level detail."
            : "Issue-sectioned pay loaded from the database."
        }
        actions={
          multiUser ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex rounded-full border border-ink/15 bg-white/70 p-1">
                <Button
                  size="sm"
                  variant={view === "all" ? "primary" : "ghost"}
                  className={view === "all" ? "" : "border-0 bg-transparent"}
                  onClick={() => setView("all")}
                >
                  All circulators
                </Button>
                <Button
                  size="sm"
                  variant={view === "individual" ? "primary" : "ghost"}
                  className={view === "individual" ? "" : "border-0 bg-transparent"}
                  onClick={() => setView("individual")}
                >
                  Individual
                </Button>
              </div>
              {view === "individual" ? (
                <div className="w-56 space-y-2">
                  <Label>User</Label>
                  <Select
                    value={selectedId}
                    onChange={(e) => setView("individual", e.target.value)}
                  >
                    {profiles.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}
            </div>
          ) : null
        }
      />

      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
      {loading ? <p className="text-sm text-ink/55">Loading ledger…</p> : null}

      {view === "all" ? (
        <>
          <Card>
            <CardBody className="flex flex-wrap items-end gap-4">
              <div className="min-w-[220px] flex-1 space-y-2">
                <Label htmlFor="ledger-search">Search</Label>
                <Input
                  id="ledger-search"
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  placeholder="Name or initials"
                />
              </div>
              <div className="w-48 space-y-2">
                <Label>Issue</Label>
                <Select
                  value={queryIssue}
                  onChange={(e) => updateAllFilters({ issue: e.target.value })}
                >
                  <option value="">All issues</option>
                  {issues.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.issueNumber}
                    </option>
                  ))}
                </Select>
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm text-ink/70">
                <input
                  type="checkbox"
                  checked={queryPending}
                  onChange={(e) => updateAllFilters({ pending: e.target.checked })}
                  className="rounded border-ink/20"
                />
                Pending validity only
              </label>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-0">
              <DataTable>
                <thead>
                  <tr>
                    <Th>Circulator</Th>
                    <Th align="right">Issues</Th>
                    <Th align="right">Pending</Th>
                    <Th align="right">SIGs</Th>
                    <Th align="right">Est. pay</Th>
                    <Th align="right">Total</Th>
                    <Th align="right">Upfront</Th>
                    <Th align="right">Hold</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/8 bg-white/50">
                  {overview.map((row) => (
                    <tr key={row.userId}>
                      <Td>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-civic-navy/10 text-[11px] font-semibold text-civic-navy">
                            {row.initials}
                          </span>
                          <span>
                            {row.firstName} {row.lastName}
                          </span>
                        </div>
                      </Td>
                      <Td align="right">{row.issueCount}</Td>
                      <Td align="right">
                        {row.pendingValidityCount > 0 ? (
                          <Badge tone="warning">{row.pendingValidityCount}</Badge>
                        ) : (
                          0
                        )}
                      </Td>
                      <Td align="right">{row.totalSigs}</Td>
                      <Td align="right">{formatCurrency(row.totalEstimatedPay)}</Td>
                      <Td align="right">{formatCurrency(row.totalPay)}</Td>
                      <Td align="right">{formatCurrency(row.totalUpfront)}</Td>
                      <Td align="right">{formatCurrency(row.totalHold)}</Td>
                      <Td>
                        <button
                          type="button"
                          className="text-sm font-medium text-civic-navy hover:underline"
                          onClick={() => setView("individual", row.userId)}
                        >
                          View
                        </button>
                      </Td>
                    </tr>
                  ))}
                  {!loading && overview.length === 0 ? (
                    <tr>
                      <Td colSpan={9}>
                        <p className="py-8 text-center text-sm text-ink/50">
                          No circulators match these filters.
                        </p>
                      </Td>
                    </tr>
                  ) : null}
                </tbody>
              </DataTable>
            </CardBody>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink/60">
            <p>
              {totalCount === 0
                ? "0 results"
                : `Showing ${pageStart}–${pageEnd} of ${totalCount}`}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={queryPage <= 1 || loading}
                onClick={() => updateAllFilters({ page: queryPage - 1 })}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={queryPage >= totalPages || loading}
                onClick={() => updateAllFilters({ page: queryPage + 1 })}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <h2 className="font-display text-2xl text-ink">
              {subject.firstName} {subject.lastName}
            </h2>
            <Badge tone="navy">{subject.initials}</Badge>
            {multiUser ? (
              <button
                type="button"
                className="text-sm text-civic-navy hover:underline"
                onClick={() => setView("all")}
              >
                Back to all
              </button>
            ) : null}
          </div>
          {Object.keys(grouped).length === 0 && !loading ? (
            <Card>
              <CardBody>
                <p className="text-sm text-ink/55">No ledger rows for this user yet.</p>
              </CardBody>
            </Card>
          ) : null}
          {Object.entries(grouped).map(([issueId, issueRows]) => {
            const issue = issueMap[issueId];
            const totals = sectionTotals(issueRows);
            return (
              <Card key={issueId}>
                <CardHeader className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-display text-xl text-ink">
                      {issue?.issueNumber ?? "Issue"}
                    </h3>
                    <span className="text-sm text-ink/55">{issue?.name}</span>
                    <Badge>{payModelLabel(issueRows[0].payModel)}</Badge>
                    {issueRows[0].validityPending ? (
                      <Badge tone="warning">Validity pending</Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-ink/45">
                    {issueRows[0].recalculatedAt
                      ? `Last recalculated ${formatDateTime(issueRows[0].recalculatedAt)}`
                      : "Not yet recalculated"}
                  </p>
                </CardHeader>
                <CardBody className="p-0">
                  <DataTable>
                    <thead>
                      <tr>
                        <Th align="right">SIGs</Th>
                        <Th align="right">Pay</Th>
                        <Th align="right">Est.</Th>
                        <Th align="right">DUPs</Th>
                        <Th align="right">Usable</Th>
                        <Th align="right">Valid</Th>
                        <Th align="right">Validity%</Th>
                        <Th align="right">Rate</Th>
                        <Th align="right">Payable</Th>
                        <Th align="right">Total</Th>
                        <Th align="right">Upfront</Th>
                        <Th align="right">Hold</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink/8 bg-white/50">
                      {issueRows.map((row) => (
                        <tr key={row.id}>
                          <Td align="right">{row.sigs}</Td>
                          <Td align="right">{formatCurrency(row.pay)}</Td>
                          <Td align="right">{formatCurrency(row.estimatedPay)}</Td>
                          <Td align="right">{row.dups ?? "—"}</Td>
                          <Td align="right">{row.usable ?? "—"}</Td>
                          <Td align="right">{row.valid ?? "—"}</Td>
                          <Td align="right">{formatPercent(row.validityPercent)}</Td>
                          <Td align="right">{formatCurrency(row.payRate)}</Td>
                          <Td align="right">{row.payable ?? "—"}</Td>
                          <Td align="right">{formatCurrency(row.totalPay)}</Td>
                          <Td align="right">{formatCurrency(row.upfront)}</Td>
                          <Td align="right">{formatCurrency(row.hold)}</Td>
                        </tr>
                      ))}
                      <tr className="bg-ink/[0.04] font-medium">
                        <Td highlight>Section total</Td>
                        <Td colSpan={8} />
                        <Td align="right" highlight>
                          {formatCurrency(totals.totalPay)}
                        </Td>
                        <Td align="right" highlight>
                          {formatCurrency(totals.upfront)}
                        </Td>
                        <Td align="right" highlight>
                          {formatCurrency(totals.hold)}
                        </Td>
                      </tr>
                    </tbody>
                  </DataTable>
                </CardBody>
              </Card>
            );
          })}
        </>
      )}

      <Link href="/directory" className="text-sm text-civic-navy hover:underline">
        Employee directory
      </Link>
    </div>
  );
}

export default function LedgerPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center">Loading ledger…</div>}>
      <LedgerContent />
    </Suspense>
  );
}
