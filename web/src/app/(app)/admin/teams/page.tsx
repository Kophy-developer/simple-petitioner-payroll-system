"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useDemoSession } from "@/lib/demo-session";
import { canManageUsers, isFieldWorkerRole } from "@/lib/access";
import { roleLabel } from "@/lib/navigation";
import { listProfiles, listTeamMemberships, setTeamMembers } from "@/lib/api/live";
import type { DemoUser } from "@/lib/types";

export default function TeamsPage() {
  const { user: viewer } = useDemoSession();
  const allowed = viewer ? canManageUsers(viewer.role) : false;
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [memberships, setMemberships] = useState<{ leadId: string; memberId: string }[]>([]);
  const [selectedLead, setSelectedLead] = useState("");
  const [draft, setDraft] = useState<{ lead: string; ids: string[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const leads = useMemo(() => users.filter((u) => u.role === "team_lead"), [users]);
  const fieldWorkers = useMemo(
    () => users.filter((u) => isFieldWorkerRole(u.role) && u.status !== "offboarded"),
    [users],
  );
  const activeLead = selectedLead || leads[0]?.id || "";
  const savedMembers = memberships.filter((m) => m.leadId === activeLead).map((m) => m.memberId);
  const memberSet = draft && draft.lead === activeLead ? draft.ids : savedMembers;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [people, teams] = await Promise.all([listProfiles(), listTeamMemberships()]);
      setUsers(people);
      setMemberships(teams);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load teams.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (allowed) void load();
  }, [allowed]);

  function toggleMember(id: string) {
    const next = memberSet.includes(id) ? memberSet.filter((x) => x !== id) : [...memberSet, id];
    setDraft({ lead: activeLead, ids: next });
  }

  async function saveTeam() {
    if (!activeLead) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await setTeamMembers(activeLead, memberSet);
      setMemberships(await listTeamMemberships());
      setDraft(null);
      setMessage("Team updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update team.");
    } finally {
      setSaving(false);
    }
  }

  if (!viewer) return null;
  if (!allowed) {
    return <p className="text-sm text-danger">Admins only.</p>;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="People"
        title="Teams"
        description="Assign petitioners and canvassers to a team lead for collection oversight."
      />
      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
      {message ? <p className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">{message}</p> : null}
      {loading ? <p className="text-sm text-ink/55">Loading…</p> : null}
      <Card>
        <CardBody className="space-y-5">
          {leads.length === 0 ? (
            <p className="text-sm text-ink/55">Create a Team Lead in Employee Directory first.</p>
          ) : (
            <>
              <div className="max-w-sm space-y-2">
                <Label>Team lead</Label>
                <Select value={activeLead} onChange={(e) => setSelectedLead(e.target.value)}>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.firstName} {l.lastName}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Members</Label>
                {fieldWorkers.length === 0 ? (
                  <p className="text-sm text-ink/55">No field workers available.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {fieldWorkers.map((w) => {
                      const checked = memberSet.includes(w.id);
                      return (
                        <label
                          key={w.id}
                          className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 transition ${
                            checked
                              ? "border-brass/50 bg-brass/10"
                              : "border-ink/10 bg-white/50 hover:border-brass/30"
                          }`}
                        >
                          <span>
                            <span className="block text-sm font-medium text-ink">
                              {w.firstName} {w.lastName}
                            </span>
                            <span className="block text-xs text-ink/55">{w.email}</span>
                          </span>
                          <span className="flex items-center gap-2">
                            <Badge tone="navy">{roleLabel(w.role)}</Badge>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleMember(w.id)}
                              className="h-4 w-4 accent-brass"
                            />
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <Button onClick={() => void saveTeam()} disabled={saving || !activeLead}>
                {saving ? "Saving…" : "Save team"}
              </Button>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
