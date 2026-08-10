import type { UserRole } from "@/lib/types";

export const PHASE2_MFA_SERVER_ENABLED = false;

export type MfaPurpose = "login" | "brex_payment";

export type MfaEnrollmentState = {
  requiredForRoles: UserRole[];
  purposes: MfaPurpose[];
  authenticatorOnly: true;
  smsDisabled: true;
  provider: "supabase_totp";
  serverEnforcement: typeof PHASE2_MFA_SERVER_ENABLED;
};

export const mfaDesign: MfaEnrollmentState = {
  requiredForRoles: ["super_admin", "account_admin"],
  purposes: ["login", "brex_payment"],
  authenticatorOnly: true,
  smsDisabled: true,
  provider: "supabase_totp",
  serverEnforcement: PHASE2_MFA_SERVER_ENABLED,
};

export function roleRequiresMfa(role: UserRole) {
  return mfaDesign.requiredForRoles.includes(role);
}

export const supabaseMfaClientSteps = [
  "supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName })",
  "Show QR / secret from enroll response in authenticator app",
  "supabase.auth.mfa.challenge({ factorId }) then mfa.verify({ factorId, challengeId, code })",
  "On sensitive actions (Brex payout), require aal2 via mfa.getAuthenticatorAssuranceLevel",
] as const;

export function mfaStatusPayload() {
  return {
    ...mfaDesign,
    clientSteps: supabaseMfaClientSteps,
    status: PHASE2_MFA_SERVER_ENABLED ? "enabled" : "client_ready_server_deferred",
    note: "Supabase Authenticator TOTP (no third-party 2FA vendor). Enrollment UI can run against Auth MFA APIs; droplet AAL enforcement stays off until Phase 1 testing sign-off.",
  };
}
