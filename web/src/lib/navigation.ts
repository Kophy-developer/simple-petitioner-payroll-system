import type { UserRole } from "./types";

export type NavItem = {
  href: string;
  label: string;
  roles: UserRole[];
  section?: string;
};

export const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    roles: ["circulator", "admin", "super_admin"],
    section: "Overview",
  },
  {
    href: "/submissions",
    label: "Submission",
    roles: ["circulator", "admin", "super_admin"],
    section: "Collection",
  },
  {
    href: "/collection",
    label: "Master Collection",
    roles: ["admin", "super_admin"],
    section: "Collection",
  },
  {
    href: "/reports",
    label: "Issue Report",
    roles: ["admin", "super_admin"],
    section: "Collection",
  },
  {
    href: "/validity",
    label: "Validity Upload",
    roles: ["admin", "super_admin"],
    section: "Collection",
  },
  {
    href: "/directory",
    label: "Employee Directory",
    roles: ["admin", "super_admin"],
    section: "People",
  },
  {
    href: "/ledger",
    label: "Ledger",
    roles: ["circulator", "admin", "super_admin"],
    section: "Payroll",
  },
  {
    href: "/payroll",
    label: "Payroll & Expenses",
    roles: ["circulator", "admin", "super_admin"],
    section: "Payroll",
  },
  {
    href: "/loans",
    label: "Loan / Advance",
    roles: ["circulator", "admin", "super_admin"],
    section: "Payroll",
  },
  {
    href: "/pay-table",
    label: "Petition Pay Table",
    roles: ["super_admin"],
    section: "Configuration",
  },
  {
    href: "/pay-rates",
    label: "Pay Rates",
    roles: ["super_admin"],
    section: "Configuration",
  },
];

export function getNavForRole(role: UserRole) {
  return navItems.filter((item) => item.roles.includes(role));
}

export function roleLabel(role: UserRole) {
  if (role === "super_admin") return "Super Admin";
  if (role === "admin") return "Admin";
  return "Circulator";
}

export function canAccess(role: UserRole, href: string) {
  const item = navItems.find((n) => n.href === href);
  return item ? item.roles.includes(role) : false;
}
