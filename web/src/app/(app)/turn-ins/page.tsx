"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { listProfiles } from "@/lib/api/live";
import {
  createTurnIn,
  exposeAllTurnInsToSubmissions,
  importTurnInReport,
  listPricedPetitionLines,
  listTurnIns,
  savePricedPetitionLine,
} from "@/lib/api/remodel";
import { formatTurnInNumber } from "@/lib/turn-in-number";
import {
  parseTurnInReportWorkbook,
  summarizeTurnInReport,
  type TurnInReportParseResult,
} from "@/lib/turn-in-report-excel";
import type { PricedPetitionLine, TurnIn } from "@/lib/types";
import { formatDate } from "@/lib/format";

type SheetOverride = {
  turnInNumber: string;
  turnInDate: string;
};

export default function TurnInsPage() {
  const [rows, setRows] = useState<TurnIn[]>([]);
  const [lines, setLines] = useState<PricedPetitionLine[]>([]);
  const [open, setOpen] = useState(false);
  const [lineOpen, setLineOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [state, setState] = useState("CO");
  const [turnInDate, setTurnInDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [benchmarkPct, setBenchmarkPct] = useState("75");
  const [selectedLines, setSelectedLines] = useState<string[]>([]);
  const [lineCode, setLineCode] = useState("");
  const [lineName, setLineName] = useState("");
  const [linePay, setLinePay] = useState("");
  const [lineLotus, setLineLotus] = useState("");
  const [officialNumber, setOfficialNumber] = useState("");
  const [officialName, setOfficialName] = useState("");
  const [ontargetName, setOntargetName] = useState("");
  const [clientReportName, setClientReportName] = useState("");
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [parsedReport, setParsedReport] = useState<TurnInReportParseResult | null>(null);
  const [uploadFileName, setUploadFileName] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [importBenchmark, setImportBenchmark] = useState("70");
  const [sheetOverrides, setSheetOverrides] = useState<Record<string, SheetOverride>>({});

  const turnInNumber = useMemo(
    () => formatTurnInNumber(state, turnInDate),
    [state, turnInDate],
  );

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [turnIns, priced] = await Promise.all([listTurnIns(), listPricedPetitionLines()]);
      setRows(turnIns);
      setLines(priced);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load turn-ins.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function toggleLine(id: string) {
    setSelectedLines((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function resetLineForm() {
    setEditingLineId(null);
    setLineCode("");
    setLineName("");
    setLinePay("");
    setLineLotus("");
    setOfficialNumber("");
    setOfficialName("");
    setOntargetName("");
    setClientReportName("");
  }

  function editLine(line: PricedPetitionLine) {
    setEditingLineId(line.id);
    setLineCode(line.code);
    setLineName(line.name);
    setLinePay(String(line.pay));
    setLineLotus(String(line.lotusPay));
    setOfficialNumber(line.officialNumber ?? "");
    setOfficialName(line.officialName ?? "");
    setOntargetName(line.ontargetName ?? "");
    setClientReportName(line.clientReportName ?? "");
    setLineOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!turnInNumber) {
      setError("Pick a state and collection date so the turn-in number can be generated (e.g. CO-07-04).");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createTurnIn({
        turnInNumber,
        name: name.trim() || turnInNumber,
        state,
        turnInDate: turnInDate || null,
        benchmarkPct: parseFloat(benchmarkPct) || 75,
        pricedLineIds: selectedLines,
      });
      setOpen(false);
      setName("");
      setSelectedLines([]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create turn-in.");
    } finally {
      setSaving(false);
    }
  }

  async function submitLine(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await savePricedPetitionLine({
        id: editingLineId ?? undefined,
        name: lineName,
        code: lineCode,
        pay: parseFloat(linePay) || 0,
        lotusPay: parseFloat(lineLotus) || 0,
        officialNumber: officialNumber || null,
        officialName: officialName || null,
        ontargetName: ontargetName || null,
        clientReportName: clientReportName || null,
      });
      setLineOpen(false);
      resetLineForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save petition line.");
    } finally {
      setSaving(false);
    }
  }

  async function onUploadFile(file: File | null) {
    setUploadMessage("");
    setParsedReport(null);
    setSheetOverrides({});
    setUploadFileName(file?.name ?? "");
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseTurnInReportWorkbook(buffer);
      setParsedReport(parsed);
      const next: Record<string, SheetOverride> = {};
      for (const issue of parsed.issues) {
        next[issue.sheetName] = {
          turnInNumber: issue.turnInNumber,
          turnInDate: "",
        };
      }
      setSheetOverrides(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not parse turn-in report.");
    }
  }

  function setSheetDate(sheetName: string, dateIso: string) {
    setSheetOverrides((prev) => {
      const current = prev[sheetName] ?? { turnInNumber: "", turnInDate: "" };
      const number = dateIso
        ? formatTurnInNumber(parsedReport?.state || state, dateIso) || current.turnInNumber
        : current.turnInNumber;
      return {
        ...prev,
        [sheetName]: {
          turnInDate: dateIso,
          turnInNumber: number,
        },
      };
    });
  }

  async function commitUpload() {
    if (!parsedReport) return;
    setSaving(true);
    setError("");
    setUploadMessage("");
    try {
      const profiles = await listProfiles();
      const result = await importTurnInReport({
        parsed: parsedReport,
        benchmarkPct: parseFloat(importBenchmark) || 70,
        profiles: profiles.map((p) => ({
          id: p.id,
          initials: p.initials,
          firstName: p.firstName,
          lastName: p.lastName,
        })),
        overrides: Object.fromEntries(
          Object.entries(sheetOverrides).map(([sheet, value]) => [
            sheet,
            {
              turnInNumber: value.turnInNumber,
              turnInDate: value.turnInDate || null,
            },
          ]),
        ),
      });
      setUploadMessage(
        `Imported ${result.issueCount} turn-in(s): ${result.createdTurnIns} new, ${result.updatedEntries} entry cell(s).` +
          (result.unmatched.length
            ? ` Unmatched circulators (${result.unmatched.length}): ${result.unmatched.slice(0, 8).join(", ")}${result.unmatched.length > 8 ? "…" : ""}`
            : ""),
      );
      setParsedReport(null);
      setUploadFileName("");
      setSheetOverrides({});
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not import turn-in report.");
    } finally {
      setSaving(false);
    }
  }

  const summary = parsedReport ? summarizeTurnInReport(parsedReport) : null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Collection"
        title="Turn-ins"
        description="A turn-in is each time signatures are collected from the team (usually weekly). Numbers use the state and collection date, for example CO-07-04. Petition columns (ROAD, TAX, GAS) are mapped separately."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                void (async () => {
                  setSaving(true);
                  setError("");
                  try {
                    const result = await exposeAllTurnInsToSubmissions();
                    setUploadMessage(
                      `Linked ${result.linked} turn-in(s) into Signature Submission for petitioners.`,
                    );
                  } catch (e) {
                    setError(
                      e instanceof Error
                        ? e.message
                        : "Could not expose turn-ins to submissions.",
                    );
                  } finally {
                    setSaving(false);
                  }
                })();
              }}
            >
              Show in submissions
            </Button>
            <Button variant="ghost" onClick={() => setUploadOpen(true)}>
              Upload report
            </Button>
            <Button variant="ghost" onClick={() => setMapOpen(true)}>
              Petition name map
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                resetLineForm();
                setLineOpen(true);
              }}
            >
              Add petition column
            </Button>
            <Button onClick={() => setOpen(true)}>New turn-in</Button>
          </div>
        }
      />
      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
      {uploadMessage ? (
        <p className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">{uploadMessage}</p>
      ) : null}
      {loading ? <p className="text-sm text-ink/55">Loading…</p> : null}
      <Card>
        <CardBody className="p-0">
          <DataTable>
            <thead>
              <tr>
                <Th>Turn-in #</Th>
                <Th>Name</Th>
                <Th>State</Th>
                <Th>Collection date</Th>
                <Th>Benchmark %</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8 bg-white/50">
              {rows.map((row) => (
                <tr key={row.id}>
                  <Td>{row.turnInNumber}</Td>
                  <Td>{row.name}</Td>
                  <Td>{row.state}</Td>
                  <Td>{row.turnInDate ? formatDate(row.turnInDate) : "—"}</Td>
                  <Td>{row.benchmarkPct}%</Td>
                  <Td>
                    <Link
                      href={`/turn-ins/${row.id}`}
                      className="text-sm font-medium text-civic-navy hover:underline"
                    >
                      Open grid
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </CardBody>
      </Card>

      <Modal open={mapOpen} onClose={() => setMapOpen(false)} title="Petition name mapping">
        <div className="space-y-4">
          <p className="text-sm text-ink/65">
            Map the short code used in turn-in grids to official state names, OnTarget names, and client report names. Petitions do not always share one number or wording across systems.
          </p>
          <DataTable>
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Internal</Th>
                <Th>Official #</Th>
                <Th>OnTarget</Th>
                <Th>Client report</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8 bg-white/50">
              {lines.map((line) => (
                <tr key={line.id}>
                  <Td>{line.code}</Td>
                  <Td>{line.name}</Td>
                  <Td>{line.officialNumber || "—"}</Td>
                  <Td>{line.ontargetName || "—"}</Td>
                  <Td>{line.clientReportName || "—"}</Td>
                  <Td>
                    <button
                      type="button"
                      className="text-sm font-medium text-civic-navy hover:underline"
                      onClick={() => editLine(line)}
                    >
                      Edit
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
      </Modal>

      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload turn-in report">
        <div className="space-y-4">
          <p className="text-sm text-ink/65">
            Legacy Excel sheets like CO-01 still parse. Set each sheet’s collection date to rename it to the date system (CO-07-04). Leave the date blank to keep the sheet number.
          </p>
          <div className="space-y-2">
            <Label htmlFor="turn-in-report">Excel workbook</Label>
            <Input
              id="turn-in-report"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => void onUploadFile(e.target.files?.[0] ?? null)}
            />
            {uploadFileName ? <p className="text-xs text-ink/55">{uploadFileName}</p> : null}
          </div>
          <div className="space-y-2">
            <Label>Benchmark % for new turn-ins</Label>
            <Input
              type="number"
              step="0.01"
              value={importBenchmark}
              onChange={(e) => setImportBenchmark(e.target.value)}
            />
          </div>
          {summary ? (
            <div className="space-y-3 rounded-xl border border-ink/10 bg-white/60 px-4 py-3 text-sm text-ink/75">
              <p>
                {summary.issueCount} sheet(s) · {summary.personCount} circulator(s) ·{" "}
                {summary.entryCount} non-zero cell(s)
              </p>
              <p className="text-xs text-ink/55">Columns: {summary.columnCodes.join(", ")}</p>
              <div className="max-h-56 space-y-3 overflow-y-auto">
                {parsedReport?.issues.map((issue) => {
                  const override = sheetOverrides[issue.sheetName];
                  return (
                    <div
                      key={issue.sheetName}
                      className="grid gap-2 rounded-lg border border-ink/10 p-3 sm:grid-cols-3"
                    >
                      <div>
                        <p className="text-xs uppercase tracking-[0.15em] text-ink/45">Sheet</p>
                        <p className="font-medium text-ink">{issue.sheetName}</p>
                      </div>
                      <div className="space-y-1">
                        <Label>Collection date</Label>
                        <Input
                          type="date"
                          value={override?.turnInDate ?? ""}
                          onChange={(e) => setSheetDate(issue.sheetName, e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Turn-in #</Label>
                        <Input
                          value={override?.turnInNumber ?? issue.turnInNumber}
                          onChange={(e) =>
                            setSheetOverrides((prev) => ({
                              ...prev,
                              [issue.sheetName]: {
                                turnInDate: prev[issue.sheetName]?.turnInDate ?? "",
                                turnInNumber: e.target.value.toUpperCase(),
                              },
                            }))
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          <Button
            className="w-full"
            disabled={!parsedReport || saving}
            onClick={() => void commitUpload()}
          >
            {saving ? "Importing…" : "Import report"}
          </Button>
        </div>
      </Modal>

      <Modal
        open={lineOpen}
        onClose={() => {
          setLineOpen(false);
          resetLineForm();
        }}
        title={editingLineId ? "Edit petition column" : "Petition column"}
      >
        <form className="space-y-4" onSubmit={(e) => void submitLine(e)}>
          <div className="space-y-2">
            <Label>Internal code</Label>
            <Input required value={lineCode} onChange={(e) => setLineCode(e.target.value)} placeholder="TAX $3" />
          </div>
          <div className="space-y-2">
            <Label>Internal name</Label>
            <Input required value={lineName} onChange={(e) => setLineName(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>BAP pay</Label>
              <Input required type="number" step="0.01" value={linePay} onChange={(e) => setLinePay(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Lotus pay</Label>
              <Input required type="number" step="0.01" value={lineLotus} onChange={(e) => setLineLotus(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Official state number</Label>
            <Input value={officialNumber} onChange={(e) => setOfficialNumber(e.target.value)} placeholder="#232" />
          </div>
          <div className="space-y-2">
            <Label>Official / legal name</Label>
            <Input value={officialName} onChange={(e) => setOfficialName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>OnTarget name</Label>
            <Input value={ontargetName} onChange={(e) => setOntargetName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Client report name</Label>
            <Input value={clientReportName} onChange={(e) => setClientReportName(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving…" : "Save petition column"}
          </Button>
        </form>
      </Modal>

      <Modal open={open} onClose={() => setOpen(false)} title="Create turn-in">
        <form className="space-y-4" onSubmit={(e) => void submit(e)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>State</Label>
              <Input required value={state} onChange={(e) => setState(e.target.value.toUpperCase())} placeholder="CO" maxLength={2} />
            </div>
            <div className="space-y-2">
              <Label>Collection date</Label>
              <Input required type="date" value={turnInDate} onChange={(e) => setTurnInDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Turn-in number</Label>
            <Input value={turnInNumber} readOnly />
            <p className="text-xs text-ink/50">Generated as STATE-MM-DD from the collection date (example CO-07-04).</p>
          </div>
          <div className="space-y-2">
            <Label>Display name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={turnInNumber || "Optional"} />
          </div>
          <div className="space-y-2">
            <Label>Benchmark %</Label>
            <Input required value={benchmarkPct} onChange={(e) => setBenchmarkPct(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Petition columns on this turn-in</Label>
            <div className="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">
              {lines.map((line) => (
                <label
                  key={line.id}
                  className="flex items-center justify-between rounded-xl border border-ink/10 px-3 py-2 text-sm"
                >
                  <span>
                    {line.code} · ${line.pay.toFixed(2)}
                  </span>
                  <input
                    type="checkbox"
                    checked={selectedLines.includes(line.id)}
                    onChange={() => toggleLine(line.id)}
                  />
                </label>
              ))}
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={saving || !selectedLines.length || !turnInNumber}>
            {saving ? "Creating…" : "Create turn-in"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
