import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { demoUsers, getRoleCategoryName } from "@/lib/demo-data";
import { roleLabel } from "@/lib/navigation";

export default function DirectoryPage() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="People" title="Employee Directory" description="All users with roles, tags, and ledger access." actions={<Link href="/admin" className="text-sm font-medium text-civic-navy hover:underline">Manage users</Link>} />
      <Card><CardBody className="p-0">
        <DataTable>
          <thead><tr><Th>Name</Th><Th>Initials</Th><Th>Role</Th><Th>Categories</Th><Th>Tags</Th><Th>Ledger</Th></tr></thead>
          <tbody className="divide-y divide-ink/8 bg-white/50">
            {demoUsers.map((u) => (
              <tr key={u.id}>
                <Td>{u.firstName} {u.lastName}</Td><Td>{u.initials}</Td>
                <Td><Badge tone="navy">{roleLabel(u.role)}</Badge></Td>
                <Td>{u.roleCategoryIds.map(getRoleCategoryName).join(", ")}</Td>
                <Td>{u.profileTags.join(", ")}</Td>
                <Td><Link href={`/ledger?user=${u.id}`} className="font-medium text-civic-navy hover:underline">View</Link></Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </CardBody></Card>
    </div>
  );
}
