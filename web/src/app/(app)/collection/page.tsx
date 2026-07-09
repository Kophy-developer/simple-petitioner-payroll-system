"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { getSubmissionsForIssue, getUser, issues } from "@/lib/demo-data";
import { useDemoSession } from "@/lib/demo-session";
import { visibleUserIds } from "@/lib/access";

export default function CollectionPage() {
  const { user } = useDemoSession();
  if (!user) return null;
  const allowed = visibleUserIds(user, issues.flatMap((i) => getSubmissionsForIssue(i.id).map((s) => s.userId)));

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Collection" title="Master Collection Table" description="Submissions grouped by issue with column totals." />
      {issues.map((issue) => {
        const rows = getSubmissionsForIssue(issue.id).filter((r) => allowed.includes(r.userId));
        if (!rows.length && user.role === "team_lead") return null;
        const totals = rows.reduce((a, r) => ({ raw: a.raw + r.rawSignatures, pages: a.pages + r.pageNumbers, ps: a.ps + r.pooledSignatures, pp: a.pp + r.pooledPages }), { raw: 0, pages: 0, ps: 0, pp: 0 });
        return (
          <Card key={issue.id}>
            <CardHeader className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="font-display text-2xl text-ink">{issue.issueNumber}</h2><p className="text-sm text-ink/60">{issue.name}</p></div>
              <Link href={`/reports?issue=${issue.id}`}><Button variant="ghost" size="sm"><FileText size={16} /> Issue report</Button></Link>
            </CardHeader>
            <CardBody className="p-0">
              <DataTable>
                <thead><tr><Th>User</Th><Th align="right">Raw SIGs</Th><Th align="right">Pages</Th><Th align="right">Pooled SIGs</Th><Th align="right">Pooled Pages</Th></tr></thead>
                <tbody className="divide-y divide-ink/8 bg-white/50">
                  {rows.map((row) => { const u = getUser(row.userId); return (
                    <tr key={row.id}><Td>{u?.firstName} {u?.lastName} <span className="text-ink/45">({u?.initials})</span></Td><Td align="right">{row.rawSignatures}</Td><Td align="right">{row.pageNumbers}</Td><Td align="right">{row.pooledSignatures}</Td><Td align="right">{row.pooledPages}</Td></tr>
                  ); })}
                  <tr className="bg-ink/[0.04] font-medium"><Td highlight>Total</Td><Td align="right" highlight>{totals.raw}</Td><Td align="right" highlight>{totals.pages}</Td><Td align="right" highlight>{totals.ps}</Td><Td align="right" highlight>{totals.pp}</Td></tr>
                </tbody>
              </DataTable>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
