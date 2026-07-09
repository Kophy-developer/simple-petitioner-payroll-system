"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { expenseConfig, getIssue } from "@/lib/demo-data";
import { formatCurrency } from "@/lib/format";

export default function ExpenseConfigPage() {
  const { carRental, housing } = expenseConfig;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Configuration" title="Car Rental & Housing" description="Standard or per-issue rates auto-applied to expenses." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><h2 className="font-display text-xl text-ink">Car rental</h2></CardHeader>
          <CardBody className="space-y-4">
            <div className="space-y-2"><Label>Config type</Label><Select defaultValue={carRental.type}><option value="standard">Standard</option><option value="per_issue">Per issue</option></Select></div>
            {carRental.type === "per_issue" ? carRental.issueRates.map((r) => (
              <div key={r.issueId} className="flex items-center justify-between text-sm"><span>{getIssue(r.issueId)?.issueNumber}</span><span className="tabular-nums">{formatCurrency(r.rate)}</span></div>
            )) : <div className="space-y-2"><Label>Rate</Label><Input type="number" defaultValue={carRental.rate} /></div>}
            <Button size="sm">Save car rental</Button>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><h2 className="font-display text-xl text-ink">Housing</h2></CardHeader>
          <CardBody className="space-y-4">
            <div className="space-y-2"><Label>Config type</Label><Select defaultValue={housing.type}><option value="standard">Standard</option><option value="per_issue">Per issue</option></Select></div>
            <div className="space-y-2"><Label>Rate</Label><Input type="number" defaultValue={housing.rate} /></div>
            <Button size="sm">Save housing</Button>
          </CardBody>
        </Card>
      </div>
      <Link href="/payroll" className="text-sm text-civic-navy hover:underline">Back to payroll</Link>
    </div>
  );
}
