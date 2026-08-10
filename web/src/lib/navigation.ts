import type { UserRole } from "./types";

export type NavItem = {
  href: string;
  label: string;
  roles: UserRole[];
  section?: string;
  matchPrefix?: boolean;
};

const fieldAndUp: UserRole[] = [
  "super_admin",
  "account_admin",
  "team_lead",
  "petitioner",
  "canvasser",
];

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", roles: fieldAndUp, section: "Overview" },
  { href: "/turn-ins", label: "Turn-ins", roles: fieldAndUp, section: "Collection", matchPrefix: true },
  { href: "/issues", label: "Issues & Petitions", roles: fieldAndUp, section: "Collection" },
  { href: "/submissions", label: "Submissions", roles: fieldAndUp, section: "Collection" },
  { href: "/collection", label: "Master Collection", roles: ["super_admin", "account_admin", "team_lead"], section: "Collection" },
  { href: "/validity", label: "Validity Records", roles: ["super_admin", "account_admin"], section: "Collection" },
  { href: "/imports", label: "Imports", roles: ["super_admin", "account_admin"], section: "Collection", matchPrefix: true },
  { href: "/directory", label: "Employee Directory", roles: ["super_admin", "account_admin"], section: "People" },
  { href: "/ledger", label: "Ledger", roles: fieldAndUp, section: "Payroll", matchPrefix: true },
  { href: "/payroll", label: "Payroll & Expenses", roles: fieldAndUp, section: "Payroll", matchPrefix: true },
  { href: "/brex", label: "Brex", roles: fieldAndUp, section: "Payroll", matchPrefix: true },
  { href: "/loans", label: "Loans & Advances", roles: fieldAndUp, section: "Payroll", matchPrefix: true },
  { href: "/admin", label: "Admin Panel", roles: ["super_admin", "account_admin"], section: "Configuration", matchPrefix: true },
];

const deepLinkAccess: { href: string; roles: UserRole[]; matchPrefix?: boolean }[] = [
  {
    href: "/payments",
    roles: fieldAndUp,
    matchPrefix: true,
  },
  { href: "/pay-rates", roles: ["super_admin", "account_admin"] },
  { href: "/field-ops", roles: ["super_admin", "account_admin"] },
  { href: "/payroll?tab=housing-cars", roles: ["super_admin", "account_admin"] },
  { href: "/colorado-import", roles: ["super_admin", "account_admin"] },
  { href: "/validity", roles: ["super_admin", "account_admin"] },
  { href: "/brex/contractor-payouts", roles: ["super_admin", "account_admin"] },
];

export function getNavForRole(role: UserRole) {
  return navItems.filter((item) => item.roles.includes(role));
}

export function roleLabel(role: UserRole) {
  const labels: Record<UserRole, string> = {
    super_admin: "Super Admin",
    account_admin: "Admin",
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
  if (pathname === "/messages" || pathname.startsWith("/messages/")) {
    return false;
  }
  if (pathname === "/phase2" || pathname.startsWith("/phase2/")) {
    return false;
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

export function canAccessLotusLedger(_role: UserRole) {
  return false;
}

export function canAccessPayments(role: UserRole) {
  return (
    role === "super_admin" ||
    role === "account_admin" ||
    role === "team_lead" ||
    role === "petitioner" ||
    role === "canvasser"
  );
}

export function canAccessPayRates(role: UserRole) {
  return role === "super_admin" || role === "account_admin";
}

export function canAccessExpenseConfig(_role: UserRole) {
  return false;
}

export function canAccessFieldOps(role: UserRole) {
  return role === "super_admin" || role === "account_admin";
}
