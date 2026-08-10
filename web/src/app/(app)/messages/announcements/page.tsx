"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDemoSession } from "@/lib/demo-session";
import { canPostInChannel, canReactInChannel } from "@/lib/phase2/roles-and-chat-acl";

const sampleAnnouncements = [
  {
    id: "a1",
    title: "Colorado weekend coverage",
    body: "Team leads: confirm petitioner and canvasser coverage by Friday noon.",
    from: "Admin",
  },
  {
    id: "a2",
    title: "Validity drop reminder",
    body: "Upload validity files through Imports — auto drop-folder lands in a later Phase 2 slice.",
    from: "Admin",
  },
];

export default function AnnouncementsPage() {
  const { user } = useDemoSession();
  const [draft, setDraft] = useState("");
  const [msg, setMsg] = useState("");

  const role = user?.role ?? "petitioner";
  const canPost = canPostInChannel(role, "announcement");
  const canReact = canReactInChannel(role, "announcement");

  const reactions = useMemo(() => ["👍", "👀", "🙏"], []);

  async function tryPost() {
    setMsg("");
    if (!canPost.allowed) {
      setMsg(canPost.reason);
      return;
    }
    const res = await fetch("/api/phase2/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "announcement", body: draft }),
    });
    const payload = await res.json();
    setMsg(
      res.status === 503
        ? "You may post here when chat infra is live. Nothing was stored."
        : payload.error || "Unexpected response",
    );
  }

  if (!user) return null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Phase 2"
        title="Announcements"
        description="Management broadcast channel. Admin post only; team and field may react."
        actions={
          <Link href="/messages">
            <Button type="button" variant="ghost" size="sm">
              Back to messages
            </Button>
          </Link>
        }
      />
      <div className="flex flex-wrap gap-2">
        <Badge tone={canPost.allowed ? "success" : "navy"}>
          {canPost.allowed ? "Can post" : "Read / react"}
        </Badge>
        <Badge>{canReact.allowed ? "Can react" : "No react"}</Badge>
      </div>
      <div className="space-y-4">
        {sampleAnnouncements.map((a) => (
          <Card key={a.id}>
            <CardBody className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl text-ink">{a.title}</h2>
                  <p className="text-xs text-ink/45">{a.from}</p>
                </div>
              </div>
              <p className="text-sm leading-7 text-ink/70">{a.body}</p>
              {canReact.allowed ? (
                <div className="flex flex-wrap gap-2">
                  {reactions.map((r) => (
                    <button
                      key={r}
                      type="button"
                      className="rounded-full border border-ink/10 px-3 py-1 text-sm"
                      onClick={() =>
                        setMsg("Reaction preview only — not stored until chat infra is live.")
                      }
                    >
                      {r}
                    </button>
                  ))}
                </div>
              ) : null}
            </CardBody>
          </Card>
        ))}
      </div>
      <Card>
        <CardBody className="space-y-3">
          <h2 className="font-display text-lg text-ink">Compose announcement</h2>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            disabled={!canPost.allowed}
            placeholder={canPost.allowed ? "Announcement body" : canPost.reason}
            className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm disabled:opacity-50"
          />
          <Button type="button" disabled={!canPost.allowed || !draft.trim()} onClick={() => void tryPost()}>
            Post (ACL check)
          </Button>
          {msg ? <p className="text-sm text-ink/70">{msg}</p> : null}
        </CardBody>
      </Card>
    </div>
  );
}
