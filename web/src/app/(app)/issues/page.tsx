import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { issues, petitions } from "@/lib/demo-data";
import { payModelLabel } from "@/lib/payroll";
import { formatCurrency } from "@/lib/format";

export default function IssuesPage() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Collection" title="Issues & Petitions" description="Active drives, pay models, and petition base rates." />
      <Card>
        <CardBody className="p-0">
          <DataTable>
            <thead><tr><Th>Issue</Th><Th>Name</Th><Th>State</Th><Th>Pay model</Th><Th>Petition</Th><Th align="right">Base pay</Th></tr></thead>
            <tbody className="divide-y divide-ink/8 bg-white/50">
              {issues.map((issue) => {
                const petition = petitions.find((p) => p.id === issue.petitionId);
                return (
                  <tr key={issue.id}>
                    <Td><Link href={`/collection`} className="font-medium text-civic-navy hover:underline">{issue.issueNumber}</Link></Td>
                    <Td>{issue.name}</Td>
                    <Td><Badge tone="navy">{issue.state}</Badge></Td>
                    <Td>{payModelLabel(issue.payModel)}</Td>
                    <Td>{petition?.name}</Td>
                    <Td align="right">{formatCurrency(petition?.pay ?? 0)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        </CardBody>
      </Card>
    </div>
  );
}
