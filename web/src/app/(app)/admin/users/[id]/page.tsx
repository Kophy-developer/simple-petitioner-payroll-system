"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardBody } from "@/components/ui/card";
import { roleLabel } from "@/lib/navigation";
import { getProfile, updateUserAdmin } from "@/lib/api/live";
import type { DemoUser, UserRole, UserStatus, WageCurrency } from "@/lib/types";

export default function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [user, setUser] = useState<DemoUser | null>(null);
  const [role, setRole] = useState<UserRole>("petitioner");
  const [status, setStatus] = useState<UserStatus>("active");
  const [hourlyWage, setHourlyWage] = useState("");
  const [currency, setCurrency] = useState<WageCurrency>("USD");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void getProfile(id)
      .then((profile) => {
        setUser(profile);
        if (profile) {
          setRole(profile.role);
          setStatus(profile.status);
          setHourlyWage(profile.hourlyWage !== undefined ? String(profile.hourlyWage) : "");
          setCurrency(profile.wageCurrency ?? "USD");
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load user."))
      .finally(() => setLoading(false));
  }, [id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const updated = await updateUserAdmin({
        userId: id,
        role,
        status,
        hourlyWage: hourlyWage === "" ? null : parseFloat(hourlyWage),
        wageCurrency: currency,
      });
      setUser(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save user.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="py-20 text-center text-sm text-ink/55">Loading…</p>;
  if (!user) return <p className="py-20 text-center">User not found.</p>;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title={`Edit ${user.firstName} ${user.lastName}`}
        description="Role, status, wage, and currency."
        actions={
          <Link href="/admin" className="text-sm text-civic-navy hover:underline">
            Back
          </Link>
        }
      />
      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
      <Card className="max-w-xl">
        <CardBody>
          <form className="space-y-4" onSubmit={(e) => void save(e)}>
            <div className="grid gap-4 sm:grid-cols-2">
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
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onChange={(e) => setStatus(e.target.value as UserStatus)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </div>
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
                <Select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as WageCurrency)}
                >
                  {(["USD", "PHP"] as WageCurrency[]).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save user"}
            </Button>
            {saved ? <p className="text-sm text-success">User updated.</p> : null}
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
