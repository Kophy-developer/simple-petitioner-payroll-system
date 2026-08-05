import type { UserRole } from "@/lib/types";

export const PHASE2_MFA_SERVER_ENABLED = false;

export type MfaPurpose = "login" | "brex_payment";

export type MfaEnrollmentState = {
  requiredForRoles: UserRole[];
  purposes: MfaPurpose[];
  authenticatorOnly: true;
  smsDisabled: true;
  serverEnforcement: typeof PHASE2_MFA_SERVER_ENABLED;
};

export const mfaDesign: MfaEnrollmentState = {
  requiredForRoles: ["super_admin", "account_admin"],
  purposes: ["login", "brex_payment"],
  authenticatorOnly: true,
  smsDisabled: true,
  serverEnforcement: PHASE2_MFA_SERVER_ENABLED,
};

export function roleRequiresMfa(role: UserRole) {
  return mfaDesign.requiredForRoles.includes(role);
}

export function mfaStatusPayload() {
  return {
    ...mfaDesign,
    status: PHASE2_MFA_SERVER_ENABLED ? "enabled" : "scaffolded_deferred",
    note: "Authenticator TOTP scaffolding only. Do not enable Supabase MFA AAL on the droplet until Phase 1 testing sign-off.",
  };
}
