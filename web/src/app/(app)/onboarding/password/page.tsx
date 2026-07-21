"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardBody } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useDemoSession } from "@/lib/demo-session";

export default function OnboardingPasswordPage() {
  const { user, updateUser } = useDemoSession();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error: authErr } = await supabase.auth.updateUser({ password });
      if (authErr) throw authErr;
      const { error: rpcErr } = await supabase.rpc("complete_password_change");
      if (rpcErr) throw rpcErr;
      await updateUser({ mustChangePassword: false });
      router.replace(user!.onboardingComplete ? "/dashboard" : "/onboarding/contact");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <PageHeader
        eyebrow="Setup"
        title="Create your password"
        description="Your temporary password must be changed before you continue."
      />
      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
      <Card>
        <CardBody>
          <form className="space-y-4" onSubmit={(e) => void submit(e)}>
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Saving…" : "Save password and continue"}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
