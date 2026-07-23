"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useDemoSession } from "@/lib/demo-session";
import { canEditFinancialConfig } from "@/lib/access";
import { payModelLabel } from "@/lib/payroll";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  createIssue,
  createPetition,
  listIssues,
  listPayRates,
  listPetitions,
  updateIssue,
} from "@/lib/api/live";
import type { Issue, PayModel, PayRate, Petition } from "@/lib/types";

export default function IssuesPage() {
  const { user } = useDemoSession();
  const [tab, setTab] = useState<"issues" | "petitions">("issues");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [petitions, setPetitions] = useState<Petition[]>([]);
  const [payRates, setPayRates] = useState<PayRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [issueOpen, setIssueOpen] = useState(false);
  const [editIssueId, setEditIssueId] = useState<string | null>(null);
  const [petitionOpen, setPetitionOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [issueNumber, setIssueNumber] = useState("");
  const [issueName, setIssueName] = useState("");
  const [petitionId, setPetitionId] = useState("");
  const [state, setState] = useState("");
  const [validatedBy, setValidatedBy] = useState("");
  const [turnInDate, setTurnInDate] = useState("");
  const [turnInNumber, setTurnInNumber] = useState("");
  const [payModel, setPayModel] = useState<PayModel>("validity_standard");
  const [payRate, setPayRate] = useState("");

  const [petitionName, setPetitionName] = useState("");
  const [petitionCode, setPetitionCode] = useState("");
  const [petitionPay, setPetitionPay] = useState("1");
  const [petitionLotus, setPetitionLotus] = useState("");

  const readOnly = user?.role === "petitioner" || user?.role === "validator";
  const canCreateIssue =
    !readOnly &&
    (canEditFinancialConfig(user?.role ?? "petitioner") || user?.role === "account_admin");
  const canCreatePetition = user?.role === "super_admin";
  const canSetPayRate = user?.role === "super_admin";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [issueRows, petitionRows, rateRows] = await Promise.all([
        listIssues(),
        listPetitions(),
        listPayRates(),
      ]);
      setIssues(issueRows);
      setPetitions(petitionRows);
      setPayRates(rateRows);
      setPetitionId((current) => current || petitionRows[0]?.id || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load issues.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitIssue(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editIssueId) {
        await updateIssue({
          issueId: editIssueId,
          issueNumber,
          name: issueName,
          state,
          validatedBy,
          turnInDate: turnInDate || null,
          turnInNumber,
          payModel,
        });
      } else {
        await createIssue({
          issueNumber,
          name: issueName,
          petitionId,
          state,
          validatedBy,
          turnInDate,
          turnInNumber,
          payModel,
          payRate:
            canSetPayRate && payRate !== "" ? parseFloat(payRate) : undefined,
        });
      }
      setIssueOpen(false);
      setEditIssueId(null);
      setIssueNumber("");
      setIssueName("");
      setState("");
      setValidatedBy("");
      setTurnInDate("");
      setTurnInNumber("");
      setPayModel("validity_standard");
      setPayRate("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save issue.");
    } finally {
      setSaving(false);
    }
  }

  function openCreateIssue() {
    setEditIssueId(null);
    setIssueNumber("");
    setIssueName("");
    setState("");
    setValidatedBy("");
    setTurnInDate("");
    setTurnInNumber("");
    setPayModel("validity_standard");
    setPayRate("");
    setIssueOpen(true);
  }

  function openEditIssue(issue: Issue) {
    setEditIssueId(issue.id);
    setIssueNumber(issue.issueNumber);
    setIssueName(issue.name);
    setPetitionId(issue.petitionId);
    setState(issue.state);
    setValidatedBy(issue.validatedBy);
    setTurnInDate(issue.turnInDate);
    setTurnInNumber(issue.turnInNumber);
    setPayModel(issue.payModel);
    setPayRate("");
    setIssueOpen(true);
  }

  async function submitPetition(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await createPetition({
        name: petitionName,
        code: petitionCode,
        pay: parseFloat(petitionPay),
        lotus: petitionLotus,
      });
      setPetitionOpen(false);
      setPetitionName("");
      setPetitionCode("");
      setPetitionPay("1");
      setPetitionLotus("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create petition.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Collection"
        title="Issues & Petitions"
        description="Manage issues and petition rates."
      />

      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
      {loading ? <p className="text-sm text-ink/55">Loading…</p> : null}

      <div className="flex gap-2">
        <Button variant={tab === "issues" ? "primary" : "ghost"} size="sm" onClick={() => setTab("issues")}>
          Issues
        </Button>
        <Button variant={tab === "petitions" ? "primary" : "ghost"} size="sm" onClick={() => setTab("petitions")}>
          Petition Pay Table
        </Button>
      </div>

      {tab === "issues" ? (
        <Card>
          <CardBody className="space-y-4 p-0">
            <DataTable>
              <thead>
                <tr>
                  <Th>Issue #</Th>
                  <Th>Name</Th>
                  <Th>Petition</Th>
                  <Th>State</Th>
                  <Th>Validated by</Th>
                  <Th>Turn-in</Th>
                  <Th>Pay model</Th>
                  {canCreateIssue ? <Th /> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/8 bg-white/50">
                {issues.map((issue) => {
                  const petition = petitions.find((p) => p.id === issue.petitionId);
                  return (
                    <tr key={issue.id}>
                      <Td>{issue.issueNumber}</Td>
                      <Td>{issue.name}</Td>
                      <Td>{petition?.name}</Td>
                      <Td><Badge tone="navy">{issue.state}</Badge></Td>
                      <Td>{issue.validatedBy || "—"}</Td>
                      <Td>
                        {issue.turnInNumber || "—"}
                        {issue.turnInDate ? ` · ${formatDate(issue.turnInDate)}` : ""}
                      </Td>
                      <Td>{payModelLabel(issue.payModel)}</Td>
                      {canCreateIssue ? (
                        <Td>
                          <Button variant="ghost" size="sm" onClick={() => openEditIssue(issue)}>
                            Edit
                          </Button>
                        </Td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
            {canCreateIssue ? (
              <div className="border-t border-ink/10 px-6 py-4">
                <Button size="sm" onClick={openCreateIssue}>
                  Add issue
                </Button>
              </div>
            ) : null}
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="space-y-4 p-0">
            <DataTable>
              <thead>
                <tr>
                  <Th>Petition</Th>
                  <Th>Code</Th>
                  <Th align="right">Pay</Th>
                  <Th>Lotus</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/8 bg-white/50">
                {petitions.map((petition) => {
                  const rates = payRates.filter((r) => r.petitionId === petition.id);
                  const open = expanded === petition.id;
                  return (
                    <Fragment key={petition.id}>
                      <tr>
                        <Td>{petition.name}</Td>
                        <Td>{petition.code}</Td>
                        <Td align="right">{formatCurrency(petition.pay)}</Td>
                        <Td>{petition.lotus}</Td>
                        <Td>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpanded(open ? null : petition.id)}
                          >
                            {open ? "Hide rates" : "Pay rates"}
                          </Button>
                        </Td>
                      </tr>
                      {open ? (
                        <tr>
                          <Td colSpan={5}>
                            <div className="rounded-xl bg-parchment/60 px-4 py-3 text-sm">
                              {rates.map((rate) => {
                                const issue = issues.find((i) => i.id === rate.issueId);
                                return (
                                  <div
                                    key={rate.issueId}
                                    className="flex justify-between border-b border-ink/5 py-2 last:border-0"
                                  >
                                    <span>{issue?.issueNumber}</span>
                                    <span className="tabular-nums">{formatCurrency(rate.rate)}</span>
                                  </div>
                                );
                              })}
                              {rates.length === 0 ? (
                                <p className="text-ink/50">No pay rates configured.</p>
                              ) : null}
                            </div>
                          </Td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </DataTable>
            {canCreatePetition ? (
              <div className="border-t border-ink/10 px-6 py-4">
                <Button size="sm" onClick={() => setPetitionOpen(true)}>
                  Add petition
                </Button>
              </div>
            ) : null}
          </CardBody>
        </Card>
      )}

      <Modal
        open={issueOpen}
        onClose={() => {
          setIssueOpen(false);
          setEditIssueId(null);
        }}
        title={editIssueId ? "Edit issue" : "Add issue"}
      >
        <form className="space-y-4" onSubmit={(e) => void submitIssue(e)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Issue number</Label>
              <Input required value={issueNumber} onChange={(e) => setIssueNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input required value={state} onChange={(e) => setState(e.target.value)} placeholder="CO" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input required value={issueName} onChange={(e) => setIssueName(e.target.value)} />
          </div>
          {!editIssueId ? (
            <div className="space-y-2">
              <Label>Petition</Label>
              <Select required value={petitionId} onChange={(e) => setPetitionId(e.target.value)}>
                {petitions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Pay model</Label>
              <Select value={payModel} onChange={(e) => setPayModel(e.target.value as PayModel)}>
                <option value="validity_standard">Validity standard</option>
                <option value="per_valid_sig">Per valid signature</option>
              </Select>
            </div>
            {canSetPayRate && !editIssueId ? (
              <div className="space-y-2">
                <Label>Pay rate (optional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={payRate}
                  onChange={(e) => setPayRate(e.target.value)}
                />
              </div>
            ) : !editIssueId ? (
              <div className="space-y-2">
                <Label>Pay rate</Label>
                <p className="text-sm text-ink/55">Set later on Pay Rates (super admin).</p>
              </div>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Validated by</Label>
              <Input value={validatedBy} onChange={(e) => setValidatedBy(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Turn-in number</Label>
              <Input value={turnInNumber} onChange={(e) => setTurnInNumber(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Turn-in date</Label>
            <Input type="date" value={turnInDate} onChange={(e) => setTurnInDate(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={saving || (!editIssueId && petitions.length === 0)}>
            {saving ? "Saving…" : editIssueId ? "Save issue" : "Create issue"}
          </Button>
        </form>
      </Modal>

      <Modal open={petitionOpen} onClose={() => setPetitionOpen(false)} title="Add petition">
        <form className="space-y-4" onSubmit={(e) => void submitPetition(e)}>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input required value={petitionName} onChange={(e) => setPetitionName(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Code</Label>
              <Input required value={petitionCode} onChange={(e) => setPetitionCode(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Base pay</Label>
              <Input
                required
                type="number"
                step="0.01"
                value={petitionPay}
                onChange={(e) => setPetitionPay(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Lotus</Label>
            <Input value={petitionLotus} onChange={(e) => setPetitionLotus(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Creating…" : "Create petition"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
