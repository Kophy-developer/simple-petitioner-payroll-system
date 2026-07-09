"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardBody } from "@/components/ui/card";
import { issues, demoUsers } from "@/lib/demo-data";

export default function ValidityManualPage() {
  const [saved, setSaved] = useState(false);
  const petitioners = demoUsers.filter((u) => u.role === "petitioner");

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Collection" title="Manual Validity Entry" description="Enter validity row by row when Excel upload is not available." actions={<Link href="/validity" className="text-sm text-civic-navy hover:underline">Back to upload</Link>} />
      <Card><CardBody>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); setSaved(true); setTimeout(() => setSaved(false), 2000); }}>
          <div className="space-y-2"><Label>Issue</Label><Select>{issues.map((i) => <option key={i.id}>{i.issueNumber}</option>)}</Select></div>
          <div className="space-y-2"><Label>Petitioner</Label><Select>{petitioners.map((u) => <option key={u.id}>{u.firstName} {u.lastName}</option>)}</Select></div>
          <div className="space-y-2"><Label>DUPs</Label><Input type="number" min={0} defaultValue={0} /></div>
          <div className="space-y-2"><Label>Usable</Label><Input type="number" min={0} defaultValue={0} /></div>
          <div className="space-y-2"><Label>Valid</Label><Input type="number" min={0} defaultValue={0} /></div>
          <div className="space-y-2"><Label>Validity %</Label><Input type="number" min={0} max={100} step="0.1" defaultValue={75} /></div>
          <div className="sm:col-span-2"><Button type="submit">Save row</Button>{saved ? <span className="ml-3 text-sm text-success">Saved.</span> : null}</div>
        </form>
      </CardBody></Card>
    </div>
  );
}
