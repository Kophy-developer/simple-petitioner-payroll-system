"use client";

import { useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { issues } from "@/lib/demo-data";

const previewRows = [
  {
    circulator: "Jordan Reed",
    dups: 4,
    usable: 31,
    valid: 27,
    validity: 75,
  },
  {
    circulator: "Casey Nguyen",
    dups: 6,
    usable: 34,
    valid: 29,
    validity: 70,
  },
  {
    circulator: "Taylor Brooks",
    dups: 2,
    usable: 25,
    valid: 22,
    validity: 79,
  },
];

export default function ValidityPage() {
  const [issueId, setIssueId] = useState(issues[0].id);
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Collection"
        title="Validity Records Upload"
        description="Import audited validity sheets per issue. Only Duplicate, Usable, Valid, and Validity % are written to the ledger."
      />

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <h2 className="font-display text-xl text-ink">Upload Excel</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="validity-issue">Issue</Label>
              <Select
                id="validity-issue"
                value={issueId}
                onChange={(e) => setIssueId(e.target.value)}
              >
                {issues.map((issue) => (
                  <option key={issue.id} value={issue.id}>
                    {issue.issueNumber}
                  </option>
                ))}
              </Select>
            </div>

            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ink/15 bg-parchment/40 px-6 py-10 text-center transition hover:border-brass/40 hover:bg-white">
              <Upload className="text-ink/45" />
              <p className="mt-3 text-sm font-medium text-ink">
                Drop validity workbook
              </p>
              <p className="mt-1 text-xs text-ink/50">.xlsx or .csv</p>
              <input
                type="file"
                className="hidden"
                accept=".xlsx,.xls,.csv"
                onChange={(e) =>
                  setFileName(e.target.files?.[0]?.name ?? null)
                }
              />
            </label>

            {fileName ? (
              <div className="flex items-center gap-2 rounded-xl bg-civic-navy/8 px-4 py-3 text-sm">
                <FileSpreadsheet size={16} className="text-civic-navy" />
                <span>{fileName}</span>
              </div>
            ) : null}

            <Button className="w-full" disabled={!fileName}>
              Preview import
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="font-display text-xl text-ink">Import preview</h2>
            <Badge tone="warning">Review before commit</Badge>
          </CardHeader>
          <CardBody className="space-y-4 p-0">
            <DataTable>
              <thead>
                <tr>
                  <Th>Circulator</Th>
                  <Th align="right">DUPs</Th>
                  <Th align="right">Usable</Th>
                  <Th align="right">Valid</Th>
                  <Th align="right">Validity %</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/8 bg-white/50">
                {previewRows.map((row) => (
                  <tr key={row.circulator}>
                    <Td>{row.circulator}</Td>
                    <Td align="right">{row.dups}</Td>
                    <Td align="right">{row.usable}</Td>
                    <Td align="right">{row.valid}</Td>
                    <Td align="right">{row.validity}%</Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
            <div className="border-t border-ink/10 px-6 py-4">
              <Button variant="secondary">Commit to ledger</Button>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card className="border-civic-navy/15 bg-civic-navy/5">
        <CardBody className="text-sm text-ink/70">
          Parser matches headers by name across ~13 source columns. Circulators
          are matched on normalized full name before writing validity records.
        </CardBody>
      </Card>
    </div>
  );
}
