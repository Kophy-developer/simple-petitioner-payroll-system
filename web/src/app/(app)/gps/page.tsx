"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { getUserName, liveClockUsers } from "@/lib/demo-data";

export default function GpsPage() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Field" title="GPS Map" description="Live clocked-in users and historical route review." actions={<Link href="/canvassing" className="text-sm text-civic-navy hover:underline">Campaign Sidekick overlay</Link>} />
      <Card>
        <CardBody className="relative min-h-[420px] overflow-hidden rounded-2xl bg-[linear-gradient(180deg,#e8e0d0_0%,#d4cfc3_100%)]">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, #1e2a45 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
          {liveClockUsers.map((pin) => (
            <div key={pin.userId} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="flex flex-col items-center gap-2">
                <span className="h-4 w-4 animate-pulse rounded-full bg-civic-navy ring-4 ring-civic-navy/20" />
                <Badge tone="navy">{getUserName(pin.userId)}</Badge>
              </div>
            </div>
          ))}
          <p className="absolute bottom-4 left-4 text-xs text-ink/50">{liveClockUsers.length} active session(s) · Map SDK integrates in backend phase</p>
        </CardBody>
      </Card>
    </div>
  );
}
