"use client";

import Link from "next/link";
import { useState } from "react";
import { Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";

const sampleColumns = ["canvasser_id", "timestamp", "lat", "lng", "status", "address", "notes"];
const preview = [
  { canvasser: "Casey Nguyen", time: "09:14", lat: "39.164", lng: "-119.767", status: "Contact" },
  { canvasser: "Casey Nguyen", time: "09:31", lat: "39.168", lng: "-119.762", status: "Not home" },
];

export default function CanvassingPage() {
  const [step, setStep] = useState<"upload" | "map" | "preview">("upload");

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Field" title="Campaign Sidekick Import" description="Upload activity logs with configurable column mapping." actions={<Link href="/gps" className="text-sm text-civic-navy hover:underline">Open GPS overlay</Link>} />
      {step === "upload" ? (
        <Card className="max-w-xl"><CardBody className="space-y-4">
          <label className="flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-ink/15 py-12 transition hover:border-brass/40">
            <Upload className="text-ink/45" /><p className="mt-2 text-sm font-medium">Drop activity-logs.csv</p>
            <input type="file" className="hidden" accept=".csv" onChange={() => setStep("map")} />
          </label>
        </CardBody></Card>
      ) : null}
      {step === "map" ? (
        <Card><CardHeader><h2 className="font-display text-xl text-ink">Column mapping</h2></CardHeader><CardBody className="grid gap-4 sm:grid-cols-2">
          {sampleColumns.map((col) => (
            <div key={col} className="space-y-2"><Label>{col}</Label><Select defaultValue={col}><option value={col}>{col}</option><option value="skip">Skip</option></Select></div>
          ))}
          <div className="sm:col-span-2"><Button onClick={() => setStep("preview")}>Preview import</Button></div>
        </CardBody></Card>
      ) : null}
      {step === "preview" ? (
        <Card><CardBody className="space-y-4 p-0">
          <DataTable>
            <thead><tr><Th>Canvasser</Th><Th>Time</Th><Th>Lat</Th><Th>Lng</Th><Th>Status</Th></tr></thead>
            <tbody className="divide-y divide-ink/8 bg-white/50">{preview.map((r, i) => <tr key={i}><Td>{r.canvasser}</Td><Td>{r.time}</Td><Td>{r.lat}</Td><Td>{r.lng}</Td><Td>{r.status}</Td></tr>)}</tbody>
          </DataTable>
          <div className="border-t border-ink/10 px-6 py-4"><Button variant="secondary">Confirm import</Button></div>
        </CardBody></Card>
      ) : null}
    </div>
  );
}
