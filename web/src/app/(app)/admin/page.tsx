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
import { getBenchmark, listProfiles } from "@/lib/api/live";
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

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [people, pct] = await Promise.all([listProfiles(), getBenchmark()]);
      setUsers(people);
      setBenchmark(pct);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load admin data.");
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
                  <Td>{u.email}</Td>
                  <Td>
                    <Badge tone="navy">{roleLabel(u.role)}</Badge>
                  </Td>
                  <Td>
                    <Badge tone={u.status === "active" ? "success" : "warning"}>{u.status}</Badge>
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
                    "canvasser",
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
