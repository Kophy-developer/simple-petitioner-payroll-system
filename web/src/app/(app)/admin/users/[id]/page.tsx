"use client";

import { use } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardBody } from "@/components/ui/card";
import { demoUsers } from "@/lib/demo-data";
import { roleLabel } from "@/lib/navigation";
import type { UserRole, WageCurrency } from "@/lib/types";

export default function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = demoUsers.find((u) => u.id === id);
  if (!user) return <p className="py-20 text-center">User not found.</p>;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Admin" title={`Edit ${user.firstName} ${user.lastName}`} description="Role, wage, and currency." actions={<Link href="/admin" className="text-sm text-civic-navy hover:underline">Back</Link>} />
      <Card className="max-w-xl"><CardBody>
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div className="space-y-2"><Label>Role</Label><Select defaultValue={user.role}>{(["super_admin", "account_admin", "team_lead", "petitioner", "canvasser", "validator"] as UserRole[]).map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}</Select></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Hourly wage</Label><Input type="number" step="0.01" defaultValue={user.hourlyWage ?? ""} /></div>
            <div className="space-y-2"><Label>Currency</Label><Select defaultValue={user.wageCurrency ?? "USD"}>{(["USD", "PHP"] as WageCurrency[]).map((c) => <option key={c}>{c}</option>)}</Select></div>
          </div>
          <Button type="submit">Save user</Button>
        </form>
      </CardBody></Card>
    </div>
  );
}
