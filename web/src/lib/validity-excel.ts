import * as XLSX from "xlsx";

export type ValidityPreviewRow = {
  rowNumber: number;
  initials: string;
  email: string;
  userId: string | null;
  name: string;
  dups: number;
  usable: number;
  valid: number;
  validityPct: number;
  status: "matched" | "unmatched" | "invalid";
  error?: string;
};

type ProfileMatch = {
  id: string;
  initials: string;
  email: string;
  firstName: string;
  lastName: string;
};

function normHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[%#]/g, "")
    .replace(/\s+/g, " ");
}

function pickCol(headers: string[], aliases: string[]) {
  for (const alias of aliases) {
    const idx = headers.findIndex((h) => h === alias || h.includes(alias));
    if (idx >= 0) return idx;
  }
  return -1;
}

function numCell(value: unknown) {
  if (value === null || value === undefined || value === "") return NaN;
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

export function parseValidityWorkbook(
  buffer: ArrayBuffer,
  profiles: ProfileMatch[],
): ValidityPreviewRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];

  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  if (matrix.length < 2) return [];

  const headers = (matrix[0] ?? []).map(normHeader);
  const initialsIdx = pickCol(headers, ["initials", "init"]);
  const emailIdx = pickCol(headers, ["email", "e-mail"]);
  const nameIdx = pickCol(headers, ["name", "circulator", "petitioner"]);
  const dupsIdx = pickCol(headers, ["dups", "dup"]);
  const usableIdx = pickCol(headers, ["usable"]);
  const validIdx = pickCol(headers, ["valid"]);
  const pctIdx = pickCol(headers, ["validity", "pct", "percent"]);

  const byInitials = new Map(
    profiles.map((p) => [p.initials.trim().toUpperCase(), p] as const),
  );
  const byEmail = new Map(profiles.map((p) => [p.email.trim().toLowerCase(), p] as const));

  const rows: ValidityPreviewRow[] = [];

  for (let i = 1; i < matrix.length; i++) {
    const raw = matrix[i] ?? [];
    const initials = initialsIdx >= 0 ? String(raw[initialsIdx] ?? "").trim() : "";
    const email = emailIdx >= 0 ? String(raw[emailIdx] ?? "").trim() : "";
    const name = nameIdx >= 0 ? String(raw[nameIdx] ?? "").trim() : "";
    const dups = dupsIdx >= 0 ? numCell(raw[dupsIdx]) : 0;
    const usable = usableIdx >= 0 ? numCell(raw[usableIdx]) : 0;
    const valid = validIdx >= 0 ? numCell(raw[validIdx]) : 0;
    let validityPct = pctIdx >= 0 ? numCell(raw[pctIdx]) : NaN;

    if (!initials && !email && !name && !Number.isFinite(dups) && !Number.isFinite(usable)) {
      continue;
    }

    if (!Number.isFinite(validityPct) && usable > 0 && Number.isFinite(valid)) {
      validityPct = Math.round((valid / usable) * 1000) / 10;
    }
    if (!Number.isFinite(validityPct)) validityPct = 0;

    const match =
      (initials ? byInitials.get(initials.toUpperCase()) : undefined) ??
      (email ? byEmail.get(email.toLowerCase()) : undefined);

    if (!match) {
      rows.push({
        rowNumber: i + 1,
        initials,
        email,
        userId: null,
        name: name || initials || email || "—",
        dups: Number.isFinite(dups) ? dups : 0,
        usable: Number.isFinite(usable) ? usable : 0,
        valid: Number.isFinite(valid) ? valid : 0,
        validityPct,
        status: "unmatched",
        error: "No matching user by initials or email",
      });
      continue;
    }

    if ([dups, usable, valid, validityPct].some((n) => !Number.isFinite(n) || n < 0)) {
      rows.push({
        rowNumber: i + 1,
        initials: match.initials,
        email: match.email,
        userId: match.id,
        name: `${match.firstName} ${match.lastName}`,
        dups: Number.isFinite(dups) ? dups : 0,
        usable: Number.isFinite(usable) ? usable : 0,
        valid: Number.isFinite(valid) ? valid : 0,
        validityPct: Number.isFinite(validityPct) ? validityPct : 0,
        status: "invalid",
        error: "Numeric values must be zero or greater",
      });
      continue;
    }

    rows.push({
      rowNumber: i + 1,
      initials: match.initials,
      email: match.email,
      userId: match.id,
      name: `${match.firstName} ${match.lastName}`,
      dups,
      usable,
      valid,
      validityPct,
      status: "matched",
    });
  }

  return rows;
}
