"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useDemoSession } from "@/lib/demo-session";
import { authUserId } from "@/lib/api/live";
import { listRentalCarAssignments, returnRentalCar } from "@/lib/api/remodel";
import type { RentalCarAssignment } from "@/lib/types";
import { rentalCarGuideTotal, rentalCarInclusiveDays } from "@/lib/rental-car-math";
import { formatCurrency } from "@/lib/format";

export function MyRentalCarCard() {
  const { user } = useDemoSession();
  const [cars, setCars] = useState<RentalCarAssignment[]>([]);
  const [dropoff, setDropoff] = useState("");
  const [returnAt, setReturnAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    const rows = await listRentalCarAssignments(true);
    const uid = authUserId(user);
    setCars(rows.filter((r) => r.userId === uid));
  }, [user]);

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : "Could not load rental"));
  }, [load]);

  const active = cars[0] ?? null;

  const estimate = useMemo(() => {
    if (!active) return null;
    const days = rentalCarInclusiveDays(active.pickupAt, returnAt);
    return { days, total: rentalCarGuideTotal(days) };
  }, [active, returnAt]);

  async function handleReturn() {
    if (!active) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await returnRentalCar(active.id, returnAt, undefined, dropoff.trim() || undefined);
      setMessage("Car returned. Billing true-up will appear on payroll/ledger when you have access.");
      setDropoff("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Return failed");
    } finally {
      setBusy(false);
    }
  }

  if (!user || !active) return null;

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl text-ink">My rental car</h2>
          <Badge tone="warning">Active</Badge>
        </div>
        <div className="grid gap-2 text-sm text-ink/70 sm:grid-cols-2">
          <p>Agreement: {active.agreementNumber || "—"}</p>
          <p>Pickup: {active.pickupAt}</p>
          <p>Pickup location: {active.pickupLocation || "—"}</p>
          <p>Drop-off on file: {active.dropoffLocation || "—"}</p>
        </div>
        {estimate ? (
          <p className="text-sm text-ink/70">
            Estimated charge through return date: {estimate.days} day(s) · {formatCurrency(estimate.total)}
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="return-at">Return date</Label>
            <Input
              id="return-at"
              type="date"
              value={returnAt}
              min={active.pickupAt.slice(0, 10)}
              onChange={(e) => setReturnAt(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dropoff">Drop-off location</Label>
            <Input
              id="dropoff"
              value={dropoff}
              onChange={(e) => setDropoff(e.target.value)}
              placeholder="Where you returned the car"
            />
          </div>
        </div>
        <Button type="button" disabled={busy || !dropoff.trim()} onClick={() => void handleReturn()}>
          {busy ? "Returning…" : "Confirm return"}
        </Button>
        {message ? <p className="text-sm text-success">{message}</p> : null}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </CardBody>
    </Card>
  );
}
