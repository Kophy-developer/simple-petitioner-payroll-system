"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDemoSession } from "@/lib/demo-session";
import { isFieldRole } from "@/lib/access";
import {
  clockIn,
  clockOut,
  clockPing,
  getOpenClockSession,
  readDevicePosition,
  type ClockSession,
} from "@/lib/api/clock";

const OUT_PROMPT_KEY = "bap-clock-out-prompt-at";

export function ClockPrompt() {
  const { user } = useDemoSession();
  const [session, setSession] = useState<ClockSession | null>(null);
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<"in" | "out">("in");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!user || !isFieldRole(user.role)) {
      setSession(null);
      setVisible(false);
      return;
    }
    try {
      const open = await getOpenClockSession();
      setSession(open);
      if (!open) {
        setMode("in");
        setVisible(true);
        return;
      }
      const last = Number(sessionStorage.getItem(OUT_PROMPT_KEY) || "0");
      const due = Date.now() - last > 60 * 60 * 1000;
      if (due) {
        setMode("out");
        setVisible(true);
      } else {
        setVisible(false);
      }
    } catch {
      setVisible(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (pingTimer.current) {
      clearInterval(pingTimer.current);
      pingTimer.current = null;
    }
    if (!session || session.status !== "open") return;

    async function pingOnce() {
      if (document.visibilityState !== "visible") return;
      try {
        const pos = await readDevicePosition();
        await clockPing(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      } catch {
      }
    }

    void pingOnce();
    pingTimer.current = setInterval(() => void pingOnce(), 60_000);
    return () => {
      if (pingTimer.current) clearInterval(pingTimer.current);
    };
  }, [session]);

  if (!user || !isFieldRole(user.role) || !visible) return null;

  async function act() {
    setBusy(true);
    setError("");
    try {
      const pos = await readDevicePosition();
      if (mode === "in") {
        const started = await clockIn(pos.coords.latitude, pos.coords.longitude);
        setSession(started);
        setVisible(false);
      } else {
        await clockOut(pos.coords.latitude, pos.coords.longitude);
        sessionStorage.setItem(OUT_PROMPT_KEY, String(Date.now()));
        setSession(null);
        setMode("in");
        setVisible(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Location required to complete clock action.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pointer-events-none fixed top-4 right-4 z-50 w-[min(100vw-2rem,22rem)]">
      <div className="pointer-events-auto rounded-2xl border border-ink/10 bg-white/95 p-4 shadow-lg backdrop-blur">
        <p className="font-display text-lg text-ink">
          {mode === "in" ? "Clock in now?" : "Still on the clock — clock out?"}
        </p>
        <p className="mt-1 text-xs text-ink/55">
          Location is required. While clocked in, movement is saved about once a minute.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={busy} onClick={() => void act()}>
            {busy ? "Working…" : mode === "in" ? "Clock in" : "Clock out"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              if (mode === "out") sessionStorage.setItem(OUT_PROMPT_KEY, String(Date.now()));
              setVisible(false);
            }}
          >
            Not now
          </Button>
        </div>
        {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
        {session?.status === "open" ? (
          <p className="mt-2 text-xs text-ink/45">
            Started {new Date(session.startedAt).toLocaleString()}
          </p>
        ) : null}
      </div>
    </div>
  );
}
