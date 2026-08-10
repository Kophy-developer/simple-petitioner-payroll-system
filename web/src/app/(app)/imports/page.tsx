"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { RosterImportPanel } from "@/components/imports/roster-import-panel";
import { useDemoSession } from "@/lib/demo-session";
import { canManageUsers, canUploadValidity } from "@/lib/access";

const destinations = [
  {
    href: "/turn-ins",
    title: "Turn-in reports",
    description: "Upload collection workbooks and map petition columns.",
    show: (role: string) => ["super_admin", "account_admin"].includes(role),
  },
  {
    href: "/validity",
    title: "Validity files",
    description: "Upload batch reports, final validity, or enter results manually.",
    show: (role: string) => canUploadValidity(role as never),
  },
  {
    href: "/issues",
    title: "Issues & petitions",
    description: "Create and edit issues and petition lines.",
    show: (role: string) => ["super_admin", "account_admin"].includes(role),
  },
] as const;

export default function ImportsPage() {
  const { user } = useDemoSession();
  if (!user) return null;

  const canEmployees = canManageUsers(user.role);
  const links = destinations.filter((d) => d.show(user.role));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Collection"
        title="Imports"
        description="Employee roster import lives here. Other uploads open on their own screens."
      />

      {canEmployees ? <RosterImportPanel /> : null}

      {links.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between rounded-2xl border border-ink/10 bg-white/70 px-5 py-4 transition hover:border-brass/30 hover:bg-brass/5"
            >
              <div>
                <p className="text-sm font-medium text-ink">{item.title}</p>
                <p className="mt-1 text-xs text-ink/55">{item.description}</p>
              </div>
              <ArrowRight size={16} className="shrink-0 text-ink/35" />
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
