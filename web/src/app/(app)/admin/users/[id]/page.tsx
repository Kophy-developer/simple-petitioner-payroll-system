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
import { createClient } from "@/lib/supabase/client";
import { getProfile, updateUserAdmin } from "@/lib/api/live";
import { listSubAccounts, setUserSubAccount } from "@/lib/api/remodel";
import type { DemoUser, SubAccount, UserRole, UserStatus, WageCurrency } from "@/lib/types";

export default function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [user, setUser] = useState<DemoUser | null>(null);
  const [role, setRole] = useState<UserRole>("petitioner");
  const [status, setStatus] = useState<UserStatus>("active");
  const [hourlyWage, setHourlyWage] = useState("");
  const [currency, setCurrency] = useState<WageCurrency>("USD");
  const [employeeId, setEmployeeId] = useState("");
  const [subAccountId, setSubAccountId] = useState("");
  const [accounts, setAccounts] = useState<SubAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([getProfile(id), listSubAccounts()])
      .then(([profile, subs]) => {
        setAccounts(subs);
        setUser(profile);
        if (profile) {
          setRole(profile.role);
          setStatus(profile.status);
          setHourlyWage(profile.hourlyWage !== undefined ? String(profile.hourlyWage) : "");
          setCurrency(profile.wageCurrency ?? "USD");
          setEmployeeId(profile.employeeId ?? "");
          setSubAccountId(profile.subAccountId ?? subs.find((s) => s.isPrimary)?.id ?? "");
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
      const supabase = createClient();
      const { error: empErr } = await supabase
        .from("profiles")
        .update({ employee_id: employeeId.trim() || null })
        .eq("id", id);
      if (empErr) throw empErr;
      if (subAccountId) await setUserSubAccount(id, subAccountId);
      setUser({
        ...updated,
        employeeId: employeeId.trim() || null,
        subAccountId: subAccountId || null,
      });
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
                  <option value="offboarded">Offboarded</option>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Employee ID</Label>
                <Input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Sub-account</Label>
                <Select value={subAccountId} onChange={(e) => setSubAccountId(e.target.value)}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
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
