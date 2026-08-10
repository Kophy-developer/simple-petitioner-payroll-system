import { RtcRole, RtcTokenBuilder } from "agora-token";

export type AgoraRtcRole = "publisher" | "subscriber";

export type AgoraTokenRequest = {
  channelName: string;
  uid?: number | string;
  role?: AgoraRtcRole;
  expireSeconds?: number;
};

export type AgoraTokenResult = {
  appId: string;
  channelName: string;
  uid: number | string;
  role: AgoraRtcRole;
  expireAt: number;
  token: string;
};

export function agoraEnvStatus() {
  const appId = (process.env.AGORA_APP_ID || process.env.NEXT_PUBLIC_AGORA_APP_ID || "").trim();
  const certificate = (process.env.AGORA_APP_CERTIFICATE || "").trim();
  return {
    configured: Boolean(appId && certificate),
    appIdPresent: Boolean(appId),
    certificatePresent: Boolean(certificate),
    publicAppIdPresent: Boolean((process.env.NEXT_PUBLIC_AGORA_APP_ID || "").trim()),
  };
}

export function buildAgoraRtcToken(input: AgoraTokenRequest): AgoraTokenResult {
  const appId = (process.env.AGORA_APP_ID || process.env.NEXT_PUBLIC_AGORA_APP_ID || "").trim();
  const certificate = (process.env.AGORA_APP_CERTIFICATE || "").trim();
  if (!appId || !certificate) {
    throw new Error("Agora is not configured. Set AGORA_APP_ID and AGORA_APP_CERTIFICATE.");
  }

  const channelName = input.channelName.trim();
  if (!channelName) {
    throw new Error("channelName is required");
  }

  const role: AgoraRtcRole = input.role === "subscriber" ? "subscriber" : "publisher";
  const expireSeconds = Math.min(Math.max(input.expireSeconds ?? 3600, 60), 86400);
  const expireAt = Math.floor(Date.now() / 1000) + expireSeconds;
  const uid = input.uid ?? 0;
  const rtcRole = role === "subscriber" ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;

  const token =
    typeof uid === "string"
      ? RtcTokenBuilder.buildTokenWithUserAccount(
          appId,
          certificate,
          channelName,
          uid,
          rtcRole,
          expireSeconds,
          expireSeconds,
        )
      : RtcTokenBuilder.buildTokenWithUid(
          appId,
          certificate,
          channelName,
          uid,
          rtcRole,
          expireSeconds,
          expireSeconds,
        );

  return {
    appId,
    channelName,
    uid,
    role,
    expireAt,
    token,
  };
}

export function agoraStatusPayload() {
  const env = agoraEnvStatus();
  return {
    provider: "agora",
    ...env,
    status: env.configured ? "credentials_ready" : "missing_credentials",
    note: env.configured
      ? "Agora App ID + certificate are present. RTC tokens can be minted for voice/video calls."
      : "Set AGORA_APP_ID, AGORA_APP_CERTIFICATE, and NEXT_PUBLIC_AGORA_APP_ID.",
  };
}
