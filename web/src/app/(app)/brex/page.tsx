"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrexPanel } from "@/components/payroll/brex-panel";
import { useDemoSession } from "@/lib/demo-session";
import { canAccessPhase2Console } from "@/lib/access";

export default function BrexPage() {
  const { user } = useDemoSession();
  const showPayouts = !!user && canAccessPhase2Console(user.role);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Payroll"
        title="Brex reimbursements"
        description="Pull and review Brex expenses."
        actions={
          showPayouts ? (
            <Link href="/brex/contractor-payouts">
              <Button type="button" variant="secondary" size="sm">
                Contractor payouts (dry-run)
              </Button>
            </Link>
          ) : null
        }
      />
      <Card>
        <CardBody>
          <BrexPanel />
        </CardBody>
      </Card>
    </div>
  );
}
