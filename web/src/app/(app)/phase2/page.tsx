"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SupabaseTotpEnrollPanel } from "@/components/phase2/supabase-totp-enroll-panel";
import { createClient } from "@/lib/supabase/client";
import { teamLeadScopeNote, teamLeadManageableRoles } from "@/lib/access";
import { roleLabel } from "@/lib/navigation";

type LaterFeature = {
  id: string;
  title: string;
  summary: string;
  dependsOn: string[];
};

type StatusPayload = {
  mfa?: { status?: string; note?: string };
  brexContractors?: { status?: string; note?: string };
  agora?: { status?: string; note?: string; configured?: boolean };
  secureChat?: { status?: string; note?: string };
  laterFeatures?: { status?: string; features?: LaterFeature[]; note?: string };
  email?: { configured?: boolean };
  rolesAndChatAcl?: Record<string, string>;
  serverSafety?: { dropletAllows?: string[]; dropletBlocked?: string[] };
};

export default function Phase2AdminPage() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [error, setError] = useState("");
  const [mfaAllowed, setMfaAllowed] = useState(false);
  const [brexSim, setBrexSim] = useState("");
  const [agoraSim, setAgoraSim] = useState("");

  useEffect(() => {
    void fetch("/api/phase2/status")
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || "Could not load Phase 2 status");
        setData(payload);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));

    void (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      setMfaAllowed(profile?.role === "super_admin" || profile?.role === "account_admin");
    })();
  }, []);

  async function runBrexDryRun() {
    setBrexSim("Running…");
    const res = await fetch("/api/phase2/brex-contractors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "dry_run" }),
    });
    const payload = await res.json();
    setBrexSim(
      res.ok
        ? `OK — paymentScopesOk=${String(payload.paymentScopesOk)} (no ACH sent)`
        : payload.error || "Dry-run failed",
    );
  }

  async function runAgoraSim() {
    setAgoraSim("Running…");
    const res = await fetch("/api/phase2/agora/simulate", { method: "POST" });
    const payload = await res.json();
    setAgoraSim(
      res.ok
        ? `OK — channel ${payload.channelName}; publisher token len ${payload.publisher?.tokenLength}`
        : payload.error || "Simulate failed",
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Phase 2"
        title="Phase 2 scaffolding"
        description="Client UI and deferred status while Phase 1 testing continues. No Phase 2 money/schema on the droplet yet except email."
      />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl text-ink">Server safety</h2>
              <Badge>Phase 1 test</Badge>
            </div>
            <p className="text-sm text-ink/70">
              Allowed on droplet: {(data?.serverSafety?.dropletAllows ?? []).join(", ") || "—"}
            </p>
            <p className="text-sm text-ink/70">
              Blocked for now: {(data?.serverSafety?.dropletBlocked ?? []).join(", ") || "—"}
            </p>
            <p className="text-sm text-ink/70">
              Email configured: {data?.email?.configured ? "yes" : "not yet"}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-3">
            <h2 className="font-display text-xl text-ink">Authenticator 2FA (Supabase TOTP)</h2>
            <p className="text-sm text-ink/70">{data?.mfa?.status ?? "…"}</p>
            <p className="text-sm text-ink/55">{data?.mfa?.note}</p>
            <Link href="/profile" className="text-sm text-civic-navy underline">
              Open Profile enroll UI
            </Link>
            <SupabaseTotpEnrollPanel allowed={mfaAllowed} />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-3">
            <h2 className="font-display text-xl text-ink">Brex contractor payments</h2>
            <p className="text-sm text-ink/70">{data?.brexContractors?.status ?? "…"}</p>
            <p className="text-sm text-ink/55">{data?.brexContractors?.note}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => void runBrexDryRun()}>
                Run payment dry-run
              </Button>
              <Link href="/brex/contractor-payouts">
                <Button type="button" size="sm" variant="secondary">
                  Payout draft UI
                </Button>
              </Link>
            </div>
            {brexSim ? <p className="text-sm text-ink/70">{brexSim}</p> : null}
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-3">
            <h2 className="font-display text-xl text-ink">Agora voice / video</h2>
            <p className="text-sm text-ink/70">{data?.agora?.status ?? "…"}</p>
            <p className="text-sm text-ink/55">{data?.agora?.note}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => void runAgoraSim()}>
                Mint test tokens
              </Button>
              <Link href="/phase2/agora-lab">
                <Button type="button" size="sm" variant="ghost">
                  Open Agora lab
                </Button>
              </Link>
            </div>
            {agoraSim ? <p className="text-sm text-ink/70">{agoraSim}</p> : null}
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-2">
            <h2 className="font-display text-xl text-ink">Secure chat</h2>
            <p className="text-sm text-ink/70">{data?.secureChat?.status ?? "…"}</p>
            <p className="text-sm text-ink/55">{data?.secureChat?.note}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link href="/messages">
                <Button type="button" size="sm" variant="secondary">
                  Messages UI
                </Button>
              </Link>
              <Link href="/messages/announcements">
                <Button type="button" size="sm" variant="ghost">
                  Announcements
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-2">
            <h2 className="font-display text-xl text-ink">Team Lead scope</h2>
            <p className="text-sm text-ink/70">{teamLeadScopeNote()}</p>
            <p className="text-sm text-ink/55">
              May manage:{" "}
              {teamLeadManageableRoles()
                .map((r) => roleLabel(r))
                .join(", ")}
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink/70">
              {Object.entries(data?.rolesAndChatAcl ?? {}).map(([k, v]) => (
                <li key={k}>
                  <span className="font-medium text-ink">{k}:</span> {v}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Card className="md:col-span-2">
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl text-ink">Later Phase 2 features</h2>
              <Badge>{data?.laterFeatures?.status ?? "…"}</Badge>
            </div>
            <p className="text-sm text-ink/55">{data?.laterFeatures?.note}</p>
            <div className="grid gap-3 md:grid-cols-2">
              {(data?.laterFeatures?.features ?? []).map((f) => (
                <div key={f.id} className="rounded-xl border border-ink/10 px-4 py-3">
                  <h3 className="font-medium text-ink">{f.title}</h3>
                  <p className="mt-1 text-sm text-ink/65">{f.summary}</p>
                  <p className="mt-2 text-xs text-ink/45">
                    Depends on: {(f.dependsOn ?? []).join(" · ") || "—"}
                  </p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
