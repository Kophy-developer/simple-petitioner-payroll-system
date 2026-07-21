"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("This reset link is invalid or expired. Request a new one.");
      }
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      await supabase.rpc("complete_password_change");
      setDone(true);
      setTimeout(() => {
        router.replace("/login");
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardBody className="space-y-6">
        <div className="text-center">
          <Image
            src="/brand/logo.svg"
            alt="Ballot Access Pros"
            width={56}
            height={56}
            className="mx-auto rounded-xl bg-ink p-2"
          />
          <p className="mt-4 text-xs uppercase tracking-[0.25em] text-civic-navy">
            Account recovery
          </p>
          <h1 className="mt-2 font-display text-3xl text-ink">Set new password</h1>
          <p className="mt-3 text-sm leading-7 text-ink/65">
            Choose a new password for your account, then sign in.
          </p>
        </div>
        <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
          <div className="space-y-2 text-left">
            <Label htmlFor="password">New password</Label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2 text-left">
            <Label htmlFor="confirm">Confirm password</Label>
            <PasswordInput
              id="confirm"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          {done ? (
            <p className="text-sm text-success">Password updated. Redirecting to sign in…</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={saving || done}>
            {saving ? "Saving…" : "Save new password"}
          </Button>
        </form>
        <Link href="/login" className="block text-center text-sm text-civic-navy hover:underline">
          Back to sign in
        </Link>
      </CardBody>
    </Card>
  );
}
