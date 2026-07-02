"use client";

import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Card, CardBody } from "@/components/ui/card";
import { issues, payRates } from "@/lib/demo-data";
import { formatCurrency } from "@/lib/format";

export default function PayRatesPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Configuration"
        title="Pay Rate Configuration"
        description="Per-issue pay rate overrides applied on top of petition base pay."
      />

      <Card>
        <CardBody className="p-0">
          <DataTable>
            <thead>
              <tr>
                <Th>Issue</Th>
                <Th>Issue name</Th>
                <Th>State</Th>
                <Th align="right">Pay rate</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8 bg-white/50">
              {issues.map((issue) => {
                const rate =
                  payRates.find((p) => p.issueId === issue.id)?.rate ?? 1;
                return (
                  <tr key={issue.id}>
                    <Td>{issue.issueNumber}</Td>
                    <Td>{issue.name}</Td>
                    <Td>{issue.state}</Td>
                    <Td align="right">{formatCurrency(rate)}</Td>
                    <Td align="right">
                      <Button variant="ghost" size="sm">
                        Edit rate
                      </Button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        </CardBody>
      </Card>
    </div>
  );
}
