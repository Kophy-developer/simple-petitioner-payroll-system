"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Factor = {
  id: string;
  friendly_name?: string;
  factor_type?: string;
  status?: string;
};

type EnrollPayload = {
  id: string;
  totp?: { qr_code?: string; secret?: string; uri?: string };
};

export function SupabaseTotpEnrollPanel({
  allowed,
  purpose = "login",
}: {
  allowed: boolean;
  purpose?: "login" | "brex_payment";
}) {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enroll, setEnroll] = useState<EnrollPayload | null>(null);
  const [code, setCode] = useState("");
  const [aal, setAal] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data: listData, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) {
      setMessage(listError.message);
      return;
    }
    const all = [...(listData?.totp ?? []), ...(listData?.phone ?? [])] as Factor[];
    setFactors(all);
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setAal(
      aalData?.currentLevel
        ? `${aalData.currentLevel} → next ${aalData.nextLevel ?? "—"}`
        : "unknown",
    );
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function startEnroll() {
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName:
          purpose === "brex_payment"
            ? "Ballot Access Pros — payouts"
            : "Ballot Access Pros Authenticator",
      });
      if (error) {
        setMessage(error.message);
        return;
      }
      setEnroll(data as EnrollPayload);
      setMessage("Scan the QR in Google Authenticator or Authy, then enter a 6-digit code.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyEnroll() {
    if (!enroll?.id || !code.trim()) return;
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const challenge = await supabase.auth.mfa.challenge({ factorId: enroll.id });
      if (challenge.error) {
        setMessage(challenge.error.message);
        return;
      }
      const verify = await supabase.auth.mfa.verify({
        factorId: enroll.id,
        challengeId: challenge.data.id,
        code: code.trim(),
      });
      if (verify.error) {
        setMessage(verify.error.message);
        return;
      }
      setMessage("Authenticator factor verified.");
      setEnroll(null);
      setCode("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function challengeExisting() {
    const factor = factors.find((f) => f.status === "verified") ?? factors[0];
    if (!factor || !code.trim()) {
      setMessage("Enter the code from your authenticator app.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const challenge = await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (challenge.error) {
        setMessage(challenge.error.message);
        return;
      }
      const verify = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challenge.data.id,
        code: code.trim(),
      });
      if (verify.error) {
        setMessage(verify.error.message);
        return;
      }
      setMessage(
        purpose === "brex_payment"
          ? "Step-up verified for payouts (AAL2). Live ACH remains off until Phase 1 sign-off."
          : "Step-up verified (AAL2).",
      );
      setCode("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!allowed) {
    return (
      <p className="text-sm text-ink/55">
        Authenticator enrollment is for account admins and super admins. Server MFA enforcement stays
        deferred while Phase 1 testing continues.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink/70">Assurance: {aal || "…"}</p>
      <ul className="space-y-1 text-sm text-ink/70">
        {factors.length === 0 ? <li>No factors enrolled yet.</li> : null}
        {factors.map((f) => (
          <li key={f.id}>
            {(f.friendly_name || f.factor_type || "factor") + " — " + (f.status || "unknown")}
          </li>
        ))}
      </ul>
      {enroll?.totp?.qr_code ? (
        <div className="space-y-3">
          <div
            className="h-40 w-40 rounded bg-white bg-contain bg-center bg-no-repeat p-2"
            style={{ backgroundImage: `url(${enroll.totp.qr_code})` }}
            role="img"
            aria-label="Authenticator QR"
          />
          {enroll.totp.secret ? (
            <p className="break-all font-mono text-xs text-ink/60">Secret: {enroll.totp.secret}</p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="mfa-enroll-code">6-digit code</Label>
            <Input
              id="mfa-enroll-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              placeholder="123456"
            />
          </div>
          <Button type="button" disabled={busy} onClick={() => void verifyEnroll()}>
            Verify authenticator
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Button type="button" disabled={busy} onClick={() => void startEnroll()}>
            Enroll authenticator
          </Button>
          {factors.length > 0 ? (
            <div className="space-y-2 border-t border-ink/8 pt-3">
              <Label htmlFor="mfa-stepup-code">Step-up code (for payouts / sensitive actions)</Label>
              <Input
                id="mfa-stepup-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                placeholder="123456"
              />
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void challengeExisting()}
              >
                Verify step-up
              </Button>
            </div>
          ) : null}
        </div>
      )}
      {message ? <p className="text-sm text-ink/70">{message}</p> : null}
    </div>
  );
}
