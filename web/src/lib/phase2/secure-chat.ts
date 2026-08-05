export const PHASE2_SECURE_CHAT_LIVE = false;

export const secureChatArchitecture = {
  live: PHASE2_SECURE_CHAT_LIVE,
  goals: [
    "End-to-end encryption for direct and group messages",
    "Persist ciphertext and metadata on Ballot Access Pros controlled infrastructure",
    "Group tagging (e.g. team leaders)",
    "Management chats and announcement channels",
    "Signal-style reactions",
    "Delivered and read receipts",
    "Polls",
    "Group audio and video calls",
  ],
  hosting: {
    preferred: "Dedicated chat service + media/TURN separate from Phase 1 Supabase money schema",
    reason: "Avoid Phase 1 payroll DB blast radius while Phase 1 testing continues",
  },
  clientSurfaces: ["/messages", "/messages/announcements"],
  aclModule: "@/lib/phase2/roles-and-chat-acl",
  deferredInfra: [
    "Chat API host",
    "E2E key exchange",
    "Object storage for attachments",
    "WebRTC / SFU for A/V",
    "Push notifications",
  ],
  note: "Architecture scaffolding only. No chat tables on the Phase 1 droplet until explicitly approved.",
} as const;

export function secureChatStatusPayload() {
  return {
    ...secureChatArchitecture,
    status: PHASE2_SECURE_CHAT_LIVE ? "live" : "scaffolded_deferred",
  };
}
