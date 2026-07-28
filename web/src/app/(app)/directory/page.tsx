"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { canManageUsers } from "@/lib/access";
import { useDemoSession } from "@/lib/demo-session";
import { roleLabel } from "@/lib/navigation";
import { formatCurrency } from "@/lib/format";
import {
  listProfiles,
  listTeamMemberships,
  setTeamMembers,
} from "@/lib/api/live";
import {
  downloadCredentialsWorkbook,
  downloadRosterTemplate,
  parseRosterWorkbook,
  sortDirectoryUsers,
  type CredentialExportRow,
} from "@/lib/roster-import";
import type { DemoUser, UserRole, WageCurrency } from "@/lib/types";
import { ledgerIndividualHref } from "@/lib/ledger-person";

export default function DirectoryPage() {
  const { user: viewer } = useDemoSession();
  const canCreate = viewer ? canManageUsers(viewer.role) : false;
  const canManagePeople =
    viewer?.role === "super_admin" || viewer?.role === "account_admin";

  const [users, setUsers] = useState<DemoUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("demo1234");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("petitioner");
  const [hourlyWage, setHourlyWage] = useState("");
  const [currency, setCurrency] = useState<WageCurrency>("USD");
  const [memberships, setMemberships] = useState<
    { leadId: string; memberId: string }[]
  >([]);
  const [selectedLead, setSelectedLead] = useState("");
  const [draft, setDraft] = useState<{ lead: string; ids: string[] } | null>(null);
  const [savingTeam, setSavingTeam] = useState(false);
  const [teamMessage, setTeamMessage] = useState("");
  const [rosterPreview, setRosterPreview] = useState<
    { firstName: string; lastName: string; email: string; role?: string; phone?: string }[]
  >([]);
  const [rosterFileName, setRosterFileName] = useState("");
  const [importingRoster, setImportingRoster] = useState(false);
  const [credentials, setCredentials] = useState<CredentialExportRow[]>([]);
  const [rosterMessage, setRosterMessage] = useState("");
  const [sendingInvites, setSendingInvites] = useState(false);

  const sortedUsers = useMemo(() => sortDirectoryUsers(users), [users]);
  const pendingInvites = users.filter((u) => !u.inviteSentAt && u.status !== "offboarded").length;

  const leads = users.filter((u) => u.role === "team_lead");
  const fieldWorkers = users.filter((u) =>
    ["petitioner", "validator"].includes(u.role),
  );
  const activeLead = selectedLead || leads[0]?.id || "";
  const savedMembers = memberships
    .filter((m) => m.leadId === activeLead)
    .map((m) => m.memberId);
  const memberSet = draft && draft.lead === activeLead ? draft.ids : savedMembers;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [people, teams] = await Promise.all([
        listProfiles(),
        listTeamMemberships(),
      ]);
      setUsers(people);
      setMemberships(teams);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load directory.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function toggleMember(id: string) {
    const next = memberSet.includes(id)
      ? memberSet.filter((x) => x !== id)
      : [...memberSet, id];
    setDraft({ lead: activeLead, ids: next });
  }

  async function saveTeam() {
    if (!activeLead) return;
    setSavingTeam(true);
    setError("");
    setTeamMessage("");
    try {
      await setTeamMembers(activeLead, memberSet);
      const teams = await listTeamMemberships();
      setMemberships(teams);
      setDraft(null);
      setTeamMessage("Team updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update team.");
    } finally {
      setSavingTeam(false);
    }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName,
          phone: phone || undefined,
          role,
          hourlyWage: hourlyWage === "" ? null : parseFloat(hourlyWage),
          wageCurrency: currency,
        }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error || "Could not create user.");
      setOpen(false);
      setEmail("");
      setPassword("demo1234");
      setFirstName("");
      setLastName("");
      setPhone("");
      setRole("petitioner");
      setHourlyWage("");
      setCurrency("USD");
      setMessage("User created (invite held until Send all invites).");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create user.");
    } finally {
      setSaving(false);
    }
  }

  async function onRosterFile(file: File | null) {
    setRosterMessage("");
    setCredentials([]);
    setRosterPreview([]);
    setRosterFileName(file?.name ?? "");
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      setRosterPreview(parseRosterWorkbook(buffer));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not parse employee file.");
    }
  }

  async function importRoster() {
    if (!rosterPreview.length) return;
    setImportingRoster(true);
    setError("");
    setRosterMessage("");
    try {
      const res = await fetch("/api/admin/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: rosterPreview.map((row) => ({
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email,
            phone: row.phone,
            role: (row.role as UserRole | undefined) || "petitioner",
          })),
        }),
      });
      const payload = (await res.json()) as {
        error?: string;
        created?: CredentialExportRow[];
        errors?: { row: number; message: string }[];
      };
      if (!res.ok) throw new Error(payload.error || "Could not import employees.");
      const created = payload.created ?? [];
      setCredentials(created);
      setRosterMessage(
        `Created ${created.length} account(s)${
          payload.errors?.length ? ` · ${payload.errors.length} row error(s)` : ""
        }. Invites are held until you click Send all invites.`,
      );
      if (payload.errors?.length) {
        setError(payload.errors.map((e) => `Row ${e.row}: ${e.message}`).join(" · "));
      }
      setRosterPreview([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not import employees.");
    } finally {
      setImportingRoster(false);
    }
  }

  async function sendAllInvites() {
    setSendingInvites(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/invites", { method: "POST" });
      const payload = (await res.json()) as {
        error?: string;
        sent?: number;
        note?: string;
      };
      if (!res.ok) throw new Error(payload.error || "Could not send invites.");
      setMessage(`Activated ${payload.sent ?? 0} account(s). ${payload.note ?? ""}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send invites.");
    } finally {
      setSendingInvites(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="People"
        title="Employee Directory"
        description="Manage employees, import, and teams."
        actions={
          canCreate ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                disabled={sendingInvites || pendingInvites === 0}
                onClick={() => void sendAllInvites()}
              >
                {sendingInvites ? "Sending…" : `Send all invites (${pendingInvites})`}
              </Button>
              <Button onClick={() => setOpen(true)}>Create user</Button>
            </div>
          ) : undefined
        }
      />
      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
      {message ? <p className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">{message}</p> : null}
      {loading ? <p className="text-sm text-ink/55">Loading directory…</p> : null}

      <Card>
        <CardBody className="p-0">
          <DataTable>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Employee ID</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Invite</Th>
                <Th>Wage</Th>
                <Th>Ledger</Th>
                {canManagePeople ? <Th /> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8 bg-white/50">
              {sortedUsers.map((u) => (
                <tr key={u.id}>
                  <Td>
                    {u.firstName} {u.lastName}
                    {u.isLotus ? (
                      <Badge tone="navy" className="ml-2">
                        Lotus
                      </Badge>
                    ) : null}
                  </Td>
                  <Td className="font-mono">{u.employeeId ?? "—"}</Td>
                  <Td>{u.email}</Td>
                  <Td>
                    <Badge tone="navy">{roleLabel(u.role)}</Badge>
                  </Td>
                  <Td>
                    <Badge
                      tone={
                        u.status === "active"
                          ? "success"
                          : u.status === "offboarded"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {u.status}
                    </Badge>
                  </Td>
                  <Td>
                    {u.inviteSentAt ? (
                      <Badge tone="success">Sent</Badge>
                    ) : (
                      <Badge tone="warning">Held</Badge>
                    )}
                  </Td>
                  <Td>{u.hourlyWage ? formatCurrency(u.hourlyWage) : "—"}</Td>
                  <Td>
                    <Link
                      href={ledgerIndividualHref(u, users)}
                      className="font-medium text-civic-navy hover:underline"
                    >
                      View
                    </Link>
                  </Td>
                  {canManagePeople ? (
                    <Td>
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="text-sm font-medium text-civic-navy hover:underline"
                      >
                        Edit
                      </Link>
                    </Td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </DataTable>
        </CardBody>
      </Card>

      {canManagePeople ? (
        <>
          <Card>
            <CardBody className="space-y-5">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-ink/50">Import employees</p>
                <h3 className="font-display text-xl text-ink">Upload roster</h3>
                <p className="mt-1 text-sm text-ink/55">
                  Columns: First, Last, Email, Role, Phone (optional). Accounts stay disabled until
                  invites are sent.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="ghost" onClick={() => downloadRosterTemplate()}>
                  Download template
                </Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="roster-file">Employee workbook</Label>
                <Input
                  id="roster-file"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => void onRosterFile(e.target.files?.[0] ?? null)}
                />
                {rosterFileName ? <p className="text-xs text-ink/55">{rosterFileName}</p> : null}
              </div>
              {rosterPreview.length ? (
                <p className="text-sm text-ink/70">{rosterPreview.length} row(s) ready to import.</p>
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => void importRoster()}
                  disabled={importingRoster || rosterPreview.length === 0}
                >
                  {importingRoster ? "Creating accounts…" : "Create accounts"}
                </Button>
                {credentials.length ? (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      downloadCredentialsWorkbook(
                        credentials,
                        `bap-credentials-${new Date().toISOString().slice(0, 10)}.xlsx`,
                      )
                    }
                  >
                    Download credentials Excel
                  </Button>
                ) : null}
                {rosterMessage ? <span className="text-sm text-success">{rosterMessage}</span> : null}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-5">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-ink/50">Teams</p>
                <h3 className="font-display text-xl text-ink">
                  Assign field workers to a team lead
                </h3>
                <p className="mt-1 text-sm text-ink/55">
                  Team leads see the ledger and dashboard for the members assigned here.
                </p>
              </div>
              {leads.length === 0 ? (
                <p className="text-sm text-ink/55">
                  Create a Team Lead user first to build a team.
                </p>
              ) : (
                <>
                  <div className="max-w-sm space-y-2">
                    <Label>Team lead</Label>
                    <Select
                      value={activeLead}
                      onChange={(e) => setSelectedLead(e.target.value)}
                    >
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
                  <div className="flex items-center gap-3">
                    <Button onClick={() => void saveTeam()} disabled={savingTeam}>
                      {savingTeam ? "Saving…" : "Save team"}
                    </Button>
                    {teamMessage ? (
                      <span className="text-sm text-success">{teamMessage}</span>
                    ) : null}
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        </>
      ) : null}

      <Modal open={open} onClose={() => setOpen(false)} title="Create user">
        <form className="space-y-4" onSubmit={(e) => void createUser(e)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>First name</Label>
              <Input required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Last name</Label>
              <Input required value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Phone (optional)</Label>
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                {(
                  [
                    "super_admin",
                    "account_admin",
                    "team_lead",
                    "petitioner",
                    "validator",
                  ] as UserRole[]
                ).map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Temporary password</Label>
            <PasswordInput
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Hourly wage</Label>
              <Input
                type="number"
                step="0.01"
                value={hourlyWage}
                onChange={(e) => setHourlyWage(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={currency} onChange={(e) => setCurrency(e.target.value as WageCurrency)}>
                <option value="USD">USD</option>
                <option value="PHP">PHP</option>
              </Select>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Creating…" : "Create user"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
