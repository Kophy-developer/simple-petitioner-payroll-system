"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { conversations } from "@/lib/demo-data";
import { formatDate } from "@/lib/format";

export default function MessagesPage() {
  const sorted = [...conversations].sort((a, b) => {
    if (a.type === "management") return -1;
    if (b.type === "management") return 1;
    return b.lastMessageAt.localeCompare(a.lastMessageAt);
  });

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Communications" title="Messaging" description="Encrypted conversations. Notification payloads show sender name only." />
      <div className="grid gap-3">
        {sorted.map((c) => (
          <Link key={c.id} href={`/messages/${c.id}`}>
            <Card className="transition hover:border-brass/30"><CardBody className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-medium text-ink">{c.name}</h2>
                  {c.type === "management" ? <Badge tone="navy">Pinned</Badge> : null}
                </div>
                <p className="text-xs text-ink/50">{formatDate(c.lastMessageAt)} · {c.type}</p>
              </div>
              {c.unread > 0 ? <Badge tone="warning">{c.unread}</Badge> : null}
            </CardBody></Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
