"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileDown } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardBody } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { getProfile, listIssues, listSubmissions } from "@/lib/api/live";
import type { DemoUser, Issue, Submission } from "@/lib/types";
import { ledgerIndividualHref } from "@/lib/ledger-person";

export default function CollectionPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [issueId, setIssueId] = useState("");
  const [rows, setRows] = useState<Submission[]>([]);
  const [people, setPeople] = useState<Record<string, DemoUser>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const issueRows = await listIssues();
      setIssues(issueRows);
      const activeIssue = issueId || issueRows[0]?.id || "";
      if (!issueId && activeIssue) setIssueId(activeIssue);
      if (!activeIssue) {
        setRows([]);
        return;
      }
      const submissions = await listSubmissions(activeIssue);
      setRows(submissions);
      const unique = [...new Set(submissions.map((s) => s.userId))];
      const entries = await Promise.all(
        unique.map(async (id) => {
          const profile = await getProfile(id);
          return [id, profile] as const;
        }),
      );
      setPeople(
        Object.fromEntries(entries.filter(([, profile]) => profile) as [string, DemoUser][]),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load collection.");
    } finally {
      setLoading(false);
    }
  }, [issueId]);

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
        title="Master Collection Table"
        description="View submission totals by issue."
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-56 space-y-2">
              <Label>Issue</Label>
              <Select value={issueId} onChange={(e) => setIssueId(e.target.value)}>
                {issues.map((i) => (
                  <option key={i.id} value={i.id}>{i.issueNumber}</option>
                ))}
              </Select>
            </div>
            <Link href={`/reports?issue=${issueId}`}>
              <Button><FileDown size={16} /> Export PDF</Button>
            </Link>
          </div>
        }
      />

      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
      {loading ? <p className="text-sm text-ink/55">Loading collection…</p> : null}

      <Card>
        <CardBody className="space-y-4 p-0">
          <div className="border-b border-ink/10 px-6 py-4">
            <h2 className="font-display text-2xl text-ink">{issue?.issueNumber ?? "Issue"}</h2>
            <p className="text-sm text-ink/60">{issue?.name}</p>
          </div>
          <DataTable>
            <thead>
              <tr>
                <Th>Circulator</Th>
                <Th align="right">Raw SIGs</Th>
                <Th align="right">Pages</Th>
                <Th align="right">Pooled SIGs</Th>
                <Th align="right">Pooled Pages</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8 bg-white/50">
              {rows.map((row) => {
                const u = people[row.userId];
                return (
                  <tr key={row.id}>
                    <Td>
                      <Link
                        href={
                          u
                            ? ledgerIndividualHref(u, Object.values(people))
                            : `/ledger?view=individual&person=${row.userId}`
                        }
                        className="font-medium text-civic-navy hover:underline"
                      >
                        {u?.firstName} {u?.lastName}{" "}
                        <span className="text-ink/45">({u?.initials ?? "—"})</span>
                      </Link>
                    </Td>
                    <Td align="right">{row.rawSignatures}</Td>
                    <Td align="right">{row.pageNumbers}</Td>
                    <Td align="right">{row.pooledSignatures}</Td>
                    <Td align="right">{row.pooledPages}</Td>
                  </tr>
                );
              })}
              <tr className="bg-ink/[0.04] font-medium">
                <Td highlight>Total</Td>
                <Td align="right" highlight>{totals.raw}</Td>
                <Td align="right" highlight>{totals.pages}</Td>
                <Td align="right" highlight>{totals.ps}</Td>
                <Td align="right" highlight>{totals.pp}</Td>
              </tr>
            </tbody>
          </DataTable>
        </CardBody>
      </Card>
    </div>
  );
}
