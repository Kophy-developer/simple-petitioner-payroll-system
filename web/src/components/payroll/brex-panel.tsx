"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { listProfiles } from "@/lib/api/live";
import {
  listBrexTransactions,
  markBrexForReimbursement,
  reviewBrexReimbursement,
} from "@/lib/api/remodel";
import { useDemoSession } from "@/lib/demo-session";
import { canRunPayroll, isFieldRole } from "@/lib/access";
import { formatCurrency, formatDate } from "@/lib/format";
import type { BrexTransaction, DemoUser } from "@/lib/types";

export function BrexPanel() {
  const { user } = useDemoSession();
  const [rows, setRows] = useState<BrexTransaction[]>([]);
  const [people, setPeople] = useState<DemoUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const isAdmin = user ? canRunPayroll(user.role) : false;
  const isField = user ? isFieldRole(user.role) : false;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [txns, profiles] = await Promise.all([
        listBrexTransactions(),
        isAdmin ? listProfiles() : Promise.resolve([]),
      ]);
      setRows(
        isAdmin
          ? txns
          : txns.filter((t) => t.matchedUserId === (user?.authId ?? user?.id)),
      );
      setPeople(profiles);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load Brex transactions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [user?.authId, isAdmin]);

  async function sync() {
    setSyncing(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/brex/sync", { method: "POST" });
      const payload = (await res.json()) as {
        error?: string;
        fetched?: number;
        upserted?: number;
      };
      if (!res.ok) throw new Error(payload.error || "Sync failed");
      setMessage(`Synced ${payload.upserted ?? 0} of ${payload.fetched ?? 0} transaction(s).`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const names = Object.fromEntries(people.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink/65">
          Sync approved Brex card transactions, match by cardholder name, then reimburse to live
          balance.
        </p>
        {isAdmin ? (
          <Button onClick={() => void sync()} disabled={syncing}>
            {syncing ? "Syncing…" : "Sync Brex"}
          </Button>
        ) : null}
      </div>
      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
      {message ? (
        <p className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">{message}</p>
      ) : null}
      {loading ? <p className="text-sm text-ink/55">Loading…</p> : null}
      <Card>
        <CardBody className="p-0">
          <DataTable>
            <thead>
              <tr>
                <Th>Date</Th>
                {isAdmin ? <Th>Matched user</Th> : null}
                <Th>Merchant</Th>
                <Th align="right">Amount</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8 bg-white/50">
              {rows.map((row) => (
                <tr key={row.id}>
                  <Td>{row.occurredAt ? formatDate(row.occurredAt.slice(0, 10)) : "—"}</Td>
                  {isAdmin ? (
                    <Td>
                      {row.matchedUserId
                        ? names[row.matchedUserId] ?? row.cardholderName ?? "—"
                        : row.cardholderName || "Unmatched"}
                    </Td>
                  ) : null}
                  <Td>{row.merchantName || row.description || "—"}</Td>
                  <Td align="right">{formatCurrency(row.amount)}</Td>
                  <Td>
                    <Badge
                      tone={
                        row.reimbursementStatus === "approved"
                          ? "success"
                          : row.reimbursementStatus === "pending"
                            ? "warning"
                            : row.reimbursementStatus === "rejected"
                              ? "danger"
                              : "default"
                      }
                    >
                      {row.reimbursementStatus}
                    </Badge>
                  </Td>
                  <Td>
                    {isField && row.reimbursementStatus === "none" ? (
                      <Button
                        size="sm"
                        onClick={() =>
                          void markBrexForReimbursement(row.id)
                            .then(load)
                            .catch((e) =>
                              setError(e instanceof Error ? e.message : "Could not mark"),
                            )
                        }
                      >
                        Mark for reimbursement
                      </Button>
                    ) : null}
                    {isAdmin && row.reimbursementStatus === "pending" ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            void reviewBrexReimbursement(row.id, true)
                              .then(load)
                              .catch((e) =>
                                setError(e instanceof Error ? e.message : "Approve failed"),
                              )
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            void reviewBrexReimbursement(row.id, false)
                              .then(load)
                              .catch((e) =>
                                setError(e instanceof Error ? e.message : "Reject failed"),
                              )
                          }
                        >
                          Reject
                        </Button>
                      </div>
                    ) : null}
                  </Td>
                </tr>
              ))}
              {rows.length === 0 && !loading ? (
                <tr>
                  <Td colSpan={isAdmin ? 6 : 5}>
                    <p className="py-6 text-center text-sm text-ink/50">
                      No Brex transactions yet. Set BREX_API_TOKEN and sync.
                    </p>
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </DataTable>
        </CardBody>
      </Card>
    </div>
  );
}
