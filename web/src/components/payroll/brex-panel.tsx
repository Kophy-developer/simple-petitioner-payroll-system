"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
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
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import type { BrexTransaction, DemoUser } from "@/lib/types";

function statusTone(status: BrexTransaction["reimbursementStatus"]) {
  if (status === "approved") return "success";
  if (status === "pending") return "warning";
  if (status === "rejected" || status === "disputed") return "danger";
  return "default";
}

function personName(
  id: string | null | undefined,
  names: Record<string, string>,
  fallback?: string | null,
) {
  if (!id) return fallback || "—";
  return names[id] ?? fallback ?? "—";
}

export function BrexPanel() {
  const { user } = useDemoSession();
  const [rows, setRows] = useState<BrexTransaction[]>([]);
  const [people, setPeople] = useState<DemoUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmRow, setConfirmRow] = useState<BrexTransaction | null>(null);
  const [confirming, setConfirming] = useState(false);

  const isAdmin = user ? canRunPayroll(user.role) : false;
  const isField = user ? isFieldRole(user.role) : false;
  const selfId = user?.authId ?? user?.id;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [txns, profiles] = await Promise.all([
        listBrexTransactions(),
        listProfiles(),
      ]);
      setPeople(profiles);
      setRows(
        isAdmin
          ? txns
          : txns.filter((t) => t.matchedUserId === selfId),
      );
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
      setMessage(`Synced ${payload.upserted ?? 0} of ${payload.fetched ?? 0} expense(s).`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function approveConfirmed() {
    if (!confirmRow) return;
    setConfirming(true);
    setError("");
    try {
      await reviewBrexReimbursement(confirmRow.id, true);
      setConfirmRow(null);
      setMessage("Reimbursement approved and credited to the ledger.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setConfirming(false);
    }
  }

  const names = Object.fromEntries(people.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));
  const pendingRows = rows.filter((row) => row.reimbursementStatus === "pending");
  const disputedRows = rows.filter(
    (row) => row.reimbursementStatus === "disputed" || !!row.disputedAt,
  );
  const auditRows = rows.filter(
    (row) => row.reimbursementStatus === "approved" || row.reimbursementStatus === "rejected",
  );
  const latestSynced = rows.slice(0, 10);

  return (
    <div className="space-y-6">
      {isAdmin ? (
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button onClick={() => void sync()} disabled={syncing}>
            {syncing ? "Syncing…" : "Sync Brex"}
          </Button>
        </div>
      ) : null}
      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
      {message ? (
        <p className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">{message}</p>
      ) : null}
      {loading ? <p className="text-sm text-ink/55">Loading…</p> : null}

      {isField ? (
        <Card>
          <CardHeader>
            <h3 className="font-display text-xl text-ink">My card expenses</h3>
          </CardHeader>
          <CardBody className="p-0">
            <DataTable>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Merchant</Th>
                  <Th>Memo</Th>
                  <Th align="right">Amount</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/8 bg-white/50">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <Td>{row.occurredAt ? formatDate(row.occurredAt.slice(0, 10)) : "—"}</Td>
                    <Td>{row.merchantName || row.description || "—"}</Td>
                    <Td>{row.memo || "—"}</Td>
                    <Td align="right">{formatCurrency(row.amount)}</Td>
                    <Td>
                      <Badge tone={statusTone(row.reimbursementStatus)}>
                        {row.reimbursementStatus}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-2">
                        {row.reimbursementStatus === "none" && !row.disputedAt ? (
                          <Button
                            size="sm"
                            onClick={() =>
                              void markBrexForReimbursement(row.id)
                                .then(() => {
                                  setMessage("Reimbursement request sent to admins.");
                                  return load();
                                })
                                .catch((e) =>
                                  setError(
                                    e instanceof Error ? e.message : "Could not request reimbursement",
                                  ),
                                )
                            }
                          >
                            Request reimbursement
                          </Button>
                        ) : null}
                        {row.reimbursementStatus !== "approved" &&
                        row.reimbursementStatus !== "disputed" &&
                        !row.disputedAt ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const note = window.prompt(
                                "Optional note (why this is not your expense):",
                              );
                              if (note === null) return;
                              void disputeBrexTransaction(row.id, note)
                                .then(load)
                                .catch((e) =>
                                  setError(e instanceof Error ? e.message : "Could not dispute"),
                                );
                            }}
                          >
                            Not my expense
                          </Button>
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                ))}
                {rows.length === 0 && !loading ? (
                  <tr>
                    <Td colSpan={6}>
                      <p className="py-6 text-center text-sm text-ink/50">
                        No matched Brex expenses for you yet.
                      </p>
                    </Td>
                  </tr>
                ) : null}
              </tbody>
            </DataTable>
          </CardBody>
        </Card>
      ) : null}

      {isAdmin ? (
        <Card>
          <CardHeader>
            <h3 className="font-display text-xl text-ink">
              Pending reimbursement requests ({pendingRows.length})
            </h3>
          </CardHeader>
          <CardBody className="p-0">
            <DataTable>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Person</Th>
                  <Th>Requested by</Th>
                  <Th>Merchant</Th>
                  <Th>Memo</Th>
                  <Th>Expense</Th>
                  <Th>Payment</Th>
                  <Th>Brex email</Th>
                  <Th align="right">Amount</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/8 bg-white/50">
                {pendingRows.map((row) => (
                  <tr key={`pending-${row.id}`}>
                    <Td>{row.occurredAt ? formatDate(row.occurredAt.slice(0, 10)) : "—"}</Td>
                    <Td>
                      {personName(row.matchedUserId, names, row.cardholderName)}
                    </Td>
                    <Td>
                      <div className="text-sm">
                        <div>{personName(row.reimbursementRequestedBy, names)}</div>
                        <div className="text-ink/45">
                          {row.reimbursementRequestedAt
                            ? formatDateTime(row.reimbursementRequestedAt)
                            : "—"}
                        </div>
                      </div>
                    </Td>
                    <Td>{row.merchantName || row.description || "—"}</Td>
                    <Td>{row.memo || "—"}</Td>
                    <Td>{row.expenseStatus || "—"}</Td>
                    <Td>{row.paymentStatus || "—"}</Td>
                    <Td>{row.brexUserEmail || "—"}</Td>
                    <Td align="right">{formatCurrency(row.amount)}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => setConfirmRow(row)}>
                          Approve reimbursement
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
                    </Td>
                  </tr>
                ))}
                {pendingRows.length === 0 && !loading ? (
                  <tr>
                    <Td colSpan={10}>
                      <p className="py-6 text-center text-sm text-ink/50">
                        No pending reimbursement requests.
                      </p>
                    </Td>
                  </tr>
                ) : null}
              </tbody>
            </DataTable>
          </CardBody>
        </Card>
      ) : null}

      {isAdmin && disputedRows.length > 0 ? (
        <Card>
          <CardHeader>
            <h3 className="font-display text-xl text-ink">
              Match disputes ({disputedRows.length})
            </h3>
          </CardHeader>
          <CardBody className="p-0">
            <DataTable>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Matched user</Th>
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
                    <Td>{personName(row.matchedUserId, names, row.cardholderName)}</Td>
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
      ) : null}

      {isAdmin ? (
        <Card>
          <CardHeader>
            <h3 className="font-display text-xl text-ink">Approval audit trail</h3>
          </CardHeader>
          <CardBody className="p-0">
            <DataTable>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Person</Th>
                  <Th>Merchant</Th>
                  <Th align="right">Amount</Th>
                  <Th>Result</Th>
                  <Th>Requested by</Th>
                  <Th>Decided by</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/8 bg-white/50">
                {auditRows.map((row) => (
                  <tr key={`audit-${row.id}`}>
                    <Td>{row.occurredAt ? formatDate(row.occurredAt.slice(0, 10)) : "—"}</Td>
                    <Td>{personName(row.matchedUserId, names, row.cardholderName)}</Td>
                    <Td>{row.merchantName || row.description || "—"}</Td>
                    <Td align="right">{formatCurrency(row.amount)}</Td>
                    <Td>
                      <Badge tone={statusTone(row.reimbursementStatus)}>
                        {row.reimbursementStatus}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="text-sm">
                        <div>{personName(row.reimbursementRequestedBy, names)}</div>
                        <div className="text-ink/45">
                          {row.reimbursementRequestedAt
                            ? formatDateTime(row.reimbursementRequestedAt)
                            : "—"}
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <div className="text-sm">
                        <div>{personName(row.reviewedBy, names)}</div>
                        <div className="text-ink/45">
                          {row.reviewedAt ? formatDateTime(row.reviewedAt) : "—"}
                        </div>
                      </div>
                    </Td>
                  </tr>
                ))}
                {auditRows.length === 0 && !loading ? (
                  <tr>
                    <Td colSpan={7}>
                      <p className="py-6 text-center text-sm text-ink/50">
                        No approved or rejected reimbursements yet.
                      </p>
                    </Td>
                  </tr>
                ) : null}
              </tbody>
            </DataTable>
          </CardBody>
        </Card>
      ) : null}

      {isAdmin ? (
        <Card>
          <CardHeader>
            <h3 className="font-display text-xl text-ink">Latest synced (10)</h3>
          </CardHeader>
          <CardBody className="p-0">
            <DataTable>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Matched user</Th>
                  <Th>Merchant</Th>
                  <Th align="right">Amount</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/8 bg-white/50">
                {latestSynced.map((row) => (
                  <tr key={row.id}>
                    <Td>{row.occurredAt ? formatDate(row.occurredAt.slice(0, 10)) : "—"}</Td>
                    <Td>{personName(row.matchedUserId, names, row.cardholderName || "Unmatched")}</Td>
                    <Td>{row.merchantName || row.description || "—"}</Td>
                    <Td align="right">{formatCurrency(row.amount)}</Td>
                    <Td>
                      <Badge tone={statusTone(row.reimbursementStatus)}>
                        {row.reimbursementStatus}
                      </Badge>
                    </Td>
                  </tr>
                ))}
                {latestSynced.length === 0 && !loading ? (
                  <tr>
                    <Td colSpan={5}>
                      <p className="py-6 text-center text-sm text-ink/50">
                        No Brex expenses yet. Sync Brex after BREX_API_TOKEN is set.
                      </p>
                    </Td>
                  </tr>
                ) : null}
              </tbody>
            </DataTable>
          </CardBody>
        </Card>
      ) : null}

      <Modal
        open={!!confirmRow}
        onClose={() => (confirming ? undefined : setConfirmRow(null))}
        title="Confirm reimbursement"
      >
        {confirmRow ? (
          <div className="space-y-4 p-6">
            <p className="text-sm text-ink/70">
              Approve this reimbursement only after you have verified it in Brex. This credits
              the person&apos;s live balance.
            </p>
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink/55">Person</dt>
                <dd>{personName(confirmRow.matchedUserId, names, confirmRow.cardholderName)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink/55">Merchant</dt>
                <dd>{confirmRow.merchantName || confirmRow.description || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink/55">Amount</dt>
                <dd>{formatCurrency(confirmRow.amount)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink/55">Date</dt>
                <dd>
                  {confirmRow.occurredAt
                    ? formatDate(confirmRow.occurredAt.slice(0, 10))
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink/55">Requested by</dt>
                <dd>{personName(confirmRow.reimbursementRequestedBy, names)}</dd>
              </div>
            </dl>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                disabled={confirming}
                onClick={() => setConfirmRow(null)}
              >
                Cancel
              </Button>
              <Button disabled={confirming} onClick={() => void approveConfirmed()}>
                {confirming ? "Approving…" : "Yes, approve reimbursement"}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
