import type { UserRole } from "./types";

export type NavItem = {
  href: string;
  label: string;
  roles: UserRole[];
  section?: string;
  matchPrefix?: boolean;
};

const allRoles: UserRole[] = [
  "super_admin",
  "account_admin",
  "team_lead",
  "petitioner",
  "canvasser",
  "validator",
];

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", roles: allRoles, section: "Overview" },
  { href: "/turn-ins", label: "Turn-ins", roles: ["super_admin", "account_admin", "team_lead", "validator"], section: "Collection", matchPrefix: true },
  { href: "/issues", label: "Issues & Petitions", roles: ["super_admin", "account_admin", "team_lead", "petitioner", "validator"], section: "Collection" },
  { href: "/submissions", label: "Submissions", roles: ["super_admin", "account_admin", "team_lead", "petitioner"], section: "Collection" },
  { href: "/collection", label: "Master Collection", roles: ["super_admin", "account_admin", "team_lead"], section: "Collection" },
  { href: "/validity", label: "Validity Records", roles: ["super_admin", "account_admin", "validator"], section: "Collection" },
  { href: "/directory", label: "Employee Directory", roles: ["super_admin", "account_admin"], section: "People" },
  { href: "/ledger", label: "Ledger", roles: ["super_admin", "account_admin", "team_lead", "petitioner"], section: "Payroll", matchPrefix: true },
  { href: "/payroll", label: "Payroll & Expenses", roles: ["super_admin", "account_admin", "team_lead", "petitioner", "canvasser"], section: "Payroll", matchPrefix: true },
  { href: "/loans", label: "Loans & Advances", roles: ["super_admin", "team_lead", "petitioner", "canvasser"], section: "Payroll", matchPrefix: true },
  { href: "/admin", label: "Admin Panel", roles: ["super_admin", "account_admin"], section: "Configuration", matchPrefix: true },
];

const deepLinkAccess: { href: string; roles: UserRole[]; matchPrefix?: boolean }[] = [
  { href: "/lotus-ledger", roles: ["super_admin", "account_admin"] },
  {
    href: "/payments",
    roles: ["super_admin", "team_lead", "petitioner", "canvasser"],
    matchPrefix: true,
  },
  { href: "/pay-rates", roles: ["super_admin"] },
  { href: "/expense-config", roles: ["super_admin", "account_admin"] },
  { href: "/field-ops", roles: ["super_admin", "account_admin"] },
];

export function getNavForRole(role: UserRole) {
  return navItems.filter((item) => item.roles.includes(role));
}

export function roleLabel(role: UserRole) {
  const labels: Record<UserRole, string> = {
    super_admin: "Super Admin",
    account_admin: "Account Admin",
    team_lead: "Team Lead",
    petitioner: "Petitioner",
    canvasser: "Canvasser",
    validator: "Validator",
  };
  return labels[role];
}

function matchesRoute(
  pathname: string,
  href: string,
  matchPrefix?: boolean,
) {
  if (matchPrefix) return pathname === href || pathname.startsWith(`${href}/`);
  return pathname === href;
}

export function canAccess(role: UserRole, pathname: string) {
  if (pathname === "/profile" || pathname.startsWith("/profile/")) {
    return true;
  }
  if (pathname.startsWith("/onboarding")) {
    return true;
  }
  if (pathname === "/reports" || pathname.startsWith("/reports")) {
    return role === "super_admin" || role === "account_admin" || role === "team_lead";
  }
  const deep = deepLinkAccess.find((n) => matchesRoute(pathname, n.href, n.matchPrefix));
  if (deep) return deep.roles.includes(role);
  const item = navItems.find((n) => matchesRoute(pathname, n.href, n.matchPrefix));
  if (item) return item.roles.includes(role);
  const parent = navItems.find((n) => pathname.startsWith(`${n.href}/`));
  return parent ? parent.roles.includes(role) : false;
}

export function isNavActive(pathname: string, href: string, matchPrefix?: boolean) {
  if (matchPrefix) return pathname === href || pathname.startsWith(`${href}/`);
  return pathname === href;
}

export function canAccessLotusLedger(role: UserRole) {
  return role === "super_admin" || role === "account_admin";
}

export function canAccessPayments(role: UserRole) {
  return (
    role === "super_admin" ||
    role === "team_lead" ||
    role === "petitioner" ||
    role === "canvasser"
  );
}

export function canAccessPayRates(role: UserRole) {
  return role === "super_admin";
}

export function canAccessExpenseConfig(role: UserRole) {
  return role === "super_admin" || role === "account_admin";
}

export function canAccessFieldOps(role: UserRole) {
  return role === "super_admin" || role === "account_admin";
}
