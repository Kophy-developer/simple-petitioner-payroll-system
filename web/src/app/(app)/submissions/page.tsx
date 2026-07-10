"use client";

import { useState } from "react";
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
import { issues, submissions, getUserName, getIssue, getUser } from "@/lib/demo-data";
import { useDemoSession } from "@/lib/demo-session";
import { canEditSubmissions, visibleUserIds } from "@/lib/access";
import { formatDate } from "@/lib/format";
import type { Submission } from "@/lib/types";

export default function SubmissionsPage() {
  const { user } = useDemoSession();
  const [issueId, setIssueId] = useState(issues[0].id);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState<Submission | null>(null);
  const [draftSigs, setDraftSigs] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  if (!user) return null;

  const canEdit = canEditSubmissions(user.role);
  const visible = submissions.filter((s) =>
    visibleUserIds(user, submissions.map((x) => x.userId)).includes(s.userId),
  );

  function openEdit(row: Submission) {
    setEditing(row);
    setDraftSigs(String(row.rawSignatures));
  }

  function requestSave() {
    setConfirmOpen(true);
  }

  function confirmSave() {
    setConfirmOpen(false);
    setEditing(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Collection"
        title="Signature Submission"
        description="Log raw signatures and page counts. Admins can edit rows with confirmation."
      />

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader><h2 className="font-display text-xl text-ink">New submission</h2></CardHeader>
          <CardBody>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
              }}
              className="space-y-4"
            >
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
                <Input id="sigs" type="number" min={0} defaultValue={36} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pages">Page numbers</Label>
                <Input id="pages" type="number" min={0} defaultValue={4} />
              </div>
              <Button type="submit" className="w-full">Submit</Button>
              {saved && !editing ? <p className="text-center text-sm text-success">Submission recorded.</p> : null}
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
                {visible.map((row) => (
                  <tr key={row.id}>
                    <Td>{getIssue(row.issueId)?.issueNumber}</Td>
                    <Td>
                      <div>{getUserName(row.userId)}</div>
                      {row.lastEditedBy ? (
                        <p className="mt-1 text-[11px] text-ink/45">
                          Edited by {getUserName(row.lastEditedBy)} · {formatDate(row.lastEditedAt!)}
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
              requestSave();
            }}
          >
            <p className="text-sm text-ink/65">
              Editing {getUserName(editing.userId)} · {getIssue(editing.issueId)?.issueNumber}
            </p>
            <div className="space-y-2">
              <Label>Raw signatures</Label>
              <Input type="number" min={0} value={draftSigs} onChange={(e) => setDraftSigs(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Page numbers</Label>
              <Input type="number" min={0} defaultValue={editing.pageNumbers} />
            </div>
            <Button type="submit" className="w-full">Save</Button>
          </form>
        ) : null}
      </Modal>

      <Modal open={confirmOpen && !!editing} onClose={() => setConfirmOpen(false)} title="Confirm ledger recalculation">
        {editing ? (
          <div className="space-y-4">
            <p className="text-sm leading-7 text-ink/75">
              You are changing {getUser(editing.userId)?.firstName}&apos;s raw signatures for{" "}
              {getIssue(editing.issueId)?.issueNumber} from {editing.rawSignatures} to {draftSigs}. This will
              recalculate their ledger. Confirm?
            </p>
            <div className="flex gap-3">
              <Button className="flex-1" onClick={confirmSave}>Confirm</Button>
              <Button variant="ghost" className="flex-1" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
