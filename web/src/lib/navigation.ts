import type { UserRole } from "./types";

export type NavItem = {
  href: string;
  label: string;
  roles: UserRole[];
  section?: string;
  matchPrefix?: boolean;
};

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", roles: ["super_admin", "account_admin", "team_lead", "petitioner", "canvasser", "validator"], section: "Overview" },
  { href: "/issues", label: "Issues & Petitions", roles: ["super_admin", "account_admin", "team_lead", "petitioner", "validator"], section: "Collection" },
  { href: "/submissions", label: "Submissions", roles: ["super_admin", "account_admin", "team_lead", "petitioner"], section: "Collection" },
  { href: "/collection", label: "Master Collection", roles: ["super_admin", "account_admin", "team_lead"], section: "Collection" },
  { href: "/turnins", label: "Turn-in Uploads", roles: ["super_admin", "account_admin", "petitioner"], section: "Collection", matchPrefix: true },
  { href: "/validity", label: "Validity Records", roles: ["super_admin", "account_admin", "validator"], section: "Collection", matchPrefix: true },
  { href: "/directory", label: "Employee Directory", roles: ["super_admin", "account_admin"], section: "People" },
  { href: "/ledger", label: "Ledger", roles: ["super_admin", "account_admin", "team_lead", "petitioner"], section: "Payroll", matchPrefix: true },
  { href: "/payroll", label: "Payroll & Expenses", roles: ["super_admin", "account_admin", "team_lead", "petitioner", "canvasser"], section: "Payroll", matchPrefix: true },
  { href: "/loans", label: "Loan / Advance", roles: ["super_admin", "petitioner"], section: "Payroll" },
  { href: "/clock", label: "Clock In / Out", roles: ["account_admin", "team_lead", "petitioner", "canvasser"], section: "Field" },
  { href: "/gps", label: "GPS Map", roles: ["super_admin", "account_admin", "team_lead"], section: "Field" },
  { href: "/canvassing", label: "Canvassing Import", roles: ["super_admin", "account_admin", "team_lead", "canvasser"], section: "Field", matchPrefix: true },
  { href: "/messages", label: "Messaging", roles: ["super_admin", "account_admin", "team_lead", "petitioner", "canvasser", "validator"], section: "Communications", matchPrefix: true },
  { href: "/expense-config", label: "Car & Housing", roles: ["super_admin", "account_admin"], section: "Configuration" },
  { href: "/payroll/monthly", label: "Monthly Payroll", roles: ["super_admin", "account_admin"], section: "Configuration" },
  { href: "/pay-table", label: "Petition Pay Table", roles: ["super_admin"], section: "Configuration" },
  { href: "/pay-rates", label: "Pay Rates", roles: ["super_admin"], section: "Configuration" },
  { href: "/role-categories", label: "Role Categories", roles: ["super_admin"], section: "Configuration", matchPrefix: true },
  { href: "/admin", label: "Admin Panel", roles: ["super_admin", "account_admin"], section: "Configuration", matchPrefix: true },
  { href: "/profile", label: "Profile", roles: ["super_admin", "account_admin", "team_lead", "petitioner", "canvasser", "validator"], section: "Account" },
];

const publicRoutes = ["/profile"];

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

export function canAccess(role: UserRole, pathname: string) {
  if (publicRoutes.some((r) => pathname === r || pathname.startsWith(`${r}/`))) {
    return navItems.some((item) => item.roles.includes(role) && item.href === "/profile");
  }
  const item = navItems.find((n) =>
    n.matchPrefix ? pathname === n.href || pathname.startsWith(`${n.href}/`) : pathname === n.href,
  );
  if (item) return item.roles.includes(role);
  const parent = navItems.find((n) => pathname.startsWith(`${n.href}/`));
  return parent ? parent.roles.includes(role) : false;
}

export function isNavActive(pathname: string, href: string, matchPrefix?: boolean) {
  if (matchPrefix) return pathname === href || pathname.startsWith(`${href}/`);
  return pathname === href;
}
