"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { demoUsers, issues } from "@/lib/demo-data";
import { canUploadValidity } from "@/lib/access";
import { useDemoSession } from "@/lib/demo-session";

const preview = [
  { name: "Jordan Reed", dups: 4, usable: 31, valid: 27, validity: 75, matched: true },
  { name: "Unknown Circulator", dups: 1, usable: 10, valid: 8, validity: 80, matched: false },
];

export default function ValidityPage() {
  const { user } = useDemoSession();
  const [tab, setTab] = useState<"upload" | "manual">("upload");
  const [issueId, setIssueId] = useState(issues[0].id);
  const [file, setFile] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  if (!user) return null;

  const canWrite = canUploadValidity(user.role);
  const petitioners = demoUsers.filter((u) => u.role === "petitioner");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Collection"
        title="Validity Records"
        description="Upload Excel or enter validity data manually. Both trigger ledger recalculation."
      />

      <div className="flex gap-2">
        <Button variant={tab === "upload" ? "primary" : "ghost"} size="sm" onClick={() => setTab("upload")}>Upload</Button>
        <Button variant={tab === "manual" ? "primary" : "ghost"} size="sm" onClick={() => setTab("manual")}>Manual entry</Button>
      </div>

      {!canWrite ? (
        <Card><CardBody><p className="text-sm text-ink/65">You can view validity records. Validators and admins can upload or enter data.</p></CardBody></Card>
      ) : tab === "upload" ? (
        <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
          <Card>
            <CardHeader><h2 className="font-display text-xl text-ink">Upload Excel</h2></CardHeader>
            <CardBody className="space-y-4">
              <div className="space-y-2">
                <Label>Issue</Label>
                <Select value={issueId} onChange={(e) => setIssueId(e.target.value)}>
                  {issues.map((i) => <option key={i.id} value={i.id}>{i.issueNumber}</option>)}
                </Select>
              </div>
              <label className="flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-ink/15 py-10 transition hover:border-brass/40">
                <Upload className="text-ink/45" />
                <p className="mt-2 text-sm font-medium">Drop Excel workbook</p>
                <input type="file" className="hidden" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0]?.name ?? null)} />
              </label>
              {file ? <p className="text-sm text-ink/70">{file}</p> : null}
              <Button className="w-full" disabled={!file}>Preview import</Button>
            </CardBody>
          </Card>
          <Card>
            <CardHeader className="flex justify-between">
              <h2 className="font-display text-xl text-ink">Preview</h2>
              <Badge tone="warning">Confirm before commit</Badge>
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
                    <Th>Match</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/8 bg-white/50">
                  {preview.map((r) => (
                    <tr key={r.name} className={!r.matched ? "bg-danger/5" : undefined}>
                      <Td>{r.name}</Td>
                      <Td align="right">{r.dups}</Td>
                      <Td align="right">{r.usable}</Td>
                      <Td align="right">{r.valid}</Td>
                      <Td align="right">{r.validity}%</Td>
                      <Td>{r.matched ? <Badge tone="success">Matched</Badge> : <Badge tone="danger">Review</Badge>}</Td>
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
      ) : (
        <Card className="max-w-2xl">
          <CardBody>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
              }}
            >
              <div className="space-y-2">
                <Label>Issue</Label>
                <Select>{issues.map((i) => <option key={i.id}>{i.issueNumber}</option>)}</Select>
              </div>
              <div className="space-y-2">
                <Label>Circulator</Label>
                <Select>{petitioners.map((u) => <option key={u.id}>{u.firstName} {u.lastName}</option>)}</Select>
              </div>
              <div className="space-y-2"><Label>DUPs</Label><Input type="number" min={0} defaultValue={0} /></div>
              <div className="space-y-2"><Label>Usable</Label><Input type="number" min={0} defaultValue={0} /></div>
              <div className="space-y-2"><Label>Valid</Label><Input type="number" min={0} defaultValue={0} /></div>
              <div className="space-y-2"><Label>Validity %</Label><Input type="number" min={0} max={100} step="0.1" defaultValue={75} /></div>
              <div className="sm:col-span-2">
                <Button type="submit">Save row</Button>
                {saved ? <span className="ml-3 text-sm text-success">Saved — ledger recalculated.</span> : null}
              </div>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
