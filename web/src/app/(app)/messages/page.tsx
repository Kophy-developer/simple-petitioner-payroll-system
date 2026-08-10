"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDemoSession } from "@/lib/demo-session";
import {
  canMessageRole,
  canPostInChannel,
  canReactInChannel,
  type ChatChannelKind,
} from "@/lib/phase2/roles-and-chat-acl";
import { roleLabel } from "@/lib/navigation";
import type { UserRole } from "@/lib/types";
import { demoUsers } from "@/lib/demo-data";
import { isFieldWorkerRole, visibleUserIds } from "@/lib/access";

type ThreadPreview = {
  id: string;
  kind: ChatChannelKind;
  title: string;
  subtitle: string;
  canPost: boolean;
  canReact: boolean;
};

const architectureChannels: { kind: ChatChannelKind; title: string; subtitle: string }[] = [
  { kind: "announcement", title: "Announcements", subtitle: "Admin posts; field can react" },
  { kind: "management", title: "Management", subtitle: "Admin coordination" },
  { kind: "team", title: "Team channel", subtitle: "Lead + petitioners / canvassers" },
  { kind: "group", title: "Tagged group", subtitle: "Ad-hoc group with role ACL" },
];

export default function MessagesPage() {
  const { user } = useDemoSession();
  const [statusNote, setStatusNote] = useState("");
  const [composeTo, setComposeTo] = useState<UserRole>("team_lead");
  const [composeText, setComposeText] = useState("");
  const [composeMsg, setComposeMsg] = useState("");

  useEffect(() => {
    void fetch("/api/phase2/chat")
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || "Chat status failed");
        setStatusNote(payload.note || payload.status || "");
      })
      .catch((e) => setStatusNote(e instanceof Error ? e.message : "Unavailable"));
  }, []);

  const role = user?.role ?? "petitioner";

  const directoryTargets = useMemo(() => {
    if (!user) return [];
    const ids = new Set(
      visibleUserIds(
        {
          id: user.id,
          authId: user.authId,
          role: user.role,
          teamMemberIds: user.teamMemberIds,
        },
        demoUsers.map((u) => u.id),
      ),
    );
    return demoUsers.filter((u) => {
      if (u.id === user.id) return false;
      if (user.role === "team_lead") {
        if (!ids.has(u.id) && !["super_admin", "account_admin", "team_lead"].includes(u.role)) {
          return false;
        }
      }
      return canMessageRole(user.role, u.role).allowed;
    });
  }, [user]);

  const channels: ThreadPreview[] = useMemo(
    () =>
      architectureChannels.map((c) => ({
        id: c.kind,
        kind: c.kind,
        title: c.title,
        subtitle: c.subtitle,
        canPost: canPostInChannel(role, c.kind).allowed,
        canReact: canReactInChannel(role, c.kind).allowed,
      })),
    [role],
  );

  const dmCheck = canMessageRole(role, composeTo);

  async function trySend() {
    setComposeMsg("");
    if (!dmCheck.allowed) {
      setComposeMsg(dmCheck.reason);
      return;
    }
    const res = await fetch("/api/phase2/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toRole: composeTo, body: composeText }),
    });
    const payload = await res.json();
    setComposeMsg(
      res.status === 503
        ? "ACL would allow this message. Storage is deferred — nothing was saved."
        : payload.error || "Unexpected response",
    );
  }

  if (!user) return null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Phase 2"
        title="Messages"
        description="Secure chat UI and ACL preview. Ciphertext storage and live delivery stay off the Phase 1 droplet."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/messages/announcements">
              <Button type="button" variant="ghost" size="sm">
                Announcements
              </Button>
            </Link>
            {user.role === "super_admin" || user.role === "account_admin" ? (
              <Link href="/phase2/agora-lab">
                <Button type="button" variant="secondary" size="sm">
                  Agora lab
                </Button>
              </Link>
            ) : null}
          </div>
        }
      />
      <p className="text-sm text-ink/55">{statusNote || "Loading chat status…"}</p>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardBody className="space-y-3">
            <h2 className="font-display text-lg text-ink">Channels</h2>
            <ul className="space-y-2">
              {channels.map((c) => (
                <li key={c.id} className="rounded-lg border border-ink/10 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-ink">{c.title}</span>
                    <Badge tone={c.canPost ? "success" : "navy"}>{c.canPost ? "post" : "read"}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-ink/55">{c.subtitle}</p>
                  <p className="mt-1 text-xs text-ink/45">
                    React: {c.canReact ? "yes" : "no"}
                  </p>
                </li>
              ))}
            </ul>
            <h2 className="pt-2 font-display text-lg text-ink">People</h2>
            <ul className="max-h-64 space-y-1 overflow-auto text-sm text-ink/70">
              {directoryTargets.length === 0 ? (
                <li>No ACL-allowed contacts in preview roster.</li>
              ) : (
                directoryTargets.map((u) => (
                  <li key={u.id} className="flex justify-between gap-2">
                    <span>
                      {u.firstName} {u.lastName}
                    </span>
                    <span className="text-ink/45">{roleLabel(u.role)}</span>
                  </li>
                ))
              )}
            </ul>
            {user.role === "team_lead" ? (
              <p className="text-xs text-ink/55">
                Team lead directory is scoped to your team roster plus leads/admins. You may lead
                petitioners and/or canvassers.
              </p>
            ) : null}
            {isFieldWorkerRole(user.role) ? (
              <p className="text-xs text-ink/55">
                Petitioner and canvasser messaging rules match until Phase 3.
              </p>
            ) : null}
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-4">
            <h2 className="font-display text-xl text-ink">Compose (ACL check only)</h2>
            <label className="block space-y-1 text-sm">
              <span className="text-ink/70">Recipient role</span>
              <select
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value as UserRole)}
                className="w-full rounded-md border border-ink/15 bg-white px-3 py-2"
              >
                {(
                  [
                    "super_admin",
                    "account_admin",
                    "team_lead",
                    "petitioner",
                    "canvasser",
                    "validator",
                  ] as UserRole[]
                ).map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-sm text-ink/60">
              {dmCheck.allowed ? "Allowed: " : "Blocked: "}
              {dmCheck.reason}
            </p>
            <textarea
              value={composeText}
              onChange={(e) => setComposeText(e.target.value)}
              rows={5}
              placeholder="Message preview — not stored"
              className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
            />
            <Button type="button" onClick={() => void trySend()} disabled={!composeText.trim()}>
              Check send
            </Button>
            {composeMsg ? <p className="text-sm text-ink/70">{composeMsg}</p> : null}
            <div className="rounded-xl border border-dashed border-ink/15 p-4 text-sm text-ink/55">
              Planned: E2E ciphertext, reactions, receipts, polls, and Agora voice/video inside threads.
              Nothing is persisted on the Phase 1 server yet.
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
