import type { UserRole } from "@/lib/types";

export function isFieldWorkerRole(role: UserRole) {
  return role === "petitioner" || role === "canvasser";
}

export function fieldRolesEquivalentInPhase2(a: UserRole, b: UserRole) {
  if (a === b) return true;
  return isFieldWorkerRole(a) && isFieldWorkerRole(b);
}

export function rolesTeamLeadMayManage(): UserRole[] {
  return ["petitioner", "canvasser"];
}

export function canLeadRole(memberRole: UserRole) {
  return rolesTeamLeadMayManage().includes(memberRole);
}

export type ChatChannelKind =
  | "direct"
  | "team"
  | "management"
  | "announcement"
  | "group";

export type ChatAclDecision = {
  allowed: boolean;
  reason: string;
};

const adminPlus: UserRole[] = ["super_admin", "account_admin"];

export function canMessageRole(sender: UserRole, recipient: UserRole): ChatAclDecision {
  if (adminPlus.includes(sender)) {
    return { allowed: true, reason: "Admins may message any role." };
  }
  if (sender === "team_lead") {
    if (isFieldWorkerRole(recipient) || recipient === "team_lead" || adminPlus.includes(recipient)) {
      return { allowed: true, reason: "Team leads may message field workers, other leads, and admins." };
    }
    return { allowed: false, reason: "Team leads cannot message this role." };
  }
  if (isFieldWorkerRole(sender)) {
    if (recipient === "team_lead" || adminPlus.includes(recipient) || isFieldWorkerRole(recipient)) {
      return { allowed: true, reason: "Field workers may message leads, admins, and other field workers." };
    }
    return { allowed: false, reason: "Field workers cannot message this role." };
  }
  return { allowed: false, reason: "Messaging is not enabled for this role in Phase 2." };
}

export function canPostInChannel(role: UserRole, kind: ChatChannelKind): ChatAclDecision {
  if (kind === "announcement" || kind === "management") {
    if (adminPlus.includes(role)) {
      return { allowed: true, reason: "Only admins may post in announcement/management channels." };
    }
    return { allowed: false, reason: "Only admins may post here; members may react." };
  }
  if (kind === "team") {
    if (role === "team_lead" || adminPlus.includes(role) || isFieldWorkerRole(role)) {
      return { allowed: true, reason: "Team channel members may post." };
    }
    return { allowed: false, reason: "Not a team channel participant role." };
  }
  return canMessageRole(role, role);
}

export function canReactInChannel(role: UserRole, kind: ChatChannelKind): ChatAclDecision {
  if (kind === "announcement" || kind === "management") {
    if (adminPlus.includes(role) || role === "team_lead" || isFieldWorkerRole(role)) {
      return { allowed: true, reason: "Members may react to announcements." };
    }
  }
  return canPostInChannel(role, kind);
}

export const chatAclMatrixSummary = {
  adminPlus: "super_admin, account_admin → anyone; announcement/management post",
  teamLead: "team_lead → petitioners, canvassers, leads, admins; may lead either or both field roles",
  field: "petitioner and canvasser treated the same until Phase 3; message leads, admins, field peers",
  announcement: "admin post only; reactions allowed for team/field",
} as const;
