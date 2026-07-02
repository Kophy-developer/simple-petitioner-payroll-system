import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { circulators } from "@/lib/demo-data";

export default function DirectoryPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="People"
        title="Employee Directory"
        description="Active and inactive circulators with quick access to individual ledgers."
      />

      <Card>
        <CardBody className="p-0">
          <DataTable>
            <thead>
              <tr>
                <Th>Full name</Th>
                <Th>Initials</Th>
                <Th>Status</Th>
                <Th>Ledger</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8 bg-white/50">
              {circulators.map((c) => (
                <tr key={c.id}>
                  <Td>
                    {c.firstName} {c.lastName}
                  </Td>
                  <Td>{c.initials}</Td>
                  <Td>
                    <Badge tone={c.status === "active" ? "success" : "default"}>
                      {c.status}
                    </Badge>
                  </Td>
                  <Td>
                    <Link
                      href={`/ledger?circulator=${c.id}`}
                      className="font-medium text-civic-navy hover:underline"
                    >
                      View ledger
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </CardBody>
      </Card>
    </div>
  );
}
