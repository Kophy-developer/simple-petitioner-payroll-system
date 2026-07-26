"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ColoradoImporterPage() {
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Collection"
        title="Colorado validity importer"
        description="Scaffold for CO validity reports. Drop source files on the server, then upload here when ready."
      />
      <Card>
        <CardBody className="space-y-4">
          <p className="text-sm text-ink/70">
            Drop folder (server / repo):{" "}
            <code className="rounded bg-ink/5 px-1.5 py-0.5 text-xs">
              data/colorado-validity-drop/
            </code>
          </p>
          <p className="text-sm text-ink/55">
            Place vendor Excel/CSV files in that folder. Parsing wires into the existing Validity
            Records import once files arrive — no sample data is invented here.
          </p>
          <div className="space-y-2">
            <Label htmlFor="co-file">Upload CO validity file (preview only)</Label>
            <Input
              id="co-file"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setFileName(f?.name ?? "");
                setMessage(
                  f
                    ? `Received ${f.name}. Full import mapping will run once the file layout is confirmed.`
                    : "",
                );
              }}
            />
            {fileName ? <p className="text-xs text-ink/55">{fileName}</p> : null}
          </div>
          {message ? (
            <p className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">{message}</p>
          ) : null}
          <Button
            variant="ghost"
            onClick={() =>
              setMessage(
                "Use Validity Records → Turn-in import for live CO/MI shapes already supported.",
              )
            }
          >
            Open guidance
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
