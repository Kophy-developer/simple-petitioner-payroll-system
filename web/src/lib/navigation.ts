import type { UserRole } from "./types";

export type NavItem = {
  href: string;
  label: string;
  roles: UserRole[];
  section?: string;
  matchPrefix?: boolean;
  nested?: boolean;
};

const fieldWorkersAndUp: UserRole[] = [
  "super_admin",
  "account_admin",
  "team_lead",
  "petitioner",
  "canvasser",
];

const moneyRoles: UserRole[] = [
  "super_admin",
  "account_admin",
  "petitioner",
  "canvasser",
];

const adminRoles: UserRole[] = ["super_admin", "account_admin"];

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", roles: fieldWorkersAndUp, section: "Overview" },
  { href: "/turn-ins", label: "Turn-ins", roles: fieldWorkersAndUp, section: "Collection", matchPrefix: true },
  { href: "/issues", label: "Issues & Petitions", roles: fieldWorkersAndUp, section: "Collection" },
  { href: "/submissions", label: "Submissions", roles: fieldWorkersAndUp, section: "Collection" },
  { href: "/collection", label: "Master Collection", roles: ["super_admin", "account_admin", "team_lead"], section: "Collection" },
  { href: "/validity", label: "Validity Records", roles: adminRoles, section: "Collection" },
  { href: "/imports", label: "Imports", roles: adminRoles, section: "Collection" },
  { href: "/directory", label: "Employee Directory", roles: adminRoles, section: "People" },
  { href: "/admin/teams", label: "Teams", roles: adminRoles, section: "People", nested: true },
  { href: "/ledger", label: "Ledger", roles: moneyRoles, section: "Payroll", matchPrefix: true },
  { href: "/payroll", label: "Payroll & Expenses", roles: moneyRoles, section: "Payroll", matchPrefix: true },
  { href: "/brex", label: "Brex", roles: moneyRoles, section: "Payroll", matchPrefix: true },
  { href: "/loans", label: "Loans & Advances", roles: moneyRoles, section: "Payroll", matchPrefix: true },
  { href: "/admin", label: "Admin Overview", roles: adminRoles, section: "Configuration" },
  { href: "/admin/pay-rates", label: "Pay Rates", roles: adminRoles, section: "Configuration", nested: true },
  { href: "/admin/field-ops", label: "Housing & Cars", roles: adminRoles, section: "Configuration", nested: true },
  { href: "/admin/clock", label: "Clock Breadcrumbs", roles: adminRoles, section: "Configuration", nested: true },
];

const deepLinkAccess: { href: string; roles: UserRole[]; matchPrefix?: boolean }[] = [
  {
    href: "/payments",
    roles: moneyRoles,
    matchPrefix: true,
  },
  { href: "/pay-rates", roles: adminRoles },
  { href: "/field-ops", roles: adminRoles },
  { href: "/admin/users", roles: adminRoles, matchPrefix: true },
  { href: "/admin/teams", roles: adminRoles },
  { href: "/admin/pay-rates", roles: adminRoles },
  { href: "/admin/field-ops", roles: adminRoles },
  { href: "/admin/clock", roles: adminRoles },
  { href: "/colorado-import", roles: adminRoles },
  { href: "/validity", roles: adminRoles },
  { href: "/brex/contractor-payouts", roles: adminRoles },
  { href: "/clock", roles: adminRoles, matchPrefix: true },
  { href: "/imports", roles: adminRoles, matchPrefix: true },
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
  if (
    role === "team_lead" &&
    (pathname === "/ledger" ||
      pathname.startsWith("/ledger/") ||
      pathname === "/payroll" ||
      pathname.startsWith("/payroll/") ||
      pathname === "/brex" ||
      pathname.startsWith("/brex/") ||
      pathname === "/loans" ||
      pathname.startsWith("/loans/") ||
      pathname === "/payments" ||
      pathname.startsWith("/payments/"))
  ) {
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
