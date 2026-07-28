"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  downloadCredentialsWorkbook,
  downloadRosterTemplate,
  parseRosterWorkbook,
  type CredentialExportRow,
  type RosterImportRow,
} from "@/lib/roster-import";
import type { UserRole } from "@/lib/types";

export function RosterImportPanel({ onImported }: { onImported?: () => void }) {
  const [preview, setPreview] = useState<RosterImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [credentials, setCredentials] = useState<CredentialExportRow[]>([]);

  async function onFile(file: File | null) {
    setError("");
    setMessage("");
    setCredentials([]);
    setPreview([]);
    setFileName(file?.name ?? "");
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      setPreview(parseRosterWorkbook(buffer));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not parse employee file.");
    }
  }

  async function importRoster() {
    if (!preview.length) return;
    setImporting(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: preview.map((row) => ({
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email,
            phone: row.phone,
            role: (row.role as UserRole | undefined) || "petitioner",
          })),
        }),
      });
      const payload = (await res.json()) as {
        error?: string;
        created?: CredentialExportRow[];
        errors?: { row: number; message: string }[];
      };
      if (!res.ok) throw new Error(payload.error || "Could not import employees.");
      const created = payload.created ?? [];
      setCredentials(created);
      setMessage(
        `Created ${created.length} account(s)${
          payload.errors?.length ? ` · ${payload.errors.length} row error(s)` : ""
        }.`,
      );
      if (payload.errors?.length) {
        setError(payload.errors.map((e) => `Row ${e.row}: ${e.message}`).join(" · "));
      }
      setPreview([]);
      onImported?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not import employees.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Card>
      <CardBody className="space-y-5">
        <div>
          <h3 className="font-display text-xl text-ink">Employees</h3>
          <p className="mt-1 text-sm text-ink/55">
            Columns: First, Last, Email, Role, Phone (optional).
          </p>
        </div>
        {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
        {message ? (
          <p className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">{message}</p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button variant="ghost" onClick={() => downloadRosterTemplate()}>
            Download template
          </Button>
        </div>
        <div className="space-y-2">
          <Label htmlFor="imports-roster-file">Employee workbook</Label>
          <Input
            id="imports-roster-file"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
          {fileName ? <p className="text-xs text-ink/55">{fileName}</p> : null}
        </div>
        {preview.length ? (
          <p className="text-sm text-ink/70">{preview.length} row(s) ready to import.</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void importRoster()} disabled={importing || preview.length === 0}>
            {importing ? "Creating accounts…" : "Create accounts"}
          </Button>
          {credentials.length ? (
            <Button
              variant="ghost"
              onClick={() =>
                downloadCredentialsWorkbook(
                  credentials,
                  `bap-credentials-${new Date().toISOString().slice(0, 10)}.xlsx`,
                )
              }
            >
              Download credentials Excel
            </Button>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
