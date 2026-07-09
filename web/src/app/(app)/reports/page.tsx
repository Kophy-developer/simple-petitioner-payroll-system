"use client";

import { Suspense } from "react";
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
import { getSubmissionsForIssue, getUser, issues } from "@/lib/demo-data";
import { formatDate } from "@/lib/format";

function ReportContent() {
  const params = useSearchParams();
  const issueId = params.get("issue") ?? issues[0].id;
  const issue = issues.find((i) => i.id === issueId)!;
  const rows = getSubmissionsForIssue(issueId);
  const totals = rows.reduce((a, r) => ({ raw: a.raw + r.rawSignatures, pages: a.pages + r.pageNumbers, ps: a.ps + r.pooledSignatures, pp: a.pp + r.pooledPages }), { raw: 0, pages: 0, ps: 0, pp: 0 });

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Collection" title="Issue Report" description="Preview before PDF export." actions={
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48 space-y-2"><Label>Issue</Label><Select value={issueId} onChange={(e) => { window.location.href = `/reports?issue=${e.target.value}`; }}>{issues.map((i) => <option key={i.id} value={i.id}>{i.issueNumber}</option>)}</Select></div>
          <Button><FileDown size={16} /> Generate PDF</Button>
        </div>
      } />
      <Card className="overflow-hidden">
        <CardBody className="space-y-8 p-8">
          <div className="flex flex-wrap justify-between gap-6 border-b border-ink/10 pb-8">
            <div className="flex gap-4"><Image src="/brand/logo.svg" alt="Logo" width={64} height={64} className="rounded-xl bg-ink p-2" /><div className="text-sm text-ink/70"><p>Validated by: {issue.validatedBy}</p><p>State: {issue.state}</p><p>Turn-in: {formatDate(issue.turnInDate)} · {issue.turnInNumber}</p></div></div>
            <p className="font-display text-2xl text-ink">{issue.issueNumber}</p>
          </div>
          <div><h2 className="font-display text-3xl text-ink">{issue.name}</h2>
            <DataTable className="mt-6">
              <thead><tr><Th>Circulator</Th><Th align="right">Raw SIGs</Th><Th align="right">Pages</Th><Th align="right">Pooled SIGs</Th><Th align="right">Pooled Pages</Th></tr></thead>
              <tbody className="divide-y divide-ink/8">
                {rows.map((row) => { const u = getUser(row.userId); return <tr key={row.id}><Td>{u?.firstName} {u?.lastName}</Td><Td align="right">{row.rawSignatures}</Td><Td align="right">{row.pageNumbers}</Td><Td align="right">{row.pooledSignatures}</Td><Td align="right">{row.pooledPages}</Td></tr>; })}
                <tr className="bg-ink/[0.04] font-semibold"><Td>Total</Td><Td align="right">{totals.raw}</Td><Td align="right">{totals.pages}</Td><Td align="right">{totals.ps}</Td><Td align="right">{totals.pp}</Td></tr>
              </tbody>
            </DataTable>
          </div>
          <Link href="/collection" className="text-sm text-civic-navy hover:underline">Back to collection table</Link>
        </CardBody>
      </Card>
    </div>
  );
}

export default function ReportsPage() {
  return <Suspense fallback={<div className="py-20 text-center text-ink/50">Loading report…</div>}><ReportContent /></Suspense>;
}
