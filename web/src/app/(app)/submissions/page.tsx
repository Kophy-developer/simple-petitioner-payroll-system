"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { issues, submissions, getUserName, getIssue } from "@/lib/demo-data";
import { useDemoSession } from "@/lib/demo-session";
import { visibleUserIds } from "@/lib/access";

export default function SubmissionsPage() {
  const { user } = useDemoSession();
  const [issueId, setIssueId] = useState(issues[0].id);
  const [saved, setSaved] = useState(false);
  if (!user) return null;

  const visible = submissions.filter((s) => visibleUserIds(user, submissions.map((x) => x.userId)).includes(s.userId));

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Collection" title="Submission" description="Log raw signatures and book counts for an issue." actions={<Link href="/turnins/new"><Button variant="secondary">Upload turn-in</Button></Link>} />
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader><h2 className="font-display text-xl text-ink">New submission</h2></CardHeader>
          <CardBody>
            <form onSubmit={(e) => { e.preventDefault(); setSaved(true); setTimeout(() => setSaved(false), 2000); }} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="issue">Issue</Label><Select id="issue" value={issueId} onChange={(e) => setIssueId(e.target.value)}>{issues.map((i) => <option key={i.id} value={i.id}>{i.issueNumber}</option>)}</Select></div>
              <div className="space-y-2"><Label htmlFor="sigs">Raw signatures</Label><Input id="sigs" type="number" min={0} defaultValue={36} /></div>
              <div className="space-y-2"><Label htmlFor="pages">Page numbers</Label><Input id="pages" type="number" min={0} defaultValue={4} /></div>
              <Button type="submit" className="w-full">Submit</Button>
              {saved ? <p className="text-center text-sm text-success">Submission recorded.</p> : null}
            </form>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><h2 className="font-display text-xl text-ink">Recent</h2></CardHeader>
          <CardBody className="p-0">
            <DataTable>
              <thead><tr><Th>Issue</Th><Th>User</Th><Th align="right">Raw</Th><Th align="right">Pages</Th><Th align="right">Pooled SIGs</Th></tr></thead>
              <tbody className="divide-y divide-ink/8 bg-white/50">
                {visible.map((row) => (
                  <tr key={row.id}>
                    <Td>{getIssue(row.issueId)?.issueNumber}</Td>
                    <Td>{getUserName(row.userId)}</Td>
                    <Td align="right">{row.rawSignatures}</Td>
                    <Td align="right">{row.pageNumbers}</Td>
                    <Td align="right">{row.pooledSignatures}</Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
