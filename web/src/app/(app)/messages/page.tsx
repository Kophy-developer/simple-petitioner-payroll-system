"use client";

import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";

export default function MessagesPlaceholderPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Phase 2"
        title="Messages"
        description="Secure chat is scaffolded. Hosting, E2E encryption, and role ACLs are defined in code; live messaging is deferred."
      />
      <Card>
        <CardBody className="space-y-3 text-sm leading-7 text-ink/70">
          <p>
            Planned: direct/group chat, team leader tags, management and announcement channels,
            reactions, read/delivered receipts, polls, and group audio/video — stored on Ballot Access
            Pros infrastructure with role-based who-can-message-whom rules.
          </p>
          <p>No messages are stored on the Phase 1 server yet.</p>
        </CardBody>
      </Card>
    </div>
  );
}
