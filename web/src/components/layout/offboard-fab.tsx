"use client";

import { useEffect, useState } from "react";
import { UserMinus } from "lucide-react";
import { useDemoSession } from "@/lib/demo-session";
import { listProfiles } from "@/lib/api/live";
import { offboardUser } from "@/lib/api/remodel";
import type { DemoUser } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export function OffboardFab() {
  const { user } = useDemoSession();
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<DemoUser[]>([]);
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    void listProfiles()
      .then((rows) => {
        const active = rows.filter((r) => r.status !== "offboarded" && r.id !== user?.authId);
        setPeople(active);
        if (active[0]) setSelected(active[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load users."));
  }, [open, user?.authId]);

  if (!user || user.role !== "super_admin") return null;

  async function confirmOffboard() {
    if (!selected) return;
    setError("");
    setMessage("");
    try {
      await offboardUser(selected);
      setMessage("User offboarded. Login revoked; history retained.");
      setPeople((prev) => prev.filter((p) => p.id !== selected));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not offboard user.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-5 bottom-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-ink text-parchment shadow-lg print:hidden"
        aria-label="Offboard employees"
      >
        <UserMinus size={18} />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-ink/40 p-5 print:hidden">
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-ink/10 bg-parchment p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl text-ink">Offboard</h2>
              <button type="button" className="text-sm text-ink/55" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            <p className="text-sm text-ink/60">
              Permanently revoke login. Ledger and payment history stay on a frozen record.
            </p>
            <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName} · {p.role}
                </option>
              ))}
            </Select>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            {message ? <p className="text-sm text-success">{message}</p> : null}
            <Button className="w-full" onClick={() => void confirmOffboard()}>
              Offboard selected user
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
