"use client";

import { use } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardBody } from "@/components/ui/card";

export default function TurnInRejectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Collection" title="Reject Turn-in" description="Provide a note for the petitioner." actions={<Link href={`/turnins/${id}`} className="text-sm text-civic-navy hover:underline">Cancel</Link>} />
      <Card className="max-w-lg"><CardBody>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); window.location.href = "/turnins"; }}>
          <div className="space-y-2"><Label>Rejection note</Label><Input required placeholder="Missing signature pages 12–14" /></div>
          <Button type="submit" variant="danger" className="w-full">Reject turn-in</Button>
        </form>
      </CardBody></Card>
    </div>
  );
}
