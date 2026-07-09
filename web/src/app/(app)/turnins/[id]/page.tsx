"use client";

import { use } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getIssue, getUserName, turnIns, turnInStatusLabels } from "@/lib/demo-data";
import { useDemoSession } from "@/lib/demo-session";
import { canApproveTurnIns } from "@/lib/access";
import { formatDate } from "@/lib/format";

export default function TurnInDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useDemoSession();
  const turnIn = turnIns.find((t) => t.id === id);
  if (!turnIn || !user) return <p className="py-20 text-center text-ink/50">Turn-in not found.</p>;

  const canReview = canApproveTurnIns(user.role) && turnIn.status === "pending";

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Collection" title="Turn-in Review" description={turnIn.fileName} actions={<Link href="/turnins" className="text-sm text-civic-navy hover:underline">Back to queue</Link>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardBody className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-ink/55">Submitted by</span><span>{getUserName(turnIn.userId)}</span></div>
          <div className="flex justify-between"><span className="text-ink/55">Date</span><span>{formatDate(turnIn.submittedAt)}</span></div>
          <div className="flex justify-between"><span className="text-ink/55">Turn-in #</span><span>{turnIn.turnInNumber}</span></div>
          <div className="flex justify-between"><span className="text-ink/55">Status</span><Badge>{turnInStatusLabels[turnIn.status]}</Badge></div>
          <div><span className="text-ink/55">Issues</span><p className="mt-1">{turnIn.issueIds.map((i) => getIssue(i)?.issueNumber).join(", ")}</p></div>
          {turnIn.notes ? <div><span className="text-ink/55">Notes</span><p className="mt-1">{turnIn.notes}</p></div> : null}
          {turnIn.reviewNotes ? <div className="rounded-xl bg-danger/8 p-3 text-danger">{turnIn.reviewNotes}</div> : null}
        </CardBody></Card>
        <Card><CardBody className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-ink/15 bg-parchment/40 text-sm text-ink/50">File preview: {turnIn.fileName}</CardBody></Card>
      </div>
      {canReview ? (
        <div className="flex gap-3">
          <Button variant="secondary">Approve</Button>
          <Link href={`/turnins/${id}/reject`}><Button variant="ghost">Reject with note</Button></Link>
        </div>
      ) : null}
    </div>
  );
}
