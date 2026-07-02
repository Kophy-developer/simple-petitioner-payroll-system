"use client";

import { useState } from "react";
import Image from "next/image";
import { FileDown } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardBody } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import {
  getCirculator,
  getSubmissionsForIssue,
  issues,
} from "@/lib/demo-data";
import { formatDate } from "@/lib/format";

export default function ReportsPage() {
  const [issueId, setIssueId] = useState(issues[0].id);
  const issue = issues.find((i) => i.id === issueId)!;
  const rows = getSubmissionsForIssue(issueId);
  const totals = rows.reduce(
    (acc, r) => ({
      raw: acc.raw + r.rawSignatures,
      pages: acc.pages + r.pageNumbers,
      pooledSigs: acc.pooledSigs + r.pooledSignatures,
      pooledPages: acc.pooledPages + r.pooledPages,
    }),
    { raw: 0, pages: 0, pooledSigs: 0, pooledPages: 0 },
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Collection"
        title="Issue Report"
        description="Preview the printable per-issue report before server-side PDF export."
        actions={
          <>
            <div className="w-56 space-y-2">
              <Label htmlFor="issue-select">Issue</Label>
              <Select
                id="issue-select"
                value={issueId}
                onChange={(e) => setIssueId(e.target.value)}
              >
                {issues.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.issueNumber}
                  </option>
                ))}
              </Select>
            </div>
            <Button className="self-end">
              <FileDown size={16} />
              Generate PDF
            </Button>
          </>
        }
      />

      <Card className="overflow-hidden">
        <CardBody className="space-y-8 p-8 sm:p-10">
          <div className="flex flex-wrap items-start justify-between gap-6 border-b border-ink/10 pb-8">
            <div className="flex items-center gap-4">
              <Image
                src="/brand/logo.svg"
                alt="Business logo"
                width={64}
                height={64}
                className="rounded-xl bg-ink p-2"
              />
              <div className="text-sm text-ink/70">
                <p>
                  <span className="font-medium text-ink">Validated by:</span>{" "}
                  {issue.validatedBy}
                </p>
                <p>
                  <span className="font-medium text-ink">State:</span>{" "}
                  {issue.state}
                </p>
                <p>
                  <span className="font-medium text-ink">Turn-in date:</span>{" "}
                  {formatDate(issue.turnInDate)}
                </p>
                <p>
                  <span className="font-medium text-ink">Turn-in number:</span>{" "}
                  {issue.turnInNumber}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.2em] text-ink/45">
                Issue report
              </p>
              <p className="font-display text-2xl text-ink">{issue.issueNumber}</p>
            </div>
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
                {rows.map((row) => {
                  const c = getCirculator(row.circulatorId);
                  return (
                    <tr key={row.id}>
                      <Td>
                        {c?.firstName} {c?.lastName}
                      </Td>
                      <Td align="right">{row.rawSignatures}</Td>
                      <Td align="right">{row.pageNumbers}</Td>
                      <Td align="right">{row.pooledSignatures}</Td>
                      <Td align="right">{row.pooledPages}</Td>
                    </tr>
                  );
                })}
                <tr className="bg-ink/[0.04] font-semibold">
                  <Td>Total</Td>
                  <Td align="right">{totals.raw}</Td>
                  <Td align="right">{totals.pages}</Td>
                  <Td align="right">{totals.pooledSigs}</Td>
                  <Td align="right">{totals.pooledPages}</Td>
                </tr>
              </tbody>
            </DataTable>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
