import * as XLSX from "xlsx";

export type TurnInReportColumn = {
  code: string;
  pay: number;
  legalName: string | null;
  sigsIndex: number;
  booksIndex: number;
};

export type TurnInReportEntry = {
  firstName: string;
  lastName: string;
  initials: string;
  code: string;
  sigs: number;
  books: number;
};

export type TurnInReportIssue = {
  sheetName: string;
  turnInNumber: string;
  columns: TurnInReportColumn[];
  entries: TurnInReportEntry[];
};

export type TurnInReportParseResult = {
  state: string;
  codeNames: Record<string, string>;
  issues: TurnInReportIssue[];
};

function n(value: unknown) {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function cellStr(value: unknown) {
  if (value == null) return "";
  return String(value).trim();
}

export function extractPayFromCode(code: string) {
  const match = code.match(/\$\s*(\d+(?:\.\d+)?)/);
  if (!match) return 0;
  return Number(match[1]) || 0;
}

export function normalizeTurnInNumber(raw: string, sheetName: string) {
  const fromCell = raw.trim().toUpperCase().replace(/^BAP-/, "");
  if (fromCell) return fromCell;
  const sheet = sheetName.trim().toUpperCase().replace(/^BAP-/, "");
  if (/^[A-Z]{2}-\d{2}-\d{2}$/i.test(sheet)) return sheet;
  if (/^[A-Z]{2}-\d+$/i.test(sheet)) return sheet;
  return sheet;
}

function parseSettings(sheet: XLSX.WorkSheet | undefined) {
  const codeNames: Record<string, string> = {};
  if (!sheet) return codeNames;
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const code = cellStr(row[0]);
    const name = cellStr(row[1]);
    if (code) codeNames[code.toUpperCase()] = name || code;
  }
  return codeNames;
}

function parseColumnHeaders(
  labelRow: unknown[],
  codeNames: Record<string, string>,
): TurnInReportColumn[] {
  const columns: TurnInReportColumn[] = [];
  for (let i = 3; i < labelRow.length; i += 2) {
    const raw = cellStr(labelRow[i]);
    if (!raw) continue;
    const code = raw.replace(/\s+/g, " ").trim();
    const upper = code.toUpperCase();
    columns.push({
      code,
      pay: extractPayFromCode(code),
      legalName: codeNames[upper] ?? codeNames[upper.replace(/\s*\$\s*\d+(?:\.\d+)?$/, "").trim()] ?? null,
      sigsIndex: i,
      booksIndex: i + 1,
    });
  }
  return columns;
}

function parseIssueSheet(
  sheetName: string,
  sheet: XLSX.WorkSheet,
  codeNames: Record<string, string>,
): TurnInReportIssue | null {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  if (rows.length < 4) return null;

  const title = cellStr(rows[0]?.[0]);
  const turnInNumber = normalizeTurnInNumber(title, sheetName);
  if (!turnInNumber) return null;

  const columns = parseColumnHeaders(rows[1] ?? [], codeNames);
  if (!columns.length) return null;

  const header = (rows[2] ?? []).map((c) => cellStr(c).toLowerCase());
  if (!header[0]?.includes("first") || !header[2]?.includes("initial")) {
    return null;
  }

  const entries: TurnInReportEntry[] = [];
  for (let r = 3; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const firstName = cellStr(row[0]);
    const lastName = cellStr(row[1]);
    const initials = cellStr(row[2]).toUpperCase();
    if (!firstName && !lastName && !initials) continue;
    if (!initials && !firstName) continue;

    for (const col of columns) {
      const sigs = n(row[col.sigsIndex]);
      const books = n(row[col.booksIndex]);
      if (sigs === 0 && books === 0) continue;
      entries.push({
        firstName,
        lastName,
        initials: initials || `${firstName.slice(0, 1)}${lastName.slice(0, 1)}`.toUpperCase(),
        code: col.code,
        sigs,
        books,
      });
    }
  }

  return { sheetName, turnInNumber, columns, entries };
}

export function parseTurnInReportWorkbook(buffer: ArrayBuffer | Buffer): TurnInReportParseResult {
  const wb = XLSX.read(buffer, { type: "array" });
  const codeNames = parseSettings(wb.Sheets.Settings ?? wb.Sheets.settings);
  const issues: TurnInReportIssue[] = [];

  for (const sheetName of wb.SheetNames) {
    if (/^settings$/i.test(sheetName)) continue;
    const parsed = parseIssueSheet(sheetName, wb.Sheets[sheetName], codeNames);
    if (parsed) issues.push(parsed);
  }

  if (!issues.length) {
    throw new Error("No turn-in issue sheets found. Expected sheets like CO-01 with ROAD / TAX / GAS columns.");
  }

  const stateMatch = issues[0]?.turnInNumber.match(/^([A-Z]{2})-/i);
  return {
    state: stateMatch?.[1]?.toUpperCase() ?? "CO",
    codeNames,
    issues,
  };
}

export function summarizeTurnInReport(parsed: TurnInReportParseResult) {
  const codes = new Set<string>();
  let entryCount = 0;
  const people = new Set<string>();
  for (const issue of parsed.issues) {
    for (const col of issue.columns) codes.add(col.code);
    entryCount += issue.entries.length;
    for (const e of issue.entries) {
      people.add(`${e.initials}|${e.firstName}|${e.lastName}`.toLowerCase());
    }
  }
  return {
    issueCount: parsed.issues.length,
    columnCodes: [...codes].sort(),
    entryCount,
    personCount: people.size,
  };
}
