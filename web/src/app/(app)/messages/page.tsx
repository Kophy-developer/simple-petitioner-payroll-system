import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";

export default function MessagesComingSoonPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Phase 2"
        title="Messages"
        description="Messaging, group chats, and calls ship in Phase 2."
      />
      <Card>
        <CardBody className="space-y-3 py-16 text-center">
          <p className="font-display text-3xl text-ink">Coming soon</p>
          <p className="mx-auto max-w-md text-sm leading-7 text-ink/60">
            Phase 2 will add encrypted messaging, announcements, and Agora voice/video calls.
            This nav item is reserved so the menu does not restructure later.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
