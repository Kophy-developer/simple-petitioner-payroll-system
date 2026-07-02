"use client";

import { PageHeader } from "@/components/ui/page-header";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getCirculator,
  getSubmissionsForIssue,
  issues,
} from "@/lib/demo-data";

function totals(rows: ReturnType<typeof getSubmissionsForIssue>) {
  return rows.reduce(
    (acc, row) => ({
      rawSignatures: acc.rawSignatures + row.rawSignatures,
      pageNumbers: acc.pageNumbers + row.pageNumbers,
      pooledSignatures: acc.pooledSignatures + row.pooledSignatures,
      pooledPages: acc.pooledPages + row.pooledPages,
    }),
    { rawSignatures: 0, pageNumbers: 0, pooledSignatures: 0, pooledPages: 0 },
  );
}

export default function CollectionPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Collection"
        title="Master Collection Table"
        description="Aggregated circulator submissions grouped by issue number with column totals."
      />

      <div className="space-y-8">
        {issues.map((issue) => {
          const rows = getSubmissionsForIssue(issue.id);
          const total = totals(rows);

          return (
            <Card key={issue.id}>
              <CardHeader className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="font-display text-2xl text-ink">
                      {issue.issueNumber}
                    </h2>
                    <Badge tone="navy">{issue.state}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink/60">{issue.name}</p>
                </div>
                <p className="text-xs text-ink/50">
                  Turn-in {issue.turnInNumber} · {issue.turnInDate}
                </p>
              </CardHeader>
              <CardBody className="p-0">
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
                      const c = getCirculator(row.circulatorId);
                      return (
                        <tr key={row.id}>
                          <Td>
                            {c?.firstName} {c?.lastName}{" "}
                            <span className="text-ink/45">({c?.initials})</span>
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
                      <Td align="right" highlight>
                        {total.rawSignatures}
                      </Td>
                      <Td align="right" highlight>
                        {total.pageNumbers}
                      </Td>
                      <Td align="right" highlight>
                        {total.pooledSignatures}
                      </Td>
                      <Td align="right" highlight>
                        {total.pooledPages}
                      </Td>
                    </tr>
                  </tbody>
                </DataTable>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
