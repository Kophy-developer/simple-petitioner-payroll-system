"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { benchmarkPercent, issues, payRates, petitions } from "@/lib/demo-data";
import { formatCurrency } from "@/lib/format";

export default function PayRatesPage() {
  const [editIssue, setEditIssue] = useState<string | null>(null);
  const [benchmark, setBenchmark] = useState(String(benchmarkPercent));
  const [benchmarkWarn, setBenchmarkWarn] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Configuration"
        title="Pay Rate Configuration"
        description="Per petition / issue pay rates and the system-wide payable benchmark."
      />

      <Card>
        <CardHeader><h2 className="font-display text-xl text-ink">Pay rates</h2></CardHeader>
        <CardBody className="p-0">
          <DataTable>
            <thead>
              <tr>
                <Th>Petition</Th>
                <Th>Issue</Th>
                <Th>State</Th>
                <Th align="right">Pay rate</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8 bg-white/50">
              {issues.map((issue) => {
                const rate = payRates.find((p) => p.issueId === issue.id)?.rate ?? 1;
                const petition = petitions.find((p) => p.id === issue.petitionId);
                return (
                  <tr key={issue.id}>
                    <Td>{petition?.name}</Td>
                    <Td>{issue.issueNumber}</Td>
                    <Td>{issue.state}</Td>
                    <Td align="right">{formatCurrency(rate)}</Td>
                    <Td align="right">
                      <Button variant="ghost" size="sm" onClick={() => setEditIssue(issue.id)}>Edit</Button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        </CardBody>
      </Card>

      <Card className="max-w-lg">
        <CardHeader><h2 className="font-display text-xl text-ink">Benchmark %</h2></CardHeader>
        <CardBody className="space-y-4">
          <div className="space-y-2">
            <Label>System-wide payable threshold</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={benchmark}
              onChange={(e) => {
                setBenchmark(e.target.value);
                setBenchmarkWarn(true);
                setSaved(false);
              }}
            />
          </div>
          {benchmarkWarn ? (
            <p className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning">
              Changing this affects all future payable calculations. Existing locked payroll records are unaffected.
            </p>
          ) : null}
          <Button
            onClick={() => {
              setSaved(true);
              setBenchmarkWarn(false);
            }}
          >
            Save benchmark
          </Button>
          {saved ? <p className="text-sm text-success">Benchmark saved.</p> : null}
        </CardBody>
      </Card>

      <Modal open={!!editIssue} onClose={() => setEditIssue(null)} title="Edit pay rate">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setEditIssue(null); }}>
          <div className="space-y-2">
            <Label>Pay rate</Label>
            <Input type="number" step="0.01" defaultValue={payRates.find((p) => p.issueId === editIssue)?.rate ?? 1} />
          </div>
          <Button type="submit" className="w-full">Save</Button>
        </form>
      </Modal>
    </div>
  );
}
