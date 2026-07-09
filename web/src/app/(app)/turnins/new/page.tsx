"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardBody } from "@/components/ui/card";
import { issues } from "@/lib/demo-data";

export default function NewTurnInPage() {
  const [saved, setSaved] = useState(false);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Collection" title="Submit Turn-in" description="Upload your package and metadata. Status will show as Pending until approved." actions={<Link href="/turnins" className="text-sm text-civic-navy hover:underline">Back to list</Link>} />
      <Card className="max-w-2xl"><CardBody>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setSaved(true); setTimeout(() => window.location.href = "/turnins", 1200); }}>
          <div className="space-y-2"><Label>File (PDF, image, or Excel)</Label><Input type="file" accept=".pdf,image/*,.xlsx" required /></div>
          <div className="space-y-2"><Label>Issues covered</Label><Select multiple size={4}>{issues.map((i) => <option key={i.id} value={i.id}>{i.issueNumber} — {i.name}</option>)}</Select></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Turn-in date</Label><Input type="date" required /></div>
            <div className="space-y-2"><Label>Turn-in number</Label><Input required placeholder="CO-2026-441" /></div>
          </div>
          <div className="space-y-2"><Label>Notes</Label><Input placeholder="Optional context for reviewers" /></div>
          <Button type="submit" className="w-full">{saved ? "Submitted — redirecting…" : "Submit for approval"}</Button>
        </form>
      </CardBody></Card>
    </div>
  );
}
