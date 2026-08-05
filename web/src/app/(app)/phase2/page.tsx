"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type StatusPayload = {
  mfa?: { status?: string; note?: string };
  brexContractors?: { status?: string; note?: string };
  secureChat?: { status?: string; note?: string };
  laterFeatures?: { status?: string };
  email?: { configured?: boolean };
  rolesAndChatAcl?: Record<string, string>;
  serverSafety?: { dropletAllows?: string[]; dropletBlocked?: string[] };
};

export default function Phase2AdminPage() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/phase2/status")
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || "Could not load Phase 2 status");
        setData(payload);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Phase 2"
        title="Phase 2 scaffolding"
        description="Design and deferred status while Phase 1 testing continues. No Phase 2 money/schema on the droplet yet except email."
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
          <CardBody className="space-y-2">
            <h2 className="font-display text-xl text-ink">Authenticator 2FA</h2>
            <p className="text-sm text-ink/70">{data?.mfa?.status ?? "…"}</p>
            <p className="text-sm text-ink/55">{data?.mfa?.note}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-2">
            <h2 className="font-display text-xl text-ink">Brex contractor payments</h2>
            <p className="text-sm text-ink/70">{data?.brexContractors?.status ?? "…"}</p>
            <p className="text-sm text-ink/55">{data?.brexContractors?.note}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-2">
            <h2 className="font-display text-xl text-ink">Secure chat</h2>
            <p className="text-sm text-ink/70">{data?.secureChat?.status ?? "…"}</p>
            <p className="text-sm text-ink/55">{data?.secureChat?.note}</p>
          </CardBody>
        </Card>
        <Card className="md:col-span-2">
          <CardBody className="space-y-2">
            <h2 className="font-display text-xl text-ink">Chat role alignment</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink/70">
              {Object.entries(data?.rolesAndChatAcl ?? {}).map(([k, v]) => (
                <li key={k}>
                  <span className="font-medium text-ink">{k}:</span> {v}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
