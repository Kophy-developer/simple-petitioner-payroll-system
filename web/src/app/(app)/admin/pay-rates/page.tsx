"use client";

import { PageHeader } from "@/components/ui/page-header";
import { PayRatesPanel } from "@/components/admin/pay-rates-panel";
import { useDemoSession } from "@/lib/demo-session";
import { canAccessPayRates } from "@/lib/navigation";

export default function AdminPayRatesPage() {
  const { user } = useDemoSession();
  if (!user) return null;
  if (!canAccessPayRates(user.role)) {
    return <p className="text-sm text-danger">Admins only.</p>;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Configuration"
        title="Pay rates"
        description="Set pay rates, validity benchmark, and hold percent."
      />
      <PayRatesPanel />
    </div>
  );
}
