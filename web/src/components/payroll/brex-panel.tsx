"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { listProfiles } from "@/lib/api/live";
import {
  disputeBrexTransaction,
  listBrexTransactions,
  markBrexForReimbursement,
  resolveBrexDispute,
  reviewBrexReimbursement,
} from "@/lib/api/remodel";
import { useDemoSession } from "@/lib/demo-session";
import { canRunPayroll, isFieldRole } from "@/lib/access";
import { formatCurrency, formatDate } from "@/lib/format";
import type { BrexMatchMethod, BrexTransaction, DemoUser } from "@/lib/types";

function matchMethodLabel(method: BrexMatchMethod | null) {
  if (method === "email") return "Email";
  if (method === "card_owner_email") return "Card owner";
  if (method === "brex_user_id") return "Brex ID";
  if (method === "name_exact") return "Name (exact)";
  if (method === "name_similar") return "Name (~80%+)";
  return "Unmatched";
}

function statusTone(status: BrexTransaction["reimbursementStatus"]) {
  if (status === "approved") return "success";
  if (status === "pending") return "warning";
  if (status === "rejected" || status === "disputed") return "danger";
  return "default";
}

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
  const selfId = user?.authId ?? user?.id;

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
          : txns.filter((t) => t.matchedUserId === selfId),
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
        matched_by_email?: number;
        matched_by_card?: number;
        matched_by_brex_id?: number;
        matched_by_name_exact?: number;
        matched_by_name_similar?: number;
        skipped_unsuccessful?: number;
        unmatched?: number;
        failed?: number;
      };
      if (!res.ok) throw new Error(payload.error || "Sync failed");
      setMessage(
        `Synced ${payload.upserted ?? 0} of ${payload.fetched ?? 0} expense(s). ` +
          `Matched email ${payload.matched_by_email ?? 0}, card ${payload.matched_by_card ?? 0}, ` +
          `Brex ID ${payload.matched_by_brex_id ?? 0}, name exact ${payload.matched_by_name_exact ?? 0}, ` +
          `name similar ${payload.matched_by_name_similar ?? 0}; ` +
          `skipped unsuccessful ${payload.skipped_unsuccessful ?? 0}; unmatched ${payload.unmatched ?? 0}` +
          (payload.failed ? `; failed ${payload.failed}` : "") +
          ".",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const names = Object.fromEntries(people.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));
  const disputedRows = rows.filter(
    (row) => row.reimbursementStatus === "disputed" || !!row.disputedAt,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink/65">
          Sync stores all Brex expenses. Only successful spend is matched by email, card-owner email,
          Brex user ID, or a single high-confidence name match (≥80%). Matched people can dispute.
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

      {isAdmin && disputedRows.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-ink">Disputed queue ({disputedRows.length})</h3>
          <Card>
            <CardBody className="p-0">
              <DataTable>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Matched user</Th>
                    <Th>Match</Th>
                    <Th>Merchant</Th>
                    <Th align="right">Amount</Th>
                    <Th>Note</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/8 bg-white/50">
                  {disputedRows.map((row) => (
                    <tr key={`dispute-${row.id}`}>
                      <Td>{row.occurredAt ? formatDate(row.occurredAt.slice(0, 10)) : "—"}</Td>
                      <Td>
                        {row.matchedUserId
                          ? names[row.matchedUserId] ?? row.cardholderName ?? "—"
                          : row.cardholderName || "—"}
                      </Td>
                      <Td>
                        {matchMethodLabel(row.matchMethod)}
                        {row.matchConfidence != null
                          ? ` (${Math.round(row.matchConfidence * 100)}%)`
                          : ""}
                      </Td>
                      <Td>{row.merchantName || row.description || "—"}</Td>
                      <Td align="right">{formatCurrency(row.amount)}</Td>
                      <Td>{row.disputeNote || "—"}</Td>
                      <Td>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              void resolveBrexDispute(row.id, true)
                                .then(load)
                                .catch((e) =>
                                  setError(
                                    e instanceof Error ? e.message : "Could not confirm match",
                                  ),
                                )
                            }
                          >
                            Confirm match
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              void resolveBrexDispute(row.id, false)
                                .then(load)
                                .catch((e) =>
                                  setError(e instanceof Error ? e.message : "Could not unmatch"),
                                )
                            }
                          >
                            Unmatch
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </CardBody>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardBody className="p-0">
          <DataTable>
            <thead>
              <tr>
                <Th>Date</Th>
                {isAdmin ? <Th>Matched user</Th> : null}
                {isAdmin ? <Th>Match</Th> : null}
                {isAdmin ? <Th>Brex email</Th> : null}
                <Th>Merchant</Th>
                <Th>Memo</Th>
                <Th>Expense</Th>
                <Th>Payment</Th>
                <Th align="right">Amount</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8 bg-white/50">
              {rows.map((row) => {
                const canDispute =
                  !!selfId &&
                  row.matchedUserId === selfId &&
                  row.reimbursementStatus !== "approved" &&
                  row.reimbursementStatus !== "disputed" &&
                  !row.disputedAt;

                return (
                  <tr key={row.id}>
                    <Td>{row.occurredAt ? formatDate(row.occurredAt.slice(0, 10)) : "—"}</Td>
                    {isAdmin ? (
                      <Td>
                        {row.matchedUserId
                          ? names[row.matchedUserId] ?? row.cardholderName ?? "—"
                          : row.cardholderName || "Unmatched"}
                      </Td>
                    ) : null}
                    {isAdmin ? (
                      <Td>
                        {matchMethodLabel(row.matchMethod)}
                        {row.matchConfidence != null &&
                        (row.matchMethod === "name_exact" || row.matchMethod === "name_similar")
                          ? ` (${Math.round(row.matchConfidence * 100)}%)`
                          : ""}
                      </Td>
                    ) : null}
                    {isAdmin ? <Td>{row.brexUserEmail || "—"}</Td> : null}
                    <Td>{row.merchantName || row.description || "—"}</Td>
                    <Td>{row.memo || "—"}</Td>
                    <Td>{row.expenseStatus || "—"}</Td>
                    <Td>{row.paymentStatus || "—"}</Td>
                    <Td align="right">{formatCurrency(row.amount)}</Td>
                    <Td>
                      <Badge tone={statusTone(row.reimbursementStatus)}>
                        {row.reimbursementStatus}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-2">
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
                        {canDispute ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const note = window.prompt(
                                "Optional note for admin (why this is not your expense):",
                              );
                              if (note === null) return;
                              void disputeBrexTransaction(row.id, note)
                                .then(load)
                                .catch((e) =>
                                  setError(e instanceof Error ? e.message : "Could not dispute"),
                                );
                            }}
                          >
                            Dispute
                          </Button>
                        ) : null}
                        {isAdmin && row.reimbursementStatus === "pending" ? (
                          <>
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
                          </>
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                );
              })}
              {rows.length === 0 && !loading ? (
                <tr>
                  <Td colSpan={isAdmin ? 11 : 8}>
                    <p className="py-6 text-center text-sm text-ink/50">
                      No Brex expenses yet. Set BREX_API_TOKEN and sync.
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
