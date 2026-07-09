"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { getIssue, getUserName, turnIns, turnInStatusLabels } from "@/lib/demo-data";
import { useDemoSession } from "@/lib/demo-session";
import { canApproveTurnIns } from "@/lib/access";
import { formatDate } from "@/lib/format";

function statusTone(s: keyof typeof turnInStatusLabels): "default" | "success" | "warning" | "danger" {
  if (s === "approved") return "success";
  if (s === "pending") return "warning";
  return "danger";
}

export default function TurnInsPage() {
  const { user } = useDemoSession();
  if (!user) return null;

  const rows = canApproveTurnIns(user.role) ? turnIns : turnIns.filter((t) => t.userId === user.id);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Collection" title="Turn-in Uploads" description="Submit petition packages for approval. Ledger updates only after approval."
        actions={<Link href="/turnins/new"><Button>New turn-in</Button></Link>}
      />
      <Card><CardBody className="p-0">
        <DataTable>
          <thead><tr><Th>Submitted</Th><Th>User</Th><Th>File</Th><Th>Issues</Th><Th>Turn-in #</Th><Th>Status</Th><Th /></tr></thead>
          <tbody className="divide-y divide-ink/8 bg-white/50">
            {rows.map((row) => (
              <tr key={row.id}>
                <Td>{formatDate(row.submittedAt)}</Td>
                <Td>{getUserName(row.userId)}</Td>
                <Td>{row.fileName}</Td>
                <Td>{row.issueIds.map((id) => getIssue(id)?.issueNumber).join(", ")}</Td>
                <Td>{row.turnInNumber}</Td>
                <Td><Badge tone={statusTone(row.status)}>{turnInStatusLabels[row.status]}</Badge></Td>
                <Td><Link href={`/turnins/${row.id}`} className="text-sm font-medium text-civic-navy hover:underline">Open</Link></Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </CardBody></Card>
    </div>
  );
}
