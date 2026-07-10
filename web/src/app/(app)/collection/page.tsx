"use client";

import { useState } from "react";
import Link from "next/link";
import { FileDown } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardBody } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { getSubmissionsForIssue, getUser, issues } from "@/lib/demo-data";
import { useDemoSession } from "@/lib/demo-session";
import { visibleUserIds } from "@/lib/access";

export default function CollectionPage() {
  const { user } = useDemoSession();
  const [issueId, setIssueId] = useState(issues[0].id);
  if (!user) return null;

  const issue = issues.find((i) => i.id === issueId)!;
  const allowed = visibleUserIds(
    user,
    getSubmissionsForIssue(issueId).map((s) => s.userId),
  );
  const rows = getSubmissionsForIssue(issueId).filter((r) => allowed.includes(r.userId));
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
        description="One issue at a time with column totals and PDF export."
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

      <Card>
        <CardBody className="space-y-4 p-0">
          <div className="border-b border-ink/10 px-6 py-4">
            <h2 className="font-display text-2xl text-ink">{issue.issueNumber}</h2>
            <p className="text-sm text-ink/60">{issue.name}</p>
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
                const u = getUser(row.userId);
                return (
                  <tr key={row.id}>
                    <Td>
                      <Link href={`/ledger?user=${row.userId}`} className="font-medium text-civic-navy hover:underline">
                        {u?.firstName} {u?.lastName}{" "}
                        <span className="text-ink/45">({u?.initials})</span>
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
