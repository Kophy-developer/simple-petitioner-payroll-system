import * as XLSX from "xlsx";

export type RosterImportRow = {
  firstName: string;
  lastName: string;
  initials: string;
  role?: string;
};

function cell(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

export function parseRosterWorkbook(buffer: ArrayBuffer): RosterImportRow[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  return rows
    .map((row) => ({
      firstName: cell(row, ["First Name", "first_name", "FirstName", "firstName", "First"]),
      lastName: cell(row, ["Last Name", "last_name", "LastName", "lastName", "Last"]),
      initials: cell(row, ["Initials", "initials", "Initial"]).toUpperCase(),
      role: cell(row, ["Role", "role"]) || undefined,
    }))
    .filter((row) => row.firstName || row.lastName || row.initials);
}

export type CredentialExportRow = {
  employeeId: string;
  firstName: string;
  lastName: string;
  initials: string;
  role: string;
  tempPassword: string;
};

export function downloadCredentialsWorkbook(rows: CredentialExportRow[], filename: string) {
  const sheet = XLSX.utils.json_to_sheet(
    rows.map((row) => ({
      "Employee ID": row.employeeId,
      "First Name": row.firstName,
      "Last Name": row.lastName,
      Initials: row.initials,
      Role: row.role,
      "Temp Password": row.tempPassword,
      "Login note": "Sign in with Employee ID + Temp Password, then set a new password.",
    })),
  );
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Credentials");
  XLSX.writeFile(wb, filename);
}
