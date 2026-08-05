import type { UserRole } from "./types";

export function canViewAllLedgers(role: UserRole) {
  return role === "super_admin" || role === "account_admin";
}

export function canViewTeamData(role: UserRole) {
  return role === "team_lead";
}

export function canEditFinancialConfig(role: UserRole) {
  return role === "super_admin" || role === "account_admin";
}

export function canApproveLoans(role: UserRole) {
  return role === "super_admin";
}

export function isFieldWorkerRole(role: UserRole) {
  return role === "petitioner" || role === "canvasser";
}

export function isFieldRole(role: UserRole) {
  return isFieldWorkerRole(role) || role === "team_lead";
}

export function canRunPayroll(role: UserRole) {
  return role === "super_admin" || role === "account_admin";
}

export function canRequestLoan(role: UserRole) {
  return isFieldRole(role);
}

export function canUploadValidity(role: UserRole) {
  return role === "super_admin" || role === "account_admin";
}

export function canEditSubmissions(role: UserRole) {
  return role === "super_admin" || role === "account_admin";
}

export function canManageUsers(role: UserRole) {
  return role === "super_admin" || role === "account_admin";
}

export function canAccessPhase2Console(role: UserRole) {
  return role === "super_admin" || role === "account_admin";
}

export function visibleUserIds(
  viewer: { authId?: string; id: string; role: UserRole; teamMemberIds?: string[] },
  allUserIds: string[],
) {
  const selfId = viewer.authId ?? viewer.id;
  if (canViewAllLedgers(viewer.role)) return allUserIds;
  if (canViewTeamData(viewer.role)) {
    return [selfId, ...(viewer.teamMemberIds ?? [])];
  }
  return [selfId];
}

export function userDisplayName(user: { firstName: string; lastName: string }) {
  return `${user.firstName} ${user.lastName}`;
}
