"use client";

import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { BrexPanel } from "@/components/payroll/brex-panel";

export default function BrexPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Payroll"
        title="Brex reimbursements"
        description="Pull and review Brex expenses."
      />
      <Card>
        <CardBody>
          <BrexPanel />
        </CardBody>
      </Card>
    </div>
  );
}
