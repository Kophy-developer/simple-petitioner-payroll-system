"use client";

import { Fragment, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { issues, payRates, petitions } from "@/lib/demo-data";
import { useDemoSession } from "@/lib/demo-session";
import { canEditFinancialConfig } from "@/lib/access";
import { payModelLabel } from "@/lib/payroll";
import { formatCurrency } from "@/lib/format";

export default function IssuesPage() {
  const { user } = useDemoSession();
  const [tab, setTab] = useState<"issues" | "petitions">("issues");
  const [expanded, setExpanded] = useState<string | null>(null);
  const canEdit =
    !!user &&
    (canEditFinancialConfig(user.role) ||
      user.role === "account_admin" ||
      user.role === "team_lead");
  const readOnly = user?.role === "petitioner" || user?.role === "validator";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Collection"
        title="Issues & Petitions"
        description="Issue setup, pay models, and petition base rates."
      />

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
                      <Td>{issue.validatedBy}</Td>
                      <Td>{issue.turnInNumber}</Td>
                      <Td>{payModelLabel(issue.payModel)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
            {!readOnly && canEdit ? (
              <div className="border-t border-ink/10 px-6 py-4">
                <Button size="sm">Add issue</Button>
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
                            </div>
                          </Td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </DataTable>
            {user?.role === "super_admin" ? (
              <div className="border-t border-ink/10 px-6 py-4">
                <Button size="sm">Add petition</Button>
              </div>
            ) : null}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
