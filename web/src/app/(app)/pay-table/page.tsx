"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { benchmarkPercent, petitions } from "@/lib/demo-data";
import { formatCurrency } from "@/lib/format";

export default function PayTablePage() {
  const [editId, setEditId] = useState<string | null>(null);
  const editing = petitions.find((p) => p.id === editId);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Configuration" title="Petition Pay Table" description="Base petition rates and Lotus values."
        actions={<div className="rounded-2xl border border-ink/10 bg-white/70 px-4 py-3 text-sm"><span className="text-ink/55">Benchmark %</span><p className="font-display text-2xl tabular-nums">{benchmarkPercent}%</p></div>}
      />
      <Card><CardBody className="p-0">
        <DataTable>
          <thead><tr><Th>Petition</Th><Th>Code</Th><Th align="right">Pay</Th><Th>Lotus</Th><Th align="right">Actions</Th></tr></thead>
          <tbody className="divide-y divide-ink/8 bg-white/50">
            {petitions.map((p) => (
              <tr key={p.id}><Td>{p.name}</Td><Td>{p.code}</Td><Td align="right">{formatCurrency(p.pay)}</Td><Td>{p.lotus}</Td>
                <Td align="right"><Button variant="ghost" size="sm" onClick={() => setEditId(p.id)}>Edit</Button></Td></tr>
            ))}
          </tbody>
        </DataTable>
      </CardBody></Card>
      <Link href="/admin" className="text-sm text-civic-navy hover:underline">System settings</Link>
      <Modal open={!!editing} onClose={() => setEditId(null)} title="Edit petition">
        {editing ? (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setEditId(null); }}>
            <div className="space-y-2"><Label>Pay</Label><Input type="number" step="0.01" defaultValue={editing.pay} /></div>
            <div className="space-y-2"><Label>Lotus</Label><Input defaultValue={editing.lotus} /></div>
            <Button type="submit" className="w-full">Save</Button>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
