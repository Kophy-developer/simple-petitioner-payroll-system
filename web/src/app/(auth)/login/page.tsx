"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardBody } from "@/components/ui/card";
import { useDemoSession } from "@/lib/demo-session";
import { roleLabel } from "@/lib/navigation";
import { demoPassword, demoUsers } from "@/lib/demo-data";

type Mode = "password" | "otp";

function demoButtonLabel(user: (typeof demoUsers)[number]) {
  if (user.role === "super_admin") return "Super Admin";
  if (user.role === "account_admin") return "Admin";
  if (user.role === "team_lead") return "Team Lead";
  if (user.role === "canvasser") return "Casey";
  if (user.role === "validator") return "Riley";
  return user.firstName;
}

export default function LoginPage() {
  const { signIn, requestEmployeeOtp, verifyEmployeeOtp } = useDemoSession();
  const [mode, setMode] = useState<Mode>("password");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpHint, setOtpHint] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      window.location.replace(
        `/auth/callback?code=${encodeURIComponent(code)}&next=/reset-password`,
      );
      return;
    }
    const authError = params.get("error");
    if (authError) setError(authError);
    setReady(true);
  }, []);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn(identifier, password);
    if (result.error) setError(result.error);
    setLoading(false);
  }

  async function quickDemoSignIn(email: string) {
    setMode("password");
    setIdentifier(email);
    setPassword(demoPassword);
    setLoading(true);
    setError("");
    const result = await signIn(email, demoPassword);
    if (result.error) setError(result.error);
    setLoading(false);
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await requestEmployeeOtp(identifier);
      setOtpSent(true);
      setOtpHint(result.email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await verifyEmployeeOtp(identifier, otpCode);
    if (result.error) setError(result.error);
    setLoading(false);
  }

  return (
    <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="hidden flex-col justify-between rounded-3xl bg-ink p-10 text-parchment lg:flex">
        <div>
          <Image src="/brand/logo.svg" alt="Ballot Access Pros" width={72} height={72} className="rounded-2xl bg-parchment p-3" />
          <p className="mt-8 font-display text-sm tracking-[0.35em] uppercase">Ballot Access</p>
          <h1 className="font-display text-5xl tracking-[0.12em] uppercase">Pros</h1>
          <p className="mt-6 max-w-md text-base leading-8 text-parchment/75">Circulator management, validity reconciliation, payroll, field operations, and secure team messaging.</p>
        </div>
        <div className="rounded-2xl border border-parchment/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-parchment/50">Secure access</p>
          <p className="mt-2 text-sm text-parchment/70">Sign in with your email or employee ID.</p>
        </div>
      </div>
      <Card className="w-full">
        <CardBody className="space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-civic-navy">Welcome back</p>
            <h2 className="mt-2 font-display text-3xl text-ink">Sign in</h2>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "password" ? "primary" : "ghost"}
              onClick={() => {
                setMode("password");
                setError("");
                setOtpSent(false);
              }}
            >
              Email / ID + password
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "otp" ? "primary" : "ghost"}
              onClick={() => {
                setMode("otp");
                setError("");
              }}
            >
              Employee ID + code
            </Button>
          </div>

          {mode === "password" ? (
            <form onSubmit={(e) => void handlePasswordSubmit(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="identifier">Email or employee ID</Label>
                <Input
                  id="identifier"
                  name="identifier"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  suppressHydrationWarning
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/forgot-password" className="text-xs font-medium text-civic-navy hover:underline">Forgot password?</Link>
                </div>
                  <PasswordInput
                    id="password"
                    name="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    suppressHydrationWarning
                  />
              </div>
              {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={loading || !ready}>
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          ) : (
            <form
              onSubmit={(e) => void (otpSent ? handleVerifyOtp(e) : handleSendOtp(e))}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="employee-id">Employee ID</Label>
                <Input
                  id="employee-id"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  placeholder="BAP-000001"
                />
              </div>
              {otpSent ? (
                <div className="space-y-2">
                  <Label htmlFor="otp">Email code</Label>
                  <Input
                    id="otp"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />
                  <p className="text-xs text-ink/55">
                    Code sent to {otpHint || "your email"}. SMS via Twilio activates when keys are configured.
                  </p>
                </div>
              ) : null}
              {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={loading || !ready}>
                {loading
                  ? otpSent
                    ? "Verifying..."
                    : "Sending..."
                  : otpSent
                    ? "Verify code"
                    : "Send code"}
              </Button>
            </form>
          )}

          <div className="space-y-2 border-t border-ink/10 pt-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink/40">Demo</p>
            <div className="flex flex-wrap gap-1.5">
              {demoUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  disabled={loading || !ready}
                  onClick={() => void quickDemoSignIn(user.email)}
                  title={`${user.email} · ${roleLabel(user.role)}`}
                  className="rounded-md border border-ink/10 bg-parchment/40 px-2 py-1 text-[11px] font-medium text-ink/65 transition hover:border-brass/45 hover:bg-white hover:text-ink disabled:opacity-50"
                >
                  {demoButtonLabel(user)}
                </button>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
