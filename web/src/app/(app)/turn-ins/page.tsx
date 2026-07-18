"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import {
  createTurnIn,
  listPricedPetitionLines,
  listTurnIns,
  savePricedPetitionLine,
} from "@/lib/api/remodel";
import type { PricedPetitionLine, TurnIn } from "@/lib/types";
import { formatDate } from "@/lib/format";

export default function TurnInsPage() {
  const [rows, setRows] = useState<TurnIn[]>([]);
  const [lines, setLines] = useState<PricedPetitionLine[]>([]);
  const [open, setOpen] = useState(false);
  const [lineOpen, setLineOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [turnInNumber, setTurnInNumber] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState("CO");
  const [turnInDate, setTurnInDate] = useState("");
  const [benchmarkPct, setBenchmarkPct] = useState("75");
  const [selectedLines, setSelectedLines] = useState<string[]>([]);
  const [lineCode, setLineCode] = useState("");
  const [lineName, setLineName] = useState("");
  const [linePay, setLinePay] = useState("");
  const [lineLotus, setLineLotus] = useState("");

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await createTurnIn({
        turnInNumber,
        name,
        state,
        turnInDate: turnInDate || null,
        benchmarkPct: parseFloat(benchmarkPct) || 75,
        pricedLineIds: selectedLines,
      });
      setOpen(false);
      setTurnInNumber("");
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
        name: lineName,
        code: lineCode,
        pay: parseFloat(linePay) || 0,
        lotusPay: parseFloat(lineLotus) || 0,
      });
      setLineOpen(false);
      setLineCode("");
      setLineName("");
      setLinePay("");
      setLineLotus("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save priced line.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Collection"
        title="Turn-ins"
        description="Each turn-in can include multiple priced petition columns (for example TAX $2 and TAX $3)."
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setLineOpen(true)}>
              Add priced line
            </Button>
            <Button onClick={() => setOpen(true)}>New turn-in</Button>
          </div>
        }
      />
      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
      {loading ? <p className="text-sm text-ink/55">Loading…</p> : null}
      <Card>
        <CardBody className="p-0">
          <DataTable>
            <thead>
              <tr>
                <Th>Turn-in #</Th>
                <Th>Name</Th>
                <Th>State</Th>
                <Th>Date</Th>
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

      <Modal open={lineOpen} onClose={() => setLineOpen(false)} title="Priced petition line">
        <form className="space-y-4" onSubmit={(e) => void submitLine(e)}>
          <div className="space-y-2">
            <Label>Code</Label>
            <Input required value={lineCode} onChange={(e) => setLineCode(e.target.value)} placeholder="TAX $3" />
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
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
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving…" : "Save priced line"}
          </Button>
        </form>
      </Modal>

      <Modal open={open} onClose={() => setOpen(false)} title="Create turn-in">
        <form className="space-y-4" onSubmit={(e) => void submit(e)}>
          <div className="space-y-2">
            <Label>Turn-in number</Label>
            <Input required value={turnInNumber} onChange={(e) => setTurnInNumber(e.target.value)} placeholder="BAP-CO-09" />
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>State</Label>
              <Input required value={state} onChange={(e) => setState(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={turnInDate} onChange={(e) => setTurnInDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Benchmark %</Label>
              <Input required value={benchmarkPct} onChange={(e) => setBenchmarkPct(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Priced petition columns</Label>
            <div className="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">
              {lines.map((line) => (
                <label
                  key={line.id}
                  className="flex items-center justify-between rounded-xl border border-ink/10 px-3 py-2 text-sm"
                >
                  <span>
                    {line.code} · ${line.pay.toFixed(2)} / Lotus ${line.lotusPay.toFixed(2)}
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
          <Button type="submit" className="w-full" disabled={saving || !selectedLines.length}>
            {saving ? "Creating…" : "Create turn-in"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
