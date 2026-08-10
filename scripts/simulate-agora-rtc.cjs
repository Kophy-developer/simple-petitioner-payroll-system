#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { RtcTokenBuilder, RtcRole } = require(path.join(
  __dirname,
  "..",
  "web",
  "node_modules",
  "agora-token",
));

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const root = path.resolve(__dirname, "..");
const webEnv = loadEnv(path.join(root, "web", ".env.local"));
const appId = (webEnv.AGORA_APP_ID || webEnv.NEXT_PUBLIC_AGORA_APP_ID || "").trim();
const certificate = (webEnv.AGORA_APP_CERTIFICATE || "").trim();

if (!appId || !certificate) {
  console.error("FAIL: AGORA_APP_ID / AGORA_APP_CERTIFICATE missing in web/.env.local");
  process.exit(1);
}

const channelName = `bap-sim-${Date.now().toString(36)}`;
const expireSeconds = 600;
const expireAt = Math.floor(Date.now() / 1000) + expireSeconds;
const publisher = RtcTokenBuilder.buildTokenWithUid(
  appId,
  certificate,
  channelName,
  1001,
  RtcRole.PUBLISHER,
  expireSeconds,
  expireSeconds,
);
const subscriber = RtcTokenBuilder.buildTokenWithUid(
  appId,
  certificate,
  channelName,
  2002,
  RtcRole.SUBSCRIBER,
  expireSeconds,
  expireSeconds,
);

const ok =
  publisher.startsWith("007") &&
  subscriber.startsWith("007") &&
  publisher.length > 80 &&
  subscriber.length > 80 &&
  publisher !== subscriber;

const report = {
  ok,
  appIdPrefix: appId.slice(0, 8),
  channelName,
  expireAt,
  publisher: {
    uid: 1001,
    tokenPrefix: publisher.slice(0, 12),
    tokenLength: publisher.length,
  },
  subscriber: {
    uid: 2002,
    tokenPrefix: subscriber.slice(0, 12),
    tokenLength: subscriber.length,
  },
  note: ok
    ? "Agora App ID + certificate mint valid RTC tokens for voice/video."
    : "Token output did not look valid.",
};

console.log(JSON.stringify(report, null, 2));
process.exit(ok ? 0 : 2);
