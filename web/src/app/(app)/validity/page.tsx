"use client";

import Link from "next/link";
import { useState } from "react";
import { Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { issues } from "@/lib/demo-data";
import { canUploadValidity } from "@/lib/access";
import { useDemoSession } from "@/lib/demo-session";

const preview = [
  { name: "Jordan Reed", dups: 4, usable: 31, valid: 27, validity: 75 },
  { name: "Casey Nguyen", dups: 6, usable: 34, valid: 29, validity: 70 },
];

export default function ValidityPage() {
  const { user } = useDemoSession();
  const [issueId, setIssueId] = useState(issues[0].id);
  const [file, setFile] = useState<string | null>(null);
  if (!user) return null;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Collection" title="Validity Records" description="Upload or manually enter audited validity data per issue."
        actions={<div className="flex gap-2">{canUploadValidity(user.role) ? <Link href="/validity/manual"><Button variant="secondary">Manual entry</Button></Link> : null}</div>}
      />
      {canUploadValidity(user.role) ? (
        <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
          <Card>
            <CardHeader><h2 className="font-display text-xl text-ink">Upload Excel</h2></CardHeader>
            <CardBody className="space-y-4">
              <div className="space-y-2"><Label>Issue</Label><Select value={issueId} onChange={(e) => setIssueId(e.target.value)}>{issues.map((i) => <option key={i.id} value={i.id}>{i.issueNumber}</option>)}</Select></div>
              <label className="flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-ink/15 py-10 transition hover:border-brass/40">
                <Upload className="text-ink/45" /><p className="mt-2 text-sm font-medium">Drop workbook</p>
                <input type="file" className="hidden" accept=".xlsx,.csv" onChange={(e) => setFile(e.target.files?.[0]?.name ?? null)} />
              </label>
              {file ? <p className="text-sm text-ink/70">{file}</p> : null}
              <Button className="w-full" disabled={!file}>Preview import</Button>
            </CardBody>
          </Card>
          <Card>
            <CardHeader className="flex justify-between"><h2 className="font-display text-xl text-ink">Preview</h2><Badge tone="warning">Confirm before commit</Badge></CardHeader>
            <CardBody className="space-y-4 p-0">
              <DataTable>
                <thead><tr><Th>User</Th><Th align="right">DUPs</Th><Th align="right">Usable</Th><Th align="right">Valid</Th><Th align="right">Validity %</Th></tr></thead>
                <tbody className="divide-y divide-ink/8 bg-white/50">{preview.map((r) => <tr key={r.name}><Td>{r.name}</Td><Td align="right">{r.dups}</Td><Td align="right">{r.usable}</Td><Td align="right">{r.valid}</Td><Td align="right">{r.validity}%</Td></tr>)}</tbody>
              </DataTable>
              <div className="border-t border-ink/10 px-6 py-4"><Button variant="secondary">Commit to ledger</Button></div>
            </CardBody>
          </Card>
        </div>
      ) : (
        <Card><CardBody><p className="text-sm text-ink/65">Account admins can view validity records. Validators and super admins can upload or enter data.</p><Link href="/validity/manual" className="mt-4 inline-block text-sm text-civic-navy hover:underline">View manual entry</Link></CardBody></Card>
      )}
    </div>
  );
}
