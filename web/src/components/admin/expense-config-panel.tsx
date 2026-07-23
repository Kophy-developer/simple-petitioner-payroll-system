"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import {
  getExpenseConfig,
  listIssues,
  saveCarRentalIssueRate,
  saveCarRentalStandard,
  saveHousingIssueRate,
  saveHousingStandard,
} from "@/lib/api/live";
import type { ExpenseConfig, Issue } from "@/lib/types";

export function ExpenseConfigPanel() {
  const [config, setConfig] = useState<ExpenseConfig | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [housingRate, setHousingRate] = useState("95");
  const [carStandard, setCarStandard] = useState("0");
  const [carRates, setCarRates] = useState<Record<string, string>>({});
  const [housingRates, setHousingRates] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [cfg, issueRows] = await Promise.all([getExpenseConfig(), listIssues()]);
      setConfig(cfg);
      setIssues(issueRows);
      setHousingRate(String(cfg.housing.rate));
      setCarStandard(String(cfg.carRental.rate));
      setCarRates(
        Object.fromEntries(cfg.carRental.issueRates.map((r) => [r.issueId, String(r.rate)])),
      );
      setHousingRates(
        Object.fromEntries(cfg.housing.issueRates.map((r) => [r.issueId, String(r.rate)])),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load config.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveHousing() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await saveHousingStandard(parseFloat(housingRate));
      setMessage("Housing standard rate saved.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save housing.");
    } finally {
      setSaving(false);
    }
  }

  async function saveCarStd() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await saveCarRentalStandard(parseFloat(carStandard));
      setMessage("Car rental standard rate saved.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save car rental.");
    } finally {
      setSaving(false);
    }
  }

  async function saveCar(issueId: string) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await saveCarRentalIssueRate(issueId, parseFloat(carRates[issueId] ?? "0"));
      setMessage("Car rental issue rate saved.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save car rental.");
    } finally {
      setSaving(false);
    }
  }

  async function saveHousingIssue(issueId: string) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await saveHousingIssueRate(issueId, parseFloat(housingRates[issueId] ?? "0"));
      setMessage("Housing issue rate saved.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save housing.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
      {message ? <p className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">{message}</p> : null}
      {loading || !config ? (
        <p className="text-sm text-ink/55">Loading…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><h2 className="font-display text-xl text-ink">Car rental</h2></CardHeader>
            <CardBody className="space-y-4">
              <div className="space-y-2">
                <Label>Standard rate</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={carStandard}
                    onChange={(e) => setCarStandard(e.target.value)}
                  />
                  <Button size="sm" disabled={saving} onClick={() => void saveCarStd()}>
                    Save
                  </Button>
                </div>
                <p className="text-xs text-ink/50">Current: {formatCurrency(config.carRental.rate)}</p>
              </div>
              <div className="border-t border-ink/10 pt-4">
                <p className="mb-3 text-sm font-medium text-ink">Per-issue overrides</p>
                {issues.map((issue) => (
                  <div key={issue.id} className="mb-3 space-y-2">
                    <Label>{issue.issueNumber}</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={carRates[issue.id] ?? ""}
                        onChange={(e) =>
                          setCarRates((prev) => ({ ...prev, [issue.id]: e.target.value }))
                        }
                      />
                      <Button size="sm" disabled={saving} onClick={() => void saveCar(issue.id)}>
                        Save
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader><h2 className="font-display text-xl text-ink">Housing allowance</h2></CardHeader>
            <CardBody className="space-y-4">
              <p className="text-xs text-ink/55">Suggested rate for flat housing expenses.</p>
              <div className="space-y-2">
                <Label>Standard rate</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={housingRate}
                    onChange={(e) => setHousingRate(e.target.value)}
                  />
                  <Button size="sm" disabled={saving} onClick={() => void saveHousing()}>
                    Save
                  </Button>
                </div>
                <p className="text-xs text-ink/50">Current: {formatCurrency(config.housing.rate)}</p>
              </div>
              <div className="border-t border-ink/10 pt-4">
                <p className="mb-3 text-sm font-medium text-ink">Per-issue overrides</p>
                {issues.map((issue) => (
                  <div key={issue.id} className="mb-3 space-y-2">
                    <Label>{issue.issueNumber}</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={housingRates[issue.id] ?? ""}
                        onChange={(e) =>
                          setHousingRates((prev) => ({ ...prev, [issue.id]: e.target.value }))
                        }
                      />
                      <Button
                        size="sm"
                        disabled={saving}
                        onClick={() => void saveHousingIssue(issue.id)}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
