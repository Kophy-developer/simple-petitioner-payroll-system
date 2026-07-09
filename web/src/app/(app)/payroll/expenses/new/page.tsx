"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardBody } from "@/components/ui/card";
import { expenseTypeLabels } from "@/lib/demo-data";

export default function NewExpensePage() {
  const [saved, setSaved] = useState(false);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Payroll" title="Add Expense" description="Log a receipt-backed expense. It applies immediately to live balance." actions={<Link href="/payroll" className="text-sm text-civic-navy hover:underline">Back to payroll</Link>} />
      <Card className="max-w-xl"><CardBody>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setSaved(true); setTimeout(() => window.location.href = "/payroll", 1200); }}>
          <div className="space-y-2"><Label>Type</Label><Select>{Object.entries(expenseTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div>
          <div className="space-y-2"><Label>Amount</Label><Input type="number" step="0.01" min={0} required /></div>
          <div className="space-y-2"><Label>Date</Label><Input type="date" required /></div>
          <div className="space-y-2"><Label>Receipt</Label><Input type="file" accept="image/*,.pdf" /></div>
          <Button type="submit" className="w-full">{saved ? "Saved — redirecting…" : "Save expense"}</Button>
        </form>
      </CardBody></Card>
    </div>
  );
}
