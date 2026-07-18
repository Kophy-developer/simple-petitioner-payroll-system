"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { listLotusTeamLedger, listSubAccounts, setUserSubAccount } from "@/lib/api/remodel";
import { listProfiles } from "@/lib/api/live";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { DemoUser, SubAccount } from "@/lib/types";

type LotusRow = {
  userId: string;
  firstName: string;
  lastName: string;
  initials: string;
  lineCount: number;
  totalPay: number;
  upfront: number;
  hold: number;
};

export default function LotusLedgerPage() {
  const [rows, setRows] = useState<LotusRow[]>([]);
  const [accounts, setAccounts] = useState<SubAccount[]>([]);
  const [people, setPeople] = useState<DemoUser[]>([]);
  const [assignUser, setAssignUser] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setError("");
    try {
      const [ledger, subs, profiles] = await Promise.all([
        listLotusTeamLedger(),
        listSubAccounts(),
        listProfiles(),
      ]);
      setRows(ledger);
      setAccounts(subs);
      setPeople(profiles);
      if (!assignUser && profiles[0]) setAssignUser(profiles[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load Lotus ledger.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function assignToLotus() {
    const lotus = accounts.find((a) => a.code === "LOTUS");
    if (!lotus || !assignUser) return;
    setMessage("");
    try {
      await setUserSubAccount(assignUser, lotus.id);
      setMessage("User assigned to Lotus sub-account.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not assign user.");
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Partner"
        title="Lotus Team Ledger"
        description="Lotus is a partner sub-account. Circulators on Lotus are paid the Lotus rate (markup is their profit). BAP-operated view only."
      />
      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
      {message ? <p className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">{message}</p> : null}

      <Card>
        <CardBody className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1 space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-ink/50">Assign worker to Lotus</p>
            <Select value={assignUser} onChange={(e) => setAssignUser(e.target.value)}>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName}
                </option>
              ))}
            </Select>
          </div>
          <Button onClick={() => void assignToLotus()}>Assign to Lotus</Button>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          <DataTable>
            <thead>
              <tr>
                <Th>Circulator</Th>
                <Th align="right">Lines</Th>
                <Th align="right">Total pay</Th>
                <Th align="right">Upfront</Th>
                <Th align="right">Hold</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/8 bg-white/50">
              {rows.map((row) => (
                <tr key={row.userId}>
                  <Td>
                    {row.firstName} {row.lastName}{" "}
                    <span className="text-ink/45">({row.initials})</span>
                  </Td>
                  <Td align="right">{row.lineCount}</Td>
                  <Td align="right">{formatCurrency(row.totalPay)}</Td>
                  <Td align="right">{formatCurrency(row.upfront)}</Td>
                  <Td align="right">{formatCurrency(row.hold)}</Td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <Td colSpan={5}>
                    <p className="py-6 text-center text-sm text-ink/50">
                      No Lotus circulators assigned yet.
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
