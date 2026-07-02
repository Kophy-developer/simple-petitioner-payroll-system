"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { issues, submissions, getCirculatorName, getIssue } from "@/lib/demo-data";
import { useDemoSession } from "@/lib/demo-session";

export default function SubmissionsPage() {
  const { user } = useDemoSession();
  const [issueId, setIssueId] = useState(issues[0].id);
  const [rawSignatures, setRawSignatures] = useState("36");
  const [pageNumbers, setPageNumbers] = useState("4");
  const [saved, setSaved] = useState(false);

  const visibleSubmissions =
    user?.role === "circulator" && user.circulatorId
      ? submissions.filter((s) => s.circulatorId === user.circulatorId)
      : submissions;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Collection"
        title="Circulator Submission"
        description="Log raw signatures and book counts for a specific issue. Data feeds the Master Collection Table."
      />

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader>
            <h2 className="font-display text-xl text-ink">New submission</h2>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="issue">Issue</Label>
                <Select
                  id="issue"
                  value={issueId}
                  onChange={(e) => setIssueId(e.target.value)}
                >
                  {issues.map((issue) => (
                    <option key={issue.id} value={issue.id}>
                      {issue.issueNumber} — {issue.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sigs">Raw signatures</Label>
                <Input
                  id="sigs"
                  type="number"
                  min={0}
                  value={rawSignatures}
                  onChange={(e) => setRawSignatures(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pages">Page numbers (books)</Label>
                <Input
                  id="pages"
                  type="number"
                  min={0}
                  value={pageNumbers}
                  onChange={(e) => setPageNumbers(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full">
                <Upload size={16} />
                Submit signatures
              </Button>
              {saved ? (
                <p className="text-center text-sm text-success">
                  Submission saved to demo queue.
                </p>
              ) : null}
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-display text-xl text-ink">Recent submissions</h2>
          </CardHeader>
          <CardBody className="p-0">
            <DataTable>
              <thead>
                <tr>
                  <Th>Issue</Th>
                  <Th>Circulator</Th>
                  <Th align="right">Raw SIGs</Th>
                  <Th align="right">Pages</Th>
                  <Th align="right">Pooled SIGs</Th>
                  <Th align="right">Pooled Pages</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/8 bg-white/50">
                {visibleSubmissions.map((row) => {
                  const issue = getIssue(row.issueId);
                  return (
                    <tr key={row.id}>
                      <Td>{issue?.issueNumber}</Td>
                      <Td>{getCirculatorName(row.circulatorId)}</Td>
                      <Td align="right">{row.rawSignatures}</Td>
                      <Td align="right">{row.pageNumbers}</Td>
                      <Td align="right">{row.pooledSignatures}</Td>
                      <Td align="right">{row.pooledPages}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          </CardBody>
        </Card>
      </div>

      <Card className="border-brass/25 bg-brass/5">
        <CardBody className="flex flex-wrap items-center gap-3 text-sm text-ink/75">
          <Badge tone="navy">Demo</Badge>
          Estimated pay appears on the ledger immediately after submission using petition base pay.
        </CardBody>
      </Card>
    </div>
  );
}
