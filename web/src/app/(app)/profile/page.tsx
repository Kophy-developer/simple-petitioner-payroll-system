"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDemoSession } from "@/lib/demo-session";
import { canEditFinancialConfig } from "@/lib/access";
import { roleLabel } from "@/lib/navigation";

export default function ProfilePage() {
  const { user, updateUser } = useDemoSession();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!user) return null;

  const editableWage = canEditFinancialConfig(user.role);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const data = new FormData(e.currentTarget);
    try {
      await updateUser({
        firstName: String(data.get("firstName")),
        lastName: String(data.get("lastName")),
        phone: String(data.get("phone") || "").trim() || null,
        profileTags: String(data.get("tags"))
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Account" title="Profile" description="Your account details." />
      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
      <form onSubmit={(e) => void handleSave(e)} className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardBody className="space-y-4">
            <h2 className="font-display text-xl text-ink">Personal info</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" name="firstName" defaultValue={user.firstName} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" name="lastName" defaultValue={user.lastName} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" type="tel" defaultValue={user.phone ?? ""} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">Profile tags</Label>
              <Input
                id="tags"
                name="tags"
                defaultValue={user.profileTags.join(", ")}
                placeholder="colorado, field-lead"
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
            {saved ? <p className="text-sm text-success">Profile updated.</p> : null}
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-4">
            <h2 className="font-display text-xl text-ink">Account</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-ink/8 pb-3">
                <span className="text-ink/55">Employee ID</span>
                <span className="font-mono">{user.employeeId ?? "—"}</span>
              </div>
              <div className="flex justify-between border-b border-ink/8 pb-3">
                <span className="text-ink/55">Email</span>
                <span>{user.email}</span>
              </div>
              <div className="flex justify-between border-b border-ink/8 pb-3">
                <span className="text-ink/55">Role</span>
                <Badge tone="navy">{roleLabel(user.role)}</Badge>
              </div>
              <div className="flex justify-between border-b border-ink/8 pb-3">
                <span className="text-ink/55">Status</span>
                <Badge tone="success">{user.status}</Badge>
              </div>
              {user.hourlyWage ? (
                <div className="flex justify-between border-t border-ink/8 pt-3">
                  <span className="text-ink/55">Hourly wage</span>
                  <span className="tabular-nums">
                    {user.wageCurrency} {user.hourlyWage.toFixed(2)}
                    {editableWage ? "" : ""}
                  </span>
                </div>
              ) : null}
            </div>
          </CardBody>
        </Card>
      </form>
    </div>
  );
}
