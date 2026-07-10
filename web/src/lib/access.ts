import type { DemoUser, UserRole } from "./types";

export function canViewAllLedgers(role: UserRole) {
  return role === "super_admin" || role === "account_admin";
}

export function canViewTeamData(role: UserRole) {
  return role === "team_lead";
}

export function canEditFinancialConfig(role: UserRole) {
  return role === "super_admin";
}

export function canApproveLoans(role: UserRole) {
  return role === "super_admin";
}

export function canRequestLoan(role: UserRole) {
  return role === "petitioner" || role === "canvasser";
}

export function canUploadValidity(role: UserRole) {
  return role === "validator" || role === "super_admin" || role === "account_admin";
}

export function canEditSubmissions(role: UserRole) {
  return role === "super_admin" || role === "account_admin";
}

export function canManageUsers(role: UserRole) {
  return role === "super_admin";
}

export function visibleUserIds(viewer: DemoUser, allUserIds: string[]) {
  if (canViewAllLedgers(viewer.role)) return allUserIds;
  if (canViewTeamData(viewer.role)) {
    return [viewer.id, ...(viewer.teamMemberIds ?? [])];
  }
  return [viewer.id];
}

export function userDisplayName(user: Pick<DemoUser, "firstName" | "lastName">) {
  return `${user.firstName} ${user.lastName}`;
}
