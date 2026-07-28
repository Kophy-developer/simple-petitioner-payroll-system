"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { RosterImportPanel } from "@/components/imports/roster-import-panel";
import { useDemoSession } from "@/lib/demo-session";
import { canManageUsers, canUploadValidity } from "@/lib/access";

type ImportTab = "employees" | "turn-ins" | "validity" | "issues";

function ImportsContent() {
  const { user } = useDemoSession();
  const router = useRouter();
  const params = useSearchParams();
  const canEmployees = user ? canManageUsers(user.role) : false;
  const canValidity = user ? canUploadValidity(user.role) : false;
  const canCollection = user
    ? ["super_admin", "account_admin"].includes(user.role)
    : false;

  const requested = params.get("tab") as ImportTab | null;
  const tab: ImportTab =
    requested === "employees" && canEmployees
      ? "employees"
      : requested === "turn-ins" && canCollection
        ? "turn-ins"
        : requested === "validity" && canValidity
          ? "validity"
          : requested === "issues" && canCollection
            ? "issues"
            : canEmployees
              ? "employees"
              : canValidity
                ? "validity"
                : canCollection
                  ? "turn-ins"
                  : "employees";

  function setTab(next: ImportTab) {
    const nextParams = new URLSearchParams();
    nextParams.set("tab", next);
    router.push(`/imports?${nextParams.toString()}`);
  }

  if (!user) return null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Collection"
        title="Imports"
        description="Import employees, turn-ins, validity, and issues."
        actions={
          <div className="flex flex-wrap rounded-full border border-ink/15 bg-white/70 p-1">
            {canEmployees ? (
              <Button
                size="sm"
                variant={tab === "employees" ? "primary" : "ghost"}
                className={tab === "employees" ? "" : "border-0 bg-transparent"}
                onClick={() => setTab("employees")}
              >
                Employees
              </Button>
            ) : null}
            {canCollection ? (
              <Button
                size="sm"
                variant={tab === "turn-ins" ? "primary" : "ghost"}
                className={tab === "turn-ins" ? "" : "border-0 bg-transparent"}
                onClick={() => setTab("turn-ins")}
              >
                Turn-ins
              </Button>
            ) : null}
            {canValidity ? (
              <Button
                size="sm"
                variant={tab === "validity" ? "primary" : "ghost"}
                className={tab === "validity" ? "" : "border-0 bg-transparent"}
                onClick={() => setTab("validity")}
              >
                Validity
              </Button>
            ) : null}
            {canCollection ? (
              <Button
                size="sm"
                variant={tab === "issues" ? "primary" : "ghost"}
                className={tab === "issues" ? "" : "border-0 bg-transparent"}
                onClick={() => setTab("issues")}
              >
                Issues
              </Button>
            ) : null}
          </div>
        }
      />

      {tab === "employees" && canEmployees ? <RosterImportPanel /> : null}

      {tab === "turn-ins" && canCollection ? (
        <Card>
          <CardBody className="space-y-4">
            <h3 className="font-display text-xl text-ink">Turn-in reports</h3>
            <p className="text-sm text-ink/55">
              Upload collection workbooks and map petition columns.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/turn-ins">
                <Button>Open turn-in import</Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {tab === "validity" && canValidity ? (
        <Card>
          <CardBody className="space-y-4">
            <h3 className="font-display text-xl text-ink">Validity files</h3>
            <p className="text-sm text-ink/55">
              Upload batch reports, final validity, or enter results manually.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/validity">
                <Button>Open validity import</Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {tab === "issues" && canCollection ? (
        <Card>
          <CardBody className="space-y-4">
            <h3 className="font-display text-xl text-ink">Issues & petitions</h3>
            <p className="text-sm text-ink/55">Create and edit issues and petition lines.</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/issues">
                <Button>Open issues & petitions</Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

export default function ImportsPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center">Loading imports…</div>}>
      <ImportsContent />
    </Suspense>
  );
}
