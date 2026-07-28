import * as XLSX from "xlsx";
import type { UserRole } from "./types";

export type RosterImportRow = {
  firstName: string;
  lastName: string;
  email: string;
  role?: string;
  phone?: string;
  initials?: string;
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[_\s]+/g, " ");
}

function cell(row: Record<string, unknown>, keys: string[]) {
  const wanted = keys.map(normalizeHeader);
  for (const [rawKey, value] of Object.entries(row)) {
    if (!wanted.includes(normalizeHeader(rawKey))) continue;
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

export function deriveInitials(firstName: string, lastName: string) {
  const a = firstName.trim().charAt(0);
  const b = lastName.trim().charAt(0);
  return `${a}${b}`.toUpperCase() || "XX";
}

export function parseRosterWorkbook(buffer: ArrayBuffer): RosterImportRow[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  return rows
    .map((row) => {
      const firstName = cell(row, ["First Name", "first_name", "FirstName", "firstName", "First", "Given Name"]);
      const lastName = cell(row, ["Last Name", "last_name", "LastName", "lastName", "Last", "Surname", "Family Name"]);
      const email = cell(row, ["Email", "email", "E-mail", "Email Address"]).toLowerCase();
      const phone = cell(row, ["Phone", "phone", "Mobile", "Cell"]) || undefined;
      const role = cell(row, ["Role", "role"]) || undefined;
      const initialsRaw = cell(row, ["Initials", "initials", "Initial", "Init"]);
      return {
        firstName,
        lastName,
        email,
        phone,
        role,
        initials: initialsRaw ? initialsRaw.toUpperCase() : deriveInitials(firstName, lastName),
      };
    })
    .filter((row) => row.firstName && row.lastName && row.email);
}

export type CredentialExportRow = {
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  phone?: string;
  tempPassword: string;
};

export function downloadRosterTemplate(filename = "bap-employee-template.xlsx") {
  const sheet = XLSX.utils.json_to_sheet(
    [
      {
        First: "Jane",
        Last: "Doe",
        Email: "jane.doe@example.com",
        Role: "petitioner",
        Phone: "",
      },
    ],
    { header: ["First", "Last", "Email", "Role", "Phone"] },
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Employees");
  XLSX.writeFile(wb, filename);
}

export function downloadCredentialsWorkbook(rows: CredentialExportRow[], filename: string) {
  const sheet = XLSX.utils.json_to_sheet(
    rows.map((row) => ({
      "Employee ID": row.employeeId,
      First: row.firstName,
      Last: row.lastName,
      Email: row.email,
      Role: row.role,
      Phone: row.phone ?? "",
      "Temp Password": row.tempPassword,
      "Login note": "Sign in with Employee ID + Temp Password, then set a new password.",
    })),
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Credentials");
  XLSX.writeFile(wb, filename);
}

const DIRECTORY_PRIORITY: Record<string, number> = {
  "charles eden": 0,
  "kabir wolf": 1,
  "tristan miller": 2,
};

export function sortDirectoryUsers<T extends { firstName: string; lastName: string }>(users: T[]) {
  return [...users].sort((a, b) => {
    const keyA = `${a.firstName} ${a.lastName}`.trim().toLowerCase();
    const keyB = `${b.firstName} ${b.lastName}`.trim().toLowerCase();
    const priA = DIRECTORY_PRIORITY[keyA] ?? 100;
    const priB = DIRECTORY_PRIORITY[keyB] ?? 100;
    if (priA !== priB) return priA - priB;
    return keyA.localeCompare(keyB);
  });
}

export function normalizeRoleLabel(role: string): UserRole | undefined {
  const raw = role.trim().toLowerCase().replace(/\s+/g, "_");
  const aliases: Record<string, UserRole> = {
    super_admin: "super_admin",
    "super admin": "super_admin",
    account_admin: "account_admin",
    admin: "account_admin",
    "account admin": "account_admin",
    team_lead: "team_lead",
    "team lead": "team_lead",
    petitioner: "petitioner",
    canvasser: "canvasser",
    validator: "validator",
  };
  return aliases[raw] ?? aliases[role.trim().toLowerCase()];
}

export { rentalCarGuideTotal } from "./rental-car-math";
