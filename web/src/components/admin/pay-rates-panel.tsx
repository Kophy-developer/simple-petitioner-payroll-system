"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";
import {
  getBenchmark,
  listIssues,
  listPayRates,
  listPetitions,
  setBenchmark,
  updatePayRate,
} from "@/lib/api/live";
import type { Issue, PayRate, Petition } from "@/lib/types";

export function PayRatesPanel() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [petitions, setPetitions] = useState<Petition[]>([]);
  const [payRates, setPayRates] = useState<PayRate[]>([]);
  const [editIssue, setEditIssue] = useState<string | null>(null);
  const [editRate, setEditRate] = useState("1");
  const [benchmark, setBenchmarkValue] = useState("75");
  const [benchmarkWarn, setBenchmarkWarn] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [issueRows, petitionRows, rateRows, pct] = await Promise.all([
        listIssues(),
        listPetitions(),
        listPayRates(),
        getBenchmark(),
      ]);
      setIssues(issueRows);
      setPetitions(petitionRows);
      setPayRates(rateRows);
      setBenchmarkValue(String(pct));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load pay rates.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveBenchmark() {
    setSaving(true);
    setError("");
    try {
      await setBenchmark(parseFloat(benchmark));
      setSaved(true);
      setBenchmarkWarn(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save benchmark.");
    } finally {
      setSaving(false);
    }
  }

  async function saveRate(e: React.FormEvent) {
    e.preventDefault();
    if (!editIssue) return;
    setSaving(true);
    setError("");
    try {
      await updatePayRate(editIssue, parseFloat(editRate));
      setEditIssue(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save pay rate.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
      {loading ? <p className="text-sm text-ink/55">Loading…</p> : null}

      <Card>
        <CardHeader><h2 className="font-display text-xl text-ink">Pay rates</h2></CardHeader>
        <CardBody className="p-0">
          <DataTable>
            <thead>
              <tr>
                <Th>Petition</Th>
                <Th>Issue</Th>
                <Th>State</Th>
                <Th align="right">Pay rate</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8 bg-white/50">
              {issues.map((issue) => {
                const rate = payRates.find((p) => p.issueId === issue.id)?.rate ?? 0;
                const petition = petitions.find((p) => p.id === issue.petitionId);
                return (
                  <tr key={issue.id}>
                    <Td>{petition?.name}</Td>
                    <Td>{issue.issueNumber}</Td>
                    <Td>{issue.state}</Td>
                    <Td align="right">{formatCurrency(rate)}</Td>
                    <Td align="right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditIssue(issue.id);
                          setEditRate(String(rate));
                        }}
                      >
                        Edit
                      </Button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        </CardBody>
      </Card>

      <Card className="max-w-lg">
        <CardHeader><h2 className="font-display text-xl text-ink">Benchmark %</h2></CardHeader>
        <CardBody className="space-y-4">
          <div className="space-y-2">
            <Label>System-wide payable threshold</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={benchmark}
              onChange={(e) => {
                setBenchmarkValue(e.target.value);
                setBenchmarkWarn(true);
                setSaved(false);
              }}
            />
          </div>
          {benchmarkWarn ? (
            <p className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning">
              Changing this affects all future payable calculations. Existing locked payroll records are unaffected.
            </p>
          ) : null}
          <Button onClick={() => void saveBenchmark()} disabled={saving}>
            {saving ? "Saving…" : "Save benchmark"}
          </Button>
          {saved ? <p className="text-sm text-success">Benchmark saved — ledgers recalculated.</p> : null}
        </CardBody>
      </Card>

      <Modal open={!!editIssue} onClose={() => setEditIssue(null)} title="Edit pay rate">
        <form className="space-y-4" onSubmit={(e) => void saveRate(e)}>
          <div className="space-y-2">
            <Label>Pay rate</Label>
            <Input
              type="number"
              step="0.01"
              value={editRate}
              onChange={(e) => setEditRate(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
