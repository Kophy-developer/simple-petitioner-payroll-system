import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { benchmarkPercent, demoUsers } from "@/lib/demo-data";
import { roleLabel } from "@/lib/navigation";
import { formatCurrency } from "@/lib/format";

export default function AdminPage() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Configuration" title="Admin Panel" description="Users, wages, currency, and system benchmark." actions={<Link href="/role-categories" className="text-sm text-civic-navy hover:underline">Role categories</Link>} />
      <Card className="max-w-sm"><CardBody><p className="text-xs uppercase tracking-[0.2em] text-ink/50">Benchmark %</p><p className="font-display text-4xl tabular-nums">{benchmarkPercent}%</p><Link href="/pay-table" className="mt-3 inline-block text-sm text-civic-navy hover:underline">Edit via pay table</Link></CardBody></Card>
      <Card><CardBody className="p-0">
        <DataTable>
          <thead><tr><Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Wage</Th><Th>Currency</Th><Th /></tr></thead>
          <tbody className="divide-y divide-ink/8 bg-white/50">
            {demoUsers.map((u) => (
              <tr key={u.id}>
                <Td>{u.firstName} {u.lastName}</Td><Td>{u.email}</Td><Td><Badge tone="navy">{roleLabel(u.role)}</Badge></Td>
                <Td>{u.hourlyWage ? formatCurrency(u.hourlyWage) : "—"}</Td><Td>{u.wageCurrency ?? "—"}</Td>
                <Td><Link href={`/admin/users/${u.id}`} className="text-sm font-medium text-civic-navy hover:underline">Edit</Link></Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </CardBody></Card>
    </div>
  );
}
