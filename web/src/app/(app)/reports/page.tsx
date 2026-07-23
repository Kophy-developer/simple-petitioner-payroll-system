"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { FileDown } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardBody } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { formatDate } from "@/lib/format";
import { getProfile, listIssues, listSubmissions } from "@/lib/api/live";
import type { Issue, Submission } from "@/lib/types";

function ReportContent() {
  const params = useSearchParams();
  const selectedIssueId = params.get("issue");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [rows, setRows] = useState<Submission[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [issueId, setIssueId] = useState(selectedIssueId ?? "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const issueRows = await listIssues();
      setIssues(issueRows);
      const nextId =
        (selectedIssueId && issueRows.some((i) => i.id === selectedIssueId)
          ? selectedIssueId
          : null) ??
        issueRows[0]?.id ??
        "";
      setIssueId(nextId);
      if (!nextId) {
        setRows([]);
        return;
      }
      const submissions = await listSubmissions(nextId);
      setRows(submissions);
      const unique = [...new Set(submissions.map((s) => s.userId))];
      const entries = await Promise.all(
        unique.map(async (id) => {
          const profile = await getProfile(id);
          return [id, profile ? `${profile.firstName} ${profile.lastName}` : "Unknown"] as const;
        }),
      );
      setNames(Object.fromEntries(entries));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load report.");
    } finally {
      setLoading(false);
    }
  }, [selectedIssueId]);

  useEffect(() => {
    void load();
  }, [load]);

  const issue = issues.find((i) => i.id === issueId);
  const totals = rows.reduce(
    (a, r) => ({
      raw: a.raw + r.rawSignatures,
      pages: a.pages + r.pageNumbers,
      ps: a.ps + r.pooledSignatures,
      pp: a.pp + r.pooledPages,
    }),
    { raw: 0, pages: 0, ps: 0, pp: 0 },
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Collection"
        title="Issue Report"
        description="Preview and print reports."
        actions={
          <div className="flex flex-wrap items-end gap-3 print:hidden">
            <div className="w-48 space-y-2">
              <Label>Issue</Label>
              <Select
                value={issueId}
                onChange={(e) => {
                  window.location.href = `/reports?issue=${e.target.value}`;
                }}
              >
                {issues.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.issueNumber}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              type="button"
              onClick={() => {
                const label = issues.find((i) => i.id === issueId)?.issueNumber ?? "report";
                const previous = document.title;
                document.title = `Issue Report — ${label}`;
                window.print();
                document.title = previous;
              }}
            >
              <FileDown size={16} /> Print / PDF
            </Button>
          </div>
        }
      />
      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
      {loading ? <p className="text-sm text-ink/55">Loading…</p> : null}
      {!loading && !issue ? (
        <p className="text-sm text-ink/55">No issues available.</p>
      ) : null}
      {issue ? (
        <Card className="overflow-hidden">
          <CardBody className="space-y-8 p-8">
            <div className="flex flex-wrap justify-between gap-6 border-b border-ink/10 pb-8">
              <div className="flex gap-4">
                <Image
                  src="/brand/logo.svg"
                  alt="Logo"
                  width={64}
                  height={64}
                  className="rounded-xl bg-ink p-2"
                />
                <div className="text-sm text-ink/70">
                  <p>Validated by: {issue.validatedBy || "—"}</p>
                  <p>State: {issue.state}</p>
                  <p>
                    Turn-in: {issue.turnInDate ? formatDate(issue.turnInDate) : "—"}
                    {issue.turnInNumber ? ` · ${issue.turnInNumber}` : ""}
                  </p>
                </div>
              </div>
              <p className="font-display text-2xl text-ink">{issue.issueNumber}</p>
            </div>
            <div>
              <h2 className="font-display text-3xl text-ink">{issue.name}</h2>
              <DataTable className="mt-6">
                <thead>
                  <tr>
                    <Th>Circulator</Th>
                    <Th align="right">Raw SIGs</Th>
                    <Th align="right">Pages</Th>
                    <Th align="right">Pooled SIGs</Th>
                    <Th align="right">Pooled Pages</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/8">
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <Td>{names[row.userId] ?? "Unknown"}</Td>
                      <Td align="right">{row.rawSignatures}</Td>
                      <Td align="right">{row.pageNumbers}</Td>
                      <Td align="right">{row.pooledSignatures}</Td>
                      <Td align="right">{row.pooledPages}</Td>
                    </tr>
                  ))}
                  <tr className="bg-ink/[0.04] font-semibold">
                    <Td>Total</Td>
                    <Td align="right">{totals.raw}</Td>
                    <Td align="right">{totals.pages}</Td>
                    <Td align="right">{totals.ps}</Td>
                    <Td align="right">{totals.pp}</Td>
                  </tr>
                </tbody>
              </DataTable>
            </div>
            <Link href="/collection" className="text-sm text-civic-navy hover:underline print:hidden">
              Back to collection table
            </Link>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-ink/50">Loading report…</div>}>
      <ReportContent />
    </Suspense>
  );
}
