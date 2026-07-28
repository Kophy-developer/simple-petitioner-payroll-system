"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { canEditFinancialConfig } from "@/lib/access";
import { listProfiles } from "@/lib/api/live";
import {
  listTurnInColumns,
  listTurnInEntries,
  listTurnIns,
  upsertTurnInEntry,
  upsertTurnInValidity,
} from "@/lib/api/remodel";
import { useDemoSession } from "@/lib/demo-session";
import type { DemoUser, TurnIn, TurnInColumn, TurnInEntry } from "@/lib/types";

export default function TurnInDetailPage() {
  const { user: viewer } = useDemoSession();
  const isAdmin = viewer ? canEditFinancialConfig(viewer.role) : false;
  const params = useParams<{ id: string }>();
  const turnInId = params.id;
  const [turnIn, setTurnIn] = useState<TurnIn | null>(null);
  const [columns, setColumns] = useState<TurnInColumn[]>([]);
  const [entries, setEntries] = useState<TurnInEntry[]>([]);
  const [people, setPeople] = useState<DemoUser[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<Record<string, { sigs: string; books: string }>>({});
  const [validityDraft, setValidityDraft] = useState<
    Record<string, { dups: string; usable: string; valid: string }>
  >({});

  const load = useCallback(async () => {
    setError("");
    try {
      const [allTurnIns, cols, ents, profiles] = await Promise.all([
        listTurnIns(),
        listTurnInColumns(turnInId),
        listTurnInEntries(turnInId),
        listProfiles(),
      ]);
      setTurnIn(allTurnIns.find((t) => t.id === turnInId) ?? null);
      setColumns(cols);
      setEntries(ents);
      setPeople(
        profiles.filter((p) =>
          ["petitioner", "team_lead"].includes(p.role),
        ),
      );
      const next: Record<string, { sigs: string; books: string }> = {};
      for (const person of profiles) {
        for (const col of cols) {
          const key = `${person.id}:${col.id}`;
          const found = ents.find((e) => e.userId === person.id && e.columnId === col.id);
          next[key] = {
            sigs: String(found?.sigs ?? 0),
            books: String(found?.books ?? 0),
          };
        }
      }
      setDraft(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load turn-in.");
    }
  }, [turnInId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveCell(userId: string, columnId: string) {
    const key = `${userId}:${columnId}`;
    const cell = draft[key];
    if (!cell) return;
    setMessage("");
    setError("");
    try {
      await upsertTurnInEntry({
        columnId,
        userId,
        sigs: parseInt(cell.sigs || "0", 10) || 0,
        books: parseInt(cell.books || "0", 10) || 0,
      });
      setMessage("Saved.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save entry.");
    }
  }

  async function saveValidity(userId: string, columnId: string) {
    const key = `${userId}:${columnId}`;
    const cell = validityDraft[key];
    if (!cell) return;
    setMessage("");
    setError("");
    try {
      await upsertTurnInValidity({
        columnId,
        userId,
        dups: parseInt(cell.dups || "0", 10) || 0,
        usable: parseInt(cell.usable || "0", 10) || 0,
        valid: parseInt(cell.valid || "0", 10) || 0,
      });
      setMessage("Validity saved and ledger recalculated.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save validity.");
    }
  }

  if (!turnIn) {
    return <p className="p-8 text-sm text-ink/55">Loading turn-in…</p>;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Turn-in"
        title={turnIn.turnInNumber}
        description={
          isAdmin
            ? `Benchmark ${turnIn.benchmarkPct}% · Enter sigs and books.`
            : "Enter sigs and books."
        }
      />
      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
      {message ? <p className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">{message}</p> : null}

      <Card>
        <CardBody className="overflow-x-auto p-0">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10 bg-ink/[0.03] text-left">
                <th className="px-4 py-3 font-medium">Circulator</th>
                {columns.map((col) => (
                  <th key={col.id} className="px-4 py-3 font-medium" colSpan={2}>
                    {col.code}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-ink/10 text-left text-xs text-ink/50">
                <th className="px-4 py-2" />
                {columns.map((col) => (
                  <th key={col.id} className="px-4 py-2" colSpan={2}>
                    Sigs / Books
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr key={person.id} className="border-b border-ink/8">
                  <td className="px-4 py-3 font-medium">
                    {person.firstName} {person.lastName}
                  </td>
                  {columns.map((col) => {
                    const key = `${person.id}:${col.id}`;
                    const cell = draft[key] ?? { sigs: "0", books: "0" };
                    return (
                      <td key={col.id} colSpan={2} className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <Input
                            className="w-20"
                            value={cell.sigs}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                [key]: { ...cell, sigs: e.target.value },
                              }))
                            }
                          />
                          <Input
                            className="w-20"
                            value={cell.books}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                [key]: { ...cell, books: e.target.value },
                              }))
                            }
                          />
                          <Button size="sm" variant="ghost" onClick={() => void saveCell(person.id, col.id)}>
                            Save
                          </Button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <h2 className="font-display text-xl text-ink">Manual validity (per column)</h2>
          {isAdmin ? (
            <p className="text-sm text-ink/55">
              Uses Excel rule: pay rate = MIN(validity% / benchmark, 1), payable = ROUNDDOWN(pay rate × usable).
            </p>
          ) : null}
          <div className="grid gap-3">
            {people.slice(0, 12).map((person) =>
              columns.slice(0, 1).map((col) => {
                const key = `${person.id}:${col.id}`;
                const cell = validityDraft[key] ?? { dups: "0", usable: "0", valid: "0" };
                return (
                  <div key={key} className="flex flex-wrap items-end gap-2 rounded-xl border border-ink/10 p-3">
                    <div className="min-w-40 text-sm font-medium">
                      {person.firstName} {person.lastName} · {col.code}
                    </div>
                    <Input
                      className="w-24"
                      placeholder="Dups"
                      value={cell.dups}
                      onChange={(e) =>
                        setValidityDraft((prev) => ({
                          ...prev,
                          [key]: { ...cell, dups: e.target.value },
                        }))
                      }
                    />
                    <Input
                      className="w-24"
                      placeholder="Usable"
                      value={cell.usable}
                      onChange={(e) =>
                        setValidityDraft((prev) => ({
                          ...prev,
                          [key]: { ...cell, usable: e.target.value },
                        }))
                      }
                    />
                    <Input
                      className="w-24"
                      placeholder="Valid"
                      value={cell.valid}
                      onChange={(e) =>
                        setValidityDraft((prev) => ({
                          ...prev,
                          [key]: { ...cell, valid: e.target.value },
                        }))
                      }
                    />
                    <Button size="sm" onClick={() => void saveValidity(person.id, col.id)}>
                      Apply
                    </Button>
                  </div>
                );
              }),
            )}
          </div>
        </CardBody>
      </Card>
      <p className="text-xs text-ink/45">{entries.length} saved entry row(s).</p>
    </div>
  );
}
