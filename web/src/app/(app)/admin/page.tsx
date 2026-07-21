"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { roleLabel } from "@/lib/navigation";
import { formatCurrency } from "@/lib/format";
import {
  getBenchmark,
  listProfiles,
  listTeamMemberships,
  setTeamMembers,
} from "@/lib/api/live";
import {
  downloadCredentialsWorkbook,
  parseRosterWorkbook,
  type CredentialExportRow,
} from "@/lib/roster-import";
import type { DemoUser, UserRole, WageCurrency } from "@/lib/types";

export default function AdminPage() {
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [benchmark, setBenchmark] = useState(75);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("demo1234");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [initials, setInitials] = useState("");
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
    { firstName: string; lastName: string; initials: string; role?: string }[]
  >([]);
  const [rosterFileName, setRosterFileName] = useState("");
  const [importingRoster, setImportingRoster] = useState(false);
  const [credentials, setCredentials] = useState<CredentialExportRow[]>([]);
  const [rosterMessage, setRosterMessage] = useState("");

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
      const [people, pct, teams] = await Promise.all([
        listProfiles(),
        getBenchmark(),
        listTeamMemberships(),
      ]);
      setUsers(people);
      setBenchmark(pct);
      setMemberships(teams);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load admin data.");
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
          initials,
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
      setInitials("");
      setRole("petitioner");
      setHourlyWage("");
      setCurrency("USD");
      setMessage("User created.");
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
      setError(e instanceof Error ? e.message : "Could not parse roster file.");
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
            initials: row.initials,
            role: (row.role as UserRole | undefined) || "petitioner",
          })),
        }),
      });
      const payload = (await res.json()) as {
        error?: string;
        created?: CredentialExportRow[];
        errors?: { row: number; message: string }[];
      };
      if (!res.ok) throw new Error(payload.error || "Could not import roster.");
      const created = payload.created ?? [];
      setCredentials(created);
      setRosterMessage(
        `Created ${created.length} account(s)${
          payload.errors?.length ? ` · ${payload.errors.length} row error(s)` : ""
        }. Download the credentials sheet before leaving this page.`,
      );
      if (payload.errors?.length) {
        setError(payload.errors.map((e) => `Row ${e.row}: ${e.message}`).join(" · "));
      }
      setRosterPreview([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not import roster.");
    } finally {
      setImportingRoster(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Configuration"
        title="Admin Panel"
        description="Users, wages, currency, and system benchmark."
        actions={<Button onClick={() => setOpen(true)}>Create user</Button>}
      />
      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
      {message ? <p className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">{message}</p> : null}
      {loading ? <p className="text-sm text-ink/55">Loading…</p> : null}
      <Card className="max-w-sm">
        <CardBody>
          <p className="text-xs uppercase tracking-[0.2em] text-ink/50">Benchmark %</p>
          <p className="font-display text-4xl tabular-nums">{benchmark}%</p>
          <Link href="/pay-rates" className="mt-3 inline-block text-sm text-civic-navy hover:underline">
            Edit via pay rates
          </Link>
        </CardBody>
      </Card>
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
                <Th>Wage</Th>
                <Th>Currency</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8 bg-white/50">
              {users.map((u) => (
                <tr key={u.id}>
                  <Td>
                    {u.firstName} {u.lastName}
                  </Td>
                  <Td>{u.employeeId ?? "—"}</Td>
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
                  <Td>{u.hourlyWage ? formatCurrency(u.hourlyWage) : "—"}</Td>
                  <Td>{u.wageCurrency ?? "—"}</Td>
                  <Td>
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="text-sm font-medium text-civic-navy hover:underline"
                    >
                      Edit
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-ink/50">Roster</p>
            <h3 className="font-display text-xl text-ink">Import names &amp; initials</h3>
            <p className="mt-1 text-sm text-ink/55">
              Upload an Excel with First Name, Last Name, Initials. The system assigns 5-digit
              employee IDs and temporary passwords, then you download a credentials sheet.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="roster-file">Roster workbook</Label>
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
              <Label>Initials</Label>
              <Input required maxLength={3} value={initials} onChange={(e) => setInitials(e.target.value)} />
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
            <Input
              required
              type="text"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
