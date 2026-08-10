"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDemoSession } from "@/lib/demo-session";
import { canRunPayroll } from "@/lib/access";
import {
  listClockPings,
  listClockSessions,
  type ClockPing,
  type ClockSession,
} from "@/lib/api/clock";
import { listProfiles } from "@/lib/api/live";

export default function AdminClockPage() {
  const { user } = useDemoSession();
  const [sessions, setSessions] = useState<ClockSession[]>([]);
  const [people, setPeople] = useState<{ id: string; label: string }[]>([]);
  const [userId, setUserId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [pings, setPings] = useState<ClockPing[]>([]);
  const [error, setError] = useState("");
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObj = useRef<mapboxgl.Map | null>(null);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

  useEffect(() => {
    if (!user || !canRunPayroll(user.role)) return;
    void (async () => {
      try {
        const [sess, profiles] = await Promise.all([listClockSessions(), listProfiles()]);
        setSessions(sess);
        setPeople(
          profiles.map((p) => ({
            id: p.id,
            label: `${p.firstName} ${p.lastName}`.trim() || p.email,
          })),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load clock data");
      }
    })();
  }, [user]);

  const filtered = useMemo(
    () => (userId ? sessions.filter((s) => s.userId === userId) : sessions),
    [sessions, userId],
  );

  const selected = filtered.find((s) => s.id === selectedId) ?? filtered[0] ?? null;

  useEffect(() => {
    if (!selected) {
      setPings([]);
      return;
    }
    setSelectedId(selected.id);
    void listClockPings(selected.id)
      .then(setPings)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load pings"));
  }, [selected?.id]);

  useEffect(() => {
    if (!mapRef.current || !token || !selected) return;

    mapboxgl.accessToken = token;
    if (mapObj.current) {
      mapObj.current.remove();
      mapObj.current = null;
    }

    const points = [
      { lng: selected.startLng, lat: selected.startLat },
      ...pings.map((p) => ({ lng: p.lng, lat: p.lat })),
    ];
    if (selected.endLng != null && selected.endLat != null) {
      points.push({ lng: selected.endLng, lat: selected.endLat });
    }
    if (points.length === 0) return;

    const map = new mapboxgl.Map({
      container: mapRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [points[0].lng, points[0].lat],
      zoom: 12,
    });
    mapObj.current = map;

    map.on("load", () => {
      const bounds = new mapboxgl.LngLatBounds();
      for (const p of points) bounds.extend([p.lng, p.lat]);
      map.fitBounds(bounds, { padding: 48, maxZoom: 15 });

      map.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: points.map((p) => [p.lng, p.lat]),
          },
        },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: { "line-color": "#1e2a45", "line-width": 3 },
      });

      new mapboxgl.Marker({ color: "#2f7a4e" })
        .setLngLat([selected.startLng, selected.startLat])
        .setPopup(new mapboxgl.Popup().setText("Start"))
        .addTo(map);

      if (selected.endLng != null && selected.endLat != null) {
        new mapboxgl.Marker({ color: "#b23b3b" })
          .setLngLat([selected.endLng, selected.endLat])
          .setPopup(new mapboxgl.Popup().setText("End"))
          .addTo(map);
      }

      for (const ping of pings) {
        new mapboxgl.Marker({ color: "#c6a15b", scale: 0.6 })
          .setLngLat([ping.lng, ping.lat])
          .setPopup(new mapboxgl.Popup().setText(new Date(ping.recordedAt).toLocaleString()))
          .addTo(map);
      }
    });

    return () => {
      map.remove();
      mapObj.current = null;
    };
  }, [selected, pings, token]);

  if (!user) return null;
  if (!canRunPayroll(user.role)) {
    return <p className="text-sm text-danger">Admins only.</p>;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Clock breadcrumbs"
        description="Field clock-in paths with minute GPS pings."
        actions={
          <Link href="/admin">
            <Button type="button" variant="ghost" size="sm">
              Back to admin
            </Button>
          </Link>
        }
      />
      {!token ? (
        <p className="text-sm text-warning">
          Set NEXT_PUBLIC_MAPBOX_TOKEN in Vercel / .env.local to render the map.
        </p>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardBody className="space-y-3">
            <label className="block space-y-1 text-sm">
              <span className="text-ink/70">Filter by person</span>
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full rounded-md border border-ink/15 bg-white px-3 py-2"
              >
                <option value="">Everyone</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <ul className="max-h-[28rem] space-y-2 overflow-auto text-sm">
              {filtered.length === 0 ? <li className="text-ink/55">No sessions yet.</li> : null}
              {filtered.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left ${
                      selected?.id === s.id ? "border-brass bg-brass/10" : "border-ink/10"
                    }`}
                  >
                    <p className="font-medium text-ink">{new Date(s.startedAt).toLocaleString()}</p>
                    <p className="text-xs text-ink/55">{s.status}</p>
                  </button>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-3">
            <div ref={mapRef} className="h-[28rem] w-full overflow-hidden rounded-xl bg-ink/5" />
            {selected ? (
              <p className="text-sm text-ink/60">
                {pings.length} ping(s) · start {selected.startLat.toFixed(5)}, {selected.startLng.toFixed(5)}
                {selected.endLat != null
                  ? ` · end ${selected.endLat.toFixed(5)}, ${selected.endLng?.toFixed(5)}`
                  : ""}
              </p>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
