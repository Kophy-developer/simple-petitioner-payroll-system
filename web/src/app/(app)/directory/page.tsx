"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { roleLabel } from "@/lib/navigation";
import { listProfiles } from "@/lib/api/live";
import type { DemoUser } from "@/lib/types";

export default function DirectoryPage() {
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void listProfiles()
      .then(setUsers)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load directory."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="People"
        title="Employee Directory"
        description="Users from the live profiles table."
        actions={
          <Link href="/admin" className="text-sm font-medium text-civic-navy hover:underline">
            Manage users
          </Link>
        }
      />
      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
      {loading ? <p className="text-sm text-ink/55">Loading directory…</p> : null}
      <Card>
        <CardBody className="p-0">
          <DataTable>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Initials</Th>
                <Th>Role</Th>
                <Th>Email</Th>
                <Th>Tags</Th>
                <Th>Ledger</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8 bg-white/50">
              {users.map((u) => (
                <tr key={u.id}>
                  <Td>
                    {u.firstName} {u.lastName}
                  </Td>
                  <Td>{u.initials}</Td>
                  <Td>
                    <Badge tone="navy">{roleLabel(u.role)}</Badge>
                  </Td>
                  <Td>{u.email}</Td>
                  <Td>{u.profileTags.join(", ") || "—"}</Td>
                  <Td>
                    <Link href={`/ledger?view=individual&user=${u.id}`} className="font-medium text-civic-navy hover:underline">
                      View
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
