"use client";

import { useCallback, useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { canUploadValidity } from "@/lib/access";
import { formatApiError } from "@/lib/api-error";
import { useDemoSession } from "@/lib/demo-session";
import { formatPercent } from "@/lib/format";
import {
  applyValidityUpload,
  listIssues,
  listProfiles,
  listValidity,
  uploadValidityFile,
  upsertValidityManual,
} from "@/lib/api/live";
import {
  importTurnInValidityRows,
  listTurnInColumns,
  listTurnIns,
} from "@/lib/api/remodel";
import { parseValidityWorkbook, type ValidityPreviewRow } from "@/lib/validity-excel";
import {
  parseCoBatchValidityWorkbook,
  parseMiFinalValidityWorkbook,
} from "@/lib/validity-import";
import type { DemoUser, Issue, TurnIn, TurnInColumn, ValidityRecord } from "@/lib/types";

export default function ValidityPage() {
  const { user } = useDemoSession();
  const [tab, setTab] = useState<"upload" | "manual" | "turnin">("manual");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [issueId, setIssueId] = useState("");
  const [petitioners, setPetitioners] = useState<DemoUser[]>([]);
  const [profiles, setProfiles] = useState<DemoUser[]>([]);
  const [userId, setUserId] = useState("");
  const [records, setRecords] = useState<ValidityRecord[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [dups, setDups] = useState("0");
  const [usable, setUsable] = useState("0");
  const [valid, setValid] = useState("0");
  const [validityPct, setValidityPct] = useState("75");
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ValidityPreviewRow[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [turnIns, setTurnIns] = useState<TurnIn[]>([]);
  const [turnInId, setTurnInId] = useState("");
  const [columns, setColumns] = useState<TurnInColumn[]>([]);
  const [columnId, setColumnId] = useState("");
  const [importShape, setImportShape] = useState<"co" | "mi">("co");
  const [turnInPreview, setTurnInPreview] = useState<
    { name: string; dups: number; usable: number; valid: number; failed?: number; wrongCounty?: number }[]
  >([]);

  const canWrite = user ? canUploadValidity(user.role) : false;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [issueRows, people, validityRows, turnInRows] = await Promise.all([
        listIssues(),
        listProfiles(),
        listValidity(),
        listTurnIns(),
      ]);
      setIssues(issueRows);
      setProfiles(people);
      setTurnIns(turnInRows);
      const pet = people.filter((p) => p.role === "petitioner");
      setPetitioners(pet);
      if (!issueId && issueRows[0]) setIssueId(issueRows[0].id);
      if (!userId && pet[0]) setUserId(pet[0].id);
      if (!turnInId && turnInRows[0]) setTurnInId(turnInRows[0].id);
      setRecords(validityRows);
      setNames(
        Object.fromEntries(people.map((p) => [p.id, `${p.firstName} ${p.lastName}`])),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load validity data.");
    } finally {
      setLoading(false);
    }
  }, [issueId, userId, turnInId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!turnInId) {
      setColumns([]);
      setColumnId("");
      return;
    }
    void listTurnInColumns(turnInId)
      .then((cols) => {
        setColumns(cols);
        setColumnId((prev) => prev || cols[0]?.id || "");
      })
      .catch(() => {
        setColumns([]);
        setColumnId("");
      });
  }, [turnInId]);

  if (!user) return null;

  async function saveManual(e: React.FormEvent) {
    e.preventDefault();
    if (!issueId || !userId) return;
    setSaving(true);
    setError("");
    try {
      await upsertValidityManual({
        issueId,
        userId,
        dups: parseInt(dups, 10),
        usable: parseInt(usable, 10),
        valid: parseInt(valid, 10),
        validityPct: parseFloat(validityPct),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      await load();
    } catch (err) {
      setError(formatApiError(err, "Could not save validity."));
    } finally {
      setSaving(false);
    }
  }

  async function onFile(file: File | null) {
    setError("");
    setMessage("");
    setPreview([]);
    setPendingFile(file);
    setFileName(file?.name ?? null);
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const rows = parseValidityWorkbook(
        buffer,
        profiles.map((p) => ({
          id: p.id,
          initials: p.initials,
          email: p.email,
          firstName: p.firstName,
          lastName: p.lastName,
          phone: p.phone,
        })),
      );
      setPreview(rows);
      if (rows.length === 0) {
        setError(
          "No data rows found. Expected headers like Name, Email, Phone, DUPs, Usable, Valid, Validity%.",
        );
      }
    } catch (err) {
      setError(formatApiError(err, "Could not parse workbook."));
    }
  }

  async function commitUpload() {
    if (!issueId || !pendingFile) return;
    const matched = preview.filter((r) => r.status === "matched" && r.userId);
    if (matched.length === 0) {
      setError("No matched rows to import.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      let archiveWarning = "";
      try {
        await uploadValidityFile(issueId, pendingFile);
      } catch (uploadErr) {
        archiveWarning = formatApiError(uploadErr, "Could not archive upload file.");
      }
      const count = await applyValidityUpload(
        issueId,
        matched.map((r) => ({
          userId: r.userId as string,
          dups: r.dups,
          usable: r.usable,
          valid: r.valid,
          validityPct: r.validityPct,
        })),
      );
      setMessage(
        archiveWarning
          ? `Imported ${count} validity row(s). File archive skipped: ${archiveWarning}`
          : `Imported ${count} validity row(s). Ledgers recalculated where submissions exist.`,
      );
      setPreview([]);
      setPendingFile(null);
      setFileName(null);
      await load();
    } catch (err) {
      setError(formatApiError(err, "Could not import validity."));
    } finally {
      setSaving(false);
    }
  }

  async function onTurnInFile(file: File | null) {
    setError("");
    setMessage("");
    setTurnInPreview([]);
    setFileName(file?.name ?? null);
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      if (importShape === "co") {
        const rows = parseCoBatchValidityWorkbook(buffer);
        setTurnInPreview(
          rows.map((r) => ({
            name: r.circulator,
            dups: r.duplicateN,
            usable: r.usableCn,
            valid: r.validCn,
          })),
        );
      } else {
        const rows = parseMiFinalValidityWorkbook(buffer);
        setTurnInPreview(
          rows.map((r) => ({
            name: r.name,
            dups: r.duplicate,
            usable: r.usableRaw,
            valid: r.valid,
            failed: r.failed,
            wrongCounty: r.wrongCounty,
          })),
        );
      }
    } catch (err) {
      setError(formatApiError(err, "Could not parse workbook."));
    }
  }

  async function commitTurnInImport() {
    if (!columnId || turnInPreview.length === 0) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const count = await importTurnInValidityRows({
        columnId,
        rows: turnInPreview,
        profiles: profiles.map((p) => ({
          id: p.id,
          initials: p.initials,
          firstName: p.firstName,
          lastName: p.lastName,
          email: p.email,
          phone: p.phone,
        })),
      });
      setMessage(`Imported ${count} turn-in validity row(s). Ledger lines recalculated.`);
      setTurnInPreview([]);
      setFileName(null);
    } catch (err) {
      setError(formatApiError(err, "Could not import turn-in validity."));
    } finally {
      setSaving(false);
    }
  }

  const issueLabel = (id: string) => issues.find((i) => i.id === id)?.issueNumber ?? id;
  const visibleRecords = issueId ? records.filter((r) => r.issueId === issueId) : records;
  const matchedCount = preview.filter((r) => r.status === "matched").length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Collection"
        title="Validity Records"
        description="Enter or upload validity results."
      />

      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
      {message ? <p className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">{message}</p> : null}
      {loading ? <p className="text-sm text-ink/55">Loading…</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button variant={tab === "manual" ? "primary" : "ghost"} size="sm" onClick={() => setTab("manual")}>
          Manual entry
        </Button>
        <Button variant={tab === "upload" ? "primary" : "ghost"} size="sm" onClick={() => setTab("upload")}>
          Upload Validity
        </Button>
        <Button variant={tab === "turnin" ? "primary" : "ghost"} size="sm" onClick={() => setTab("turnin")}>
          Turn-in import
        </Button>
      </div>

      {!canWrite ? (
        <Card>
          <CardBody>
            <p className="text-sm text-ink/65">You can view validity records. Validators and admins can enter data.</p>
          </CardBody>
        </Card>
      ) : tab === "manual" ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <Card className="max-w-2xl">
            <CardBody>
              <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => void saveManual(e)}>
                <div className="space-y-2">
                  <Label>Issue</Label>
                  <Select value={issueId} onChange={(e) => setIssueId(e.target.value)}>
                    {issues.map((i) => (
                      <option key={i.id} value={i.id}>{i.issueNumber}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Circulator</Label>
                  <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
                    {petitioners.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>DUPs</Label>
                  <Input type="number" min={0} value={dups} onChange={(e) => setDups(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Usable</Label>
                  <Input type="number" min={0} value={usable} onChange={(e) => setUsable(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Valid</Label>
                  <Input type="number" min={0} value={valid} onChange={(e) => setValid(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Validity %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={validityPct}
                    onChange={(e) => setValidityPct(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Save row"}
                  </Button>
                  {saved ? (
                    <span className="ml-3 text-sm text-success">Saved — ledger recalculated.</span>
                  ) : null}
                </div>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-display text-xl text-ink">Existing rows</h2>
            </CardHeader>
            <CardBody className="p-0">
              <DataTable>
                <thead>
                  <tr>
                    <Th>Issue</Th>
                    <Th>Circulator</Th>
                    <Th align="right">DUPs</Th>
                    <Th align="right">Usable</Th>
                    <Th align="right">Valid</Th>
                    <Th align="right">Validity %</Th>
                    <Th>Method</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/8 bg-white/50">
                  {visibleRecords.map((r) => (
                    <tr key={r.id}>
                      <Td>{issueLabel(r.issueId)}</Td>
                      <Td>{names[r.userId] ?? "Unknown"}</Td>
                      <Td align="right">{r.dups}</Td>
                      <Td align="right">{r.usable}</Td>
                      <Td align="right">{r.valid}</Td>
                      <Td align="right">{formatPercent(r.validityPercent)}</Td>
                      <Td><Badge>{r.entryMethod}</Badge></Td>
                    </tr>
                  ))}
                  {visibleRecords.length === 0 ? (
                    <tr>
                      <Td colSpan={7}>
                        <p className="py-6 text-center text-sm text-ink/50">No validity rows yet.</p>
                      </Td>
                    </tr>
                  ) : null}
                </tbody>
              </DataTable>
            </CardBody>
          </Card>
        </div>
      ) : tab === "turnin" ? (
        <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
          <Card>
            <CardHeader>
              <h2 className="font-display text-xl text-ink">Turn-in validity import</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="space-y-2">
                <Label>Report shape</Label>
                <Select
                  value={importShape}
                  onChange={(e) => setImportShape(e.target.value as "co" | "mi")}
                >
                  <option value="co">Batch report</option>
                  <option value="mi">Final Validity</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Turn-in</Label>
                <Select value={turnInId} onChange={(e) => setTurnInId(e.target.value)}>
                  {turnIns.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.turnInNumber}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priced column</Label>
                <Select value={columnId} onChange={(e) => setColumnId(e.target.value)}>
                  {columns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} (${c.pay})
                    </option>
                  ))}
                </Select>
              </div>
              <label className="flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-ink/15 py-10 transition hover:border-brass/40">
                <Upload className="text-ink/45" />
                <p className="mt-2 text-sm font-medium">Drop workbook</p>
                <input
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => void onTurnInFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {fileName ? <p className="text-sm text-ink/70">{fileName}</p> : null}
              <Button
                className="w-full"
                disabled={saving || !columnId || turnInPreview.length === 0}
                onClick={() => void commitTurnInImport()}
              >
                {saving ? "Importing…" : `Import ${turnInPreview.length} row(s)`}
              </Button>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <h2 className="font-display text-xl text-ink">Preview</h2>
            </CardHeader>
            <CardBody className="p-0">
              <DataTable>
                <thead>
                  <tr>
                    <Th>Circulator</Th>
                    <Th align="right">DUPs</Th>
                    <Th align="right">Usable</Th>
                    <Th align="right">Valid</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/8 bg-white/50">
                  {turnInPreview.map((row, idx) => (
                    <tr key={`${row.name}-${idx}`}>
                      <Td>{row.name}</Td>
                      <Td align="right">{row.dups}</Td>
                      <Td align="right">{row.usable}</Td>
                      <Td align="right">{row.valid}</Td>
                    </tr>
                  ))}
                  {turnInPreview.length === 0 ? (
                    <tr>
                      <Td colSpan={4}>
                        <p className="py-8 text-center text-sm text-ink/50">
                          Choose a batch report or Final Validity workbook.
                        </p>
                      </Td>
                    </tr>
                  ) : null}
                </tbody>
              </DataTable>
            </CardBody>
          </Card>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
          <Card>
            <CardHeader><h2 className="font-display text-xl text-ink">Upload Excel</h2></CardHeader>
            <CardBody className="space-y-4">
              <div className="space-y-2">
                <Label>Issue</Label>
                <Select value={issueId} onChange={(e) => setIssueId(e.target.value)}>
                  {issues.map((i) => (
                    <option key={i.id} value={i.id}>{i.issueNumber}</option>
                  ))}
                </Select>
              </div>
              <label className="flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-ink/15 py-10 transition hover:border-brass/40">
                <Upload className="text-ink/45" />
                <p className="mt-2 text-sm font-medium">Drop Excel workbook</p>
                <p className="mt-1 px-4 text-center text-xs text-ink/45">
                  Columns: Name / Email / Phone, DUPs, Usable, Valid, Validity%
                </p>
                <input
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {fileName ? <p className="text-sm text-ink/70">{fileName}</p> : null}
              <Button
                className="w-full"
                disabled={saving || matchedCount === 0}
                onClick={() => void commitUpload()}
              >
                {saving ? "Importing…" : `Commit ${matchedCount} matched row(s)`}
              </Button>
            </CardBody>
          </Card>
          <Card>
            <CardHeader className="flex justify-between">
              <h2 className="font-display text-xl text-ink">Preview</h2>
              <Badge tone={matchedCount ? "success" : "warning"}>
                {preview.length ? `${matchedCount}/${preview.length} matched` : "Awaiting file"}
              </Badge>
            </CardHeader>
            <CardBody className="p-0">
              <DataTable>
                <thead>
                  <tr>
                    <Th>Row</Th>
                    <Th>User</Th>
                    <Th align="right">DUPs</Th>
                    <Th align="right">Usable</Th>
                    <Th align="right">Valid</Th>
                    <Th align="right">%</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/8 bg-white/50">
                  {preview.map((row) => (
                    <tr key={row.rowNumber}>
                      <Td>{row.rowNumber}</Td>
                      <Td>{row.name}</Td>
                      <Td align="right">{row.dups}</Td>
                      <Td align="right">{row.usable}</Td>
                      <Td align="right">{row.valid}</Td>
                      <Td align="right">{formatPercent(row.validityPct)}</Td>
                      <Td>
                        <Badge tone={row.status === "matched" ? "success" : "warning"}>
                          {row.status}
                        </Badge>
                        {row.error ? <p className="mt-1 text-xs text-danger">{row.error}</p> : null}
                      </Td>
                    </tr>
                  ))}
                  {preview.length === 0 ? (
                    <tr>
                      <Td colSpan={7}>
                        <p className="py-8 text-center text-sm text-ink/50">
                          Choose a workbook to preview matched circulators.
                        </p>
                      </Td>
                    </tr>
                  ) : null}
                </tbody>
              </DataTable>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
