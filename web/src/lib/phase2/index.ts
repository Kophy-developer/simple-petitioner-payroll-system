import { mfaStatusPayload } from "@/lib/phase2/mfa";
import { contractorPayoutStatusPayload } from "@/lib/phase2/brex-contractors";
import { secureChatStatusPayload } from "@/lib/phase2/secure-chat";
import { laterFeaturesStatusPayload } from "@/lib/phase2/later-features";
import { chatAclMatrixSummary } from "@/lib/phase2/roles-and-chat-acl";
import { mailEnvStatus } from "@/lib/email-templates";
import { agoraStatusPayload } from "@/lib/phase2/agora";

export function phase2StatusPayload() {
  return {
    branchTarget: "phase-2",
    serverSafety: {
      phase1Testing: true,
      dropletAllows: ["email_templates", "resend_smtp_config"],
      dropletBlocked: ["phase2_schema", "mfa_aal_enforcement", "brex_contractor_live", "chat_infra"],
    },
    email: mailEnvStatus(),
    mfa: mfaStatusPayload(),
    rolesAndChatAcl: chatAclMatrixSummary,
    brexContractors: contractorPayoutStatusPayload(),
    agora: agoraStatusPayload(),
    secureChat: secureChatStatusPayload(),
    laterFeatures: laterFeaturesStatusPayload(),
  };
}
