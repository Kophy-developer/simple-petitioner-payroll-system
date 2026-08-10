import type { UserRole } from "@/lib/types";

export const PHASE2_MFA_SERVER_ENABLED = false;
export const PHASE2_MFA_LOGIN_ENABLED = false;

export type MfaPurpose = "brex_payment";

export type MfaEnrollmentState = {
  requiredForRoles: UserRole[];
  purposes: MfaPurpose[];
  authenticatorOnly: true;
  smsDisabled: true;
  loginRequired: typeof PHASE2_MFA_LOGIN_ENABLED;
  provider: "supabase_totp";
  serverEnforcement: typeof PHASE2_MFA_SERVER_ENABLED;
};

export const mfaDesign: MfaEnrollmentState = {
  requiredForRoles: ["super_admin", "account_admin"],
  purposes: ["brex_payment"],
  authenticatorOnly: true,
  smsDisabled: true,
  loginRequired: PHASE2_MFA_LOGIN_ENABLED,
  provider: "supabase_totp",
  serverEnforcement: PHASE2_MFA_SERVER_ENABLED,
};

export function roleRequiresMfa(role: UserRole) {
  return mfaDesign.requiredForRoles.includes(role);
}

export function roleRequiresLoginMfa(_role: UserRole) {
  return false;
}

export function roleRequiresPayoutMfa(role: UserRole) {
  return roleRequiresMfa(role);
}

export const supabaseMfaClientSteps = [
  "Optional enroll on /brex/contractor-payouts for payout practice only",
  "supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName })",
  "supabase.auth.mfa.challenge + mfa.verify before live Brex ACH (when enabled)",
] as const;

export function mfaStatusPayload() {
  return {
    ...mfaDesign,
    clientSteps: supabaseMfaClientSteps,
    status: "payouts_only_deferred",
    note: "Login 2FA is off for testing. Authenticator step-up stays scoped to Brex contractor payouts only; droplet AAL enforcement is still off.",
  };
}
