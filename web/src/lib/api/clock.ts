import { createClient } from "@/lib/supabase/client";

export type ClockSession = {
  id: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
  startLat: number;
  startLng: number;
  endLat: number | null;
  endLng: number | null;
  status: "open" | "closed";
};

export type ClockPing = {
  id: string;
  sessionId: string;
  recordedAt: string;
  lat: number;
  lng: number;
  accuracy: number | null;
};

function mapSession(row: Record<string, unknown>): ClockSession {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    startedAt: String(row.started_at),
    endedAt: row.ended_at ? String(row.ended_at) : null,
    startLat: Number(row.start_lat),
    startLng: Number(row.start_lng),
    endLat: row.end_lat == null ? null : Number(row.end_lat),
    endLng: row.end_lng == null ? null : Number(row.end_lng),
    status: row.status === "closed" ? "closed" : "open",
  };
}

export async function getOpenClockSession() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("clock_sessions")
    .select("id, user_id, started_at, ended_at, start_lat, start_lng, end_lat, end_lng, status")
    .eq("user_id", user.id)
    .eq("status", "open")
    .maybeSingle();
  if (error) throw error;
  return data ? mapSession(data as Record<string, unknown>) : null;
}

export async function clockIn(lat: number, lng: number) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("clock_in", { p_lat: lat, p_lng: lng });
  if (error) throw error;
  return mapSession(data as Record<string, unknown>);
}

export async function clockOut(lat: number, lng: number) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("clock_out", { p_lat: lat, p_lng: lng });
  if (error) throw error;
  return mapSession(data as Record<string, unknown>);
}

export async function clockPing(lat: number, lng: number, accuracy?: number | null) {
  const supabase = createClient();
  const { error } = await supabase.rpc("clock_ping", {
    p_lat: lat,
    p_lng: lng,
    p_accuracy: accuracy ?? null,
  });
  if (error) throw error;
}

export async function listClockSessions(userId?: string) {
  const supabase = createClient();
  let query = supabase
    .from("clock_sessions")
    .select("id, user_id, started_at, ended_at, start_lat, start_lng, end_lat, end_lng, status")
    .order("started_at", { ascending: false })
    .limit(100);
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => mapSession(row as Record<string, unknown>));
}

export async function listClockPings(sessionId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("clock_location_pings")
    .select("id, session_id, recorded_at, lat, lng, accuracy")
    .eq("session_id", sessionId)
    .order("recorded_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(
    (row): ClockPing => ({
      id: String(row.id),
      sessionId: String(row.session_id),
      recordedAt: String(row.recorded_at),
      lat: Number(row.lat),
      lng: Number(row.lng),
      accuracy: row.accuracy == null ? null : Number(row.accuracy),
    }),
  );
}

export function readDevicePosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location is not available on this device."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    });
  });
}
