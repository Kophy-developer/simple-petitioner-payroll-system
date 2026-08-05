"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");
    setSent(false);
    try {
      const res = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Could not send reset email.");
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email.");
    } finally {
      setSending(false);
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
          <h1 className="mt-2 font-display text-3xl text-ink">Reset password</h1>
          <p className="mt-3 text-sm leading-7 text-ink/65">
            Enter your account email and we will send a reset link.
          </p>
        </div>
        <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
          <div className="space-y-2 text-left">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          {sent ? (
            <p className="text-sm text-success">Reset link sent if that email exists.</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={sending}>
            {sending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
        <Link href="/login" className="block text-center text-sm text-civic-navy hover:underline">
          Back to sign in
        </Link>
      </CardBody>
    </Card>
  );
}
