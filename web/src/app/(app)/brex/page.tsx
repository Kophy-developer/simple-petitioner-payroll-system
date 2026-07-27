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
        description="Sync stores all Brex expenses; only successful spend is matched (email, card owner, Brex ID, or a single ≥80% name match). Matched people can dispute; admins resolve."
      />
      <Card>
        <CardBody>
          <BrexPanel />
        </CardBody>
      </Card>
    </div>
  );
}
