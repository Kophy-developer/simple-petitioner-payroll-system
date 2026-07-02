"use client";

import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Card, CardBody } from "@/components/ui/card";
import { benchmarkPercent, petitions } from "@/lib/demo-data";
import { formatCurrency } from "@/lib/format";

export default function PayTablePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Configuration"
        title="Petition Pay Table"
        description="Base petition rates and Lotus field values managed by Super Admin."
        actions={
          <div className="rounded-2xl border border-ink/10 bg-white/70 px-4 py-3 text-sm">
            <span className="text-ink/55">Benchmark %</span>
            <p className="font-display text-2xl tabular-nums text-ink">
              {benchmarkPercent}%
            </p>
          </div>
        }
      />

      <Card>
        <CardBody className="p-0">
          <DataTable>
            <thead>
              <tr>
                <Th>Petition name</Th>
                <Th>Code</Th>
                <Th align="right">Pay</Th>
                <Th>Lotus</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8 bg-white/50">
              {petitions.map((petition) => (
                <tr key={petition.id}>
                  <Td>{petition.name}</Td>
                  <Td>{petition.code}</Td>
                  <Td align="right">{formatCurrency(petition.pay)}</Td>
                  <Td>{petition.lotus}</Td>
                  <Td align="right">
                    <Button variant="ghost" size="sm">
                      Edit
                    </Button>
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
