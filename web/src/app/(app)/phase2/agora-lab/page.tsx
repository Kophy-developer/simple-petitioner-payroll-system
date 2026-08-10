"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AgoraRTC, {
  type IAgoraRTCClient,
  type ICameraVideoTrack,
  type IMicrophoneAudioTrack,
} from "agora-rtc-sdk-ng";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type TokenPayload = {
  appId: string;
  channelName: string;
  uid: number | string;
  token: string;
  error?: string;
};

export default function AgoraLabPage() {
  const [channel, setChannel] = useState("bap-phase2-sim");
  const [log, setLog] = useState<string[]>([]);
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const micRef = useRef<IMicrophoneAudioTrack | null>(null);
  const camRef = useRef<ICameraVideoTrack | null>(null);
  const localVideoRef = useRef<HTMLDivElement | null>(null);
  const remoteVideoRef = useRef<HTMLDivElement | null>(null);

  const push = useCallback((line: string) => {
    setLog((prev) => [...prev.slice(-40), line]);
  }, []);

  async function leaveChannel() {
    try {
      micRef.current?.close();
      camRef.current?.close();
      micRef.current = null;
      camRef.current = null;
      if (clientRef.current) {
        await clientRef.current.leave();
        clientRef.current.removeAllListeners();
        clientRef.current = null;
      }
    } catch {
    }
    setJoined(false);
  }

  useEffect(() => {
    return () => {
      micRef.current?.close();
      camRef.current?.close();
      const client = clientRef.current;
      clientRef.current = null;
      if (client) {
        void client.leave().then(() => client.removeAllListeners());
      }
    };
  }, []);

  async function joinChannel(withVideo: boolean, publishMedia: boolean) {
    setBusy(true);
    try {
      await leaveChannel();
      const uid = Math.floor(1000 + Math.random() * 9000);
      const res = await fetch(
        `/api/phase2/agora/token?channel=${encodeURIComponent(channel)}&uid=${uid}&role=publisher`,
      );
      const payload = (await res.json()) as TokenPayload;
      if (!res.ok) throw new Error(payload.error || "Token request failed");

      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;
      client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        push(`Remote published ${mediaType} uid=${user.uid}`);
        if (mediaType === "video" && user.videoTrack && remoteVideoRef.current) {
          user.videoTrack.play(remoteVideoRef.current);
        }
        if (mediaType === "audio" && user.audioTrack) {
          user.audioTrack.play();
        }
      });

      await client.join(payload.appId, payload.channelName, payload.token, uid);
      push(`Joined channel ${payload.channelName} as uid ${uid} state=${client.connectionState}`);

      if (publishMedia) {
        const mic = await AgoraRTC.createMicrophoneAudioTrack();
        micRef.current = mic;
        if (withVideo) {
          const cam = await AgoraRTC.createCameraVideoTrack();
          camRef.current = cam;
          if (localVideoRef.current) cam.play(localVideoRef.current);
          await client.publish([mic, cam]);
          push("Published microphone + camera");
        } else {
          await client.publish([mic]);
          push("Published microphone (voice-only)");
        }
      } else {
        push("Joined without publishing local media (connectivity check)");
      }
      setJoined(true);
    } catch (e) {
      push(e instanceof Error ? e.message : "Join failed");
      await leaveChannel();
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("auto") === "1") {
      void joinChannel(false, false);
    }
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Phase 2"
        title="Agora voice & video lab"
        description="Mints an RTC token with your App Certificate, then joins a live Agora channel from this browser."
      />
      <Card>
        <CardBody className="space-y-4">
          <label className="block space-y-1 text-sm">
            <span className="text-ink/70">Channel</span>
            <input
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="w-full rounded border border-ink/15 bg-white px-3 py-2"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <Button type="button" disabled={busy} onClick={() => void joinChannel(false, false)}>
              Join (no media)
            </Button>
            <Button type="button" disabled={busy} onClick={() => void joinChannel(false, true)}>
              Join voice
            </Button>
            <Button type="button" disabled={busy} onClick={() => void joinChannel(true, true)}>
              Join voice + video
            </Button>
            <Button type="button" disabled={busy || !joined} onClick={() => void leaveChannel()}>
              Leave
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm text-ink/60">Local</p>
              <div ref={localVideoRef} className="aspect-video rounded bg-ink/90" />
            </div>
            <div>
              <p className="mb-2 text-sm text-ink/60">Remote</p>
              <div ref={remoteVideoRef} className="aspect-video rounded bg-ink/90" />
            </div>
          </div>
          <pre className="max-h-56 overflow-auto rounded bg-ink/[0.04] p-3 text-xs text-ink/70">
            {log.join("\n") || "Ready."}
          </pre>
        </CardBody>
      </Card>
    </div>
  );
}
