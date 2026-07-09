"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { api } from "@/lib/api/client";
import { useDemoSession } from "@/lib/demo-session";
import { formatDate } from "@/lib/format";
import type { ClockSession } from "@/lib/types";

export default function ClockPage() {
  const { user } = useDemoSession();
  const [active, setActive] = useState<ClockSession | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [history, setHistory] = useState<ClockSession[]>([]);

  useEffect(() => {
    if (!user) return;
    api.clock.activeForUser(user.id).then((s) => setActive(s ?? null));
    api.clock.sessions().then((s) => setHistory(s.filter((x) => x.userId === user.id && x.clockOut)));
  }, [user]);

  useEffect(() => {
    if (!active) return;
    const start = new Date(active.clockIn).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 60000));
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [active]);

  if (!user) return null;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Field" title="Clock In / Out" description="GPS tracking begins when you clock in." />
      <Card className="max-w-xl"><CardBody className="space-y-6 text-center">
        {active ? (
          <>
            <p className="text-sm text-ink/60">On shift since {formatDate(active.clockIn)}</p>
            <p className="font-display text-5xl tabular-nums text-ink">{elapsed} min</p>
            <Button variant="danger" className="w-full" onClick={() => setActive(null)}>Clock out</Button>
          </>
        ) : (
          <>
            <Clock size={48} className="mx-auto text-brass" />
            <Button className="w-full" onClick={() => setActive({ id: "new", userId: user.id, clockIn: new Date().toISOString(), clockOut: null, durationMinutes: null, distanceMiles: null })}>Clock in</Button>
            <p className="text-xs text-ink/50">Location permission required to start shift.</p>
          </>
        )}
      </CardBody></Card>
      {history.length > 0 ? (
        <Card><CardBody className="space-y-3">
          <h2 className="font-display text-xl text-ink">Recent shifts</h2>
          {history.map((s) => (
            <div key={s.id} className="flex justify-between rounded-xl border border-ink/10 px-4 py-3 text-sm">
              <span>{formatDate(s.clockIn)}</span>
              <span className="tabular-nums">{s.durationMinutes} min · {s.distanceMiles} mi</span>
            </div>
          ))}
        </CardBody></Card>
      ) : null}
      <Link href="/gps" className="text-sm text-civic-navy hover:underline">View GPS map</Link>
    </div>
  );
}
