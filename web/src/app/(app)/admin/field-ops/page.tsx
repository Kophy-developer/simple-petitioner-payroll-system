"use client";

import { PageHeader } from "@/components/ui/page-header";
import { FieldOpsPanel } from "@/components/admin/field-ops-panel";
import { useDemoSession } from "@/lib/demo-session";
import { canAccessFieldOps } from "@/lib/navigation";

export default function AdminFieldOpsPage() {
  const { user } = useDemoSession();
  if (!user) return null;
  if (!canAccessFieldOps(user.role)) {
    return <p className="text-sm text-danger">Admins only.</p>;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Configuration"
        title="Housing & cars"
        description="Assign lodging stays and rental cars, then manage returns."
      />
      <FieldOpsPanel />
    </div>
  );
}
