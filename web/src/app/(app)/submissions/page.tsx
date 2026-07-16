"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { useDemoSession } from "@/lib/demo-session";
import { canEditSubmissions } from "@/lib/access";
import { formatDate } from "@/lib/format";
import {
  confirmSubmissionEdit,
  createSubmission,
  getProfile,
  listIssues,
  listSubmissions,
  previewSubmissionEdit,
} from "@/lib/api/live";
import type { Issue, Submission } from "@/lib/types";

export default function SubmissionsPage() {
  const { user } = useDemoSession();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [issueId, setIssueId] = useState("");
  const [rawSigs, setRawSigs] = useState("36");
  const [pages, setPages] = useState("4");
  const [rows, setRows] = useState<Submission[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Submission | null>(null);
  const [draftSigs, setDraftSigs] = useState("");
  const [draftPages, setDraftPages] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);

  const canEdit = user ? canEditSubmissions(user.role) : false;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [issueRows, submissionRows] = await Promise.all([
        listIssues(),
        listSubmissions(),
      ]);
      setIssues(issueRows);
      if (!issueId && issueRows[0]) setIssueId(issueRows[0].id);
      setRows(submissionRows);

      const unique = [...new Set(submissionRows.flatMap((s) => [s.userId, s.lastEditedBy].filter(Boolean) as string[]))];
      const entries = await Promise.all(
        unique.map(async (id) => {
          const profile = await getProfile(id);
          return [id, profile ? `${profile.firstName} ${profile.lastName}` : "Unknown"] as const;
        }),
      );
      setNames(Object.fromEntries(entries));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load submissions.");
    } finally {
      setLoading(false);
    }
  }, [issueId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user) return null;

  async function submitNew(e: React.FormEvent) {
    e.preventDefault();
    if (!issueId) return;
    setSaving(true);
    setError("");
    try {
      await createSubmission({
        issueId,
        rawSignatures: parseInt(rawSigs, 10),
        pageNumbers: parseInt(pages, 10),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save submission.");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(row: Submission) {
    setEditing(row);
    setDraftSigs(String(row.rawSignatures));
    setDraftPages(String(row.pageNumbers));
    setPreview(null);
  }

  async function requestSave() {
    if (!editing) return;
    setError("");
    try {
      const result = await previewSubmissionEdit({
        submissionId: editing.id,
        rawSignatures: parseInt(draftSigs, 10),
        pageNumbers: parseInt(draftPages, 10),
      });
      setPreview(result);
      setConfirmOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not preview edit.");
    }
  }

  async function confirmSave() {
    if (!editing) return;
    setSaving(true);
    setError("");
    try {
      await confirmSubmissionEdit({
        submissionId: editing.id,
        rawSignatures: parseInt(draftSigs, 10),
        pageNumbers: parseInt(draftPages, 10),
      });
      setConfirmOpen(false);
      setEditing(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm edit.");
    } finally {
      setSaving(false);
    }
  }

  const issueLabel = (id: string) => issues.find((i) => i.id === id)?.issueNumber ?? id;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Collection"
        title="Signature Submission"
        description="Log raw signatures and page counts. Admin edits recalculate the ledger."
      />

      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
      {loading ? <p className="text-sm text-ink/55">Loading submissions…</p> : null}

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader><h2 className="font-display text-xl text-ink">New submission</h2></CardHeader>
          <CardBody>
            <form onSubmit={(e) => void submitNew(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="issue">Issue</Label>
                <Select id="issue" value={issueId} onChange={(e) => setIssueId(e.target.value)}>
                  {issues.map((i) => (
                    <option key={i.id} value={i.id}>{i.issueNumber}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sigs">Raw signatures</Label>
                <Input id="sigs" type="number" min={0} value={rawSigs} onChange={(e) => setRawSigs(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pages">Page numbers</Label>
                <Input id="pages" type="number" min={0} value={pages} onChange={(e) => setPages(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving && !editing ? "Saving…" : "Submit"}
              </Button>
              {saved && !editing ? <p className="text-center text-sm text-success">Submission saved — ledger updated.</p> : null}
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h2 className="font-display text-xl text-ink">Submissions</h2></CardHeader>
          <CardBody className="p-0">
            <DataTable>
              <thead>
                <tr>
                  <Th>Issue</Th>
                  <Th>User</Th>
                  <Th align="right">Raw</Th>
                  <Th align="right">Pages</Th>
                  <Th align="right">Pooled SIGs</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/8 bg-white/50">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <Td>{issueLabel(row.issueId)}</Td>
                    <Td>
                      <div>{names[row.userId] ?? "Unknown"}</div>
                      {row.lastEditedBy ? (
                        <p className="mt-1 text-[11px] text-ink/45">
                          Edited by {names[row.lastEditedBy] ?? "Unknown"}
                          {row.lastEditedAt ? ` · ${formatDate(row.lastEditedAt)}` : ""}
                        </p>
                      ) : null}
                    </Td>
                    <Td align="right">{row.rawSignatures}</Td>
                    <Td align="right">{row.pageNumbers}</Td>
                    <Td align="right">{row.pooledSignatures}</Td>
                    <Td>
                      {canEdit ? (
                        <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                          <Pencil size={14} />
                        </Button>
                      ) : null}
                      {row.lastEditedBy ? <Badge tone="warning">Edited</Badge> : null}
                    </Td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <Td colSpan={6}>
                      <p className="py-6 text-center text-sm text-ink/50">No submissions yet.</p>
                    </Td>
                  </tr>
                ) : null}
              </tbody>
            </DataTable>
          </CardBody>
        </Card>
      </div>

      <Modal open={!!editing && !confirmOpen} onClose={() => setEditing(null)} title="Edit submission">
        {editing ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void requestSave();
            }}
          >
            <p className="text-sm text-ink/65">
              Editing {names[editing.userId] ?? "Unknown"} · {issueLabel(editing.issueId)}
            </p>
            <div className="space-y-2">
              <Label>Raw signatures</Label>
              <Input type="number" min={0} value={draftSigs} onChange={(e) => setDraftSigs(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Page numbers</Label>
              <Input type="number" min={0} value={draftPages} onChange={(e) => setDraftPages(e.target.value)} />
            </div>
            <Button type="submit" className="w-full">Save</Button>
          </form>
        ) : null}
      </Modal>

      <Modal open={confirmOpen && !!editing} onClose={() => setConfirmOpen(false)} title="Confirm ledger recalculation">
        {editing ? (
          <div className="space-y-4">
            <p className="text-sm leading-7 text-ink/75">
              You are changing {(names[editing.userId] ?? "this user").split(" ")[0]}&apos;s raw signatures for{" "}
              {issueLabel(editing.issueId)} from {editing.rawSignatures} to {draftSigs}. This will
              recalculate their ledger. Confirm?
            </p>
            {preview ? (
              <div className="rounded-xl bg-civic-navy/8 px-4 py-3 text-sm text-ink/80">
                Preview total pay: {String(preview.total_pay ?? "—")} · upfront: {String(preview.upfront ?? "—")} · hold:{" "}
                {String(preview.hold ?? "—")}
              </div>
            ) : null}
            <div className="flex gap-3">
              <Button className="flex-1" disabled={saving} onClick={() => void confirmSave()}>
                {saving ? "Saving…" : "Confirm"}
              </Button>
              <Button variant="ghost" className="flex-1" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
