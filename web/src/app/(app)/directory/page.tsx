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
import { listProfiles } from "@/lib/api/live";
import { sortDirectoryUsers } from "@/lib/roster-import";
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
  const [sendingInvites, setSendingInvites] = useState(false);

  const sortedUsers = useMemo(() => sortDirectoryUsers(users), [users]);
  const pendingInvites = users.filter((u) => !u.inviteSentAt && u.status !== "offboarded").length;

  async function load() {
    setLoading(true);
    setError("");
    try {
      setUsers(await listProfiles());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load directory.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

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
      const payload = (await res.json()) as {
        error?: string;
        inviteEmailed?: boolean;
        note?: string;
      };
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
      setMessage(
        payload.inviteEmailed
          ? `User created and invite emailed. ${payload.note ?? ""}`
          : `User created. Invite pending — ${payload.note ?? "use Send all invites after mail is configured."}`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create user.");
    } finally {
      setSaving(false);
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
      setMessage(
        `Invites: ${payload.sent ?? 0} emailed. ${payload.note ?? ""}`.trim(),
      );
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
        description="Create and edit people, invites, and wages. Team assignment lives under Teams."
        actions={
          canCreate ? (
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/teams">
                <Button variant="ghost">Teams</Button>
              </Link>
              <Link href="/imports">
                <Button variant="ghost">Import roster</Button>
              </Link>
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
                    "canvasser",
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
