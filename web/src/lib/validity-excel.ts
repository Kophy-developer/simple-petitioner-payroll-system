import * as XLSX from "xlsx";
import { matchProfile, type MatchProfile } from "@/lib/profile-match";

export type ValidityPreviewRow = {
  rowNumber: number;
  initials: string;
  email: string;
  phone: string;
  userId: string | null;
  name: string;
  dups: number;
  usable: number;
  valid: number;
  validityPct: number;
  status: "matched" | "unmatched" | "invalid";
  error?: string;
};

export type ValidityProfileMatch = MatchProfile;

function normHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[%#]/g, "")
    .replace(/\s+/g, " ");
}

function pickCol(headers: string[], aliases: string[]) {
  for (const alias of aliases) {
    const exact = headers.findIndex((h) => h === alias);
    if (exact >= 0) return exact;
  }
  for (const alias of aliases) {
    const idx = headers.findIndex((h) => h.includes(alias));
    if (idx >= 0) return idx;
  }
  return -1;
}

function pickNameCol(headers: string[]) {
  const exactAliases = [
    "full name",
    "circulator name",
    "petitioner name",
    "name",
    "circulator",
    "petitioner",
  ];
  for (const alias of exactAliases) {
    const exact = headers.findIndex((h) => h === alias);
    if (exact >= 0) return exact;
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
  profiles: ValidityProfileMatch[],
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
  const phoneIdx = pickCol(headers, ["phone", "mobile", "cell"]);
  const nameIdx = pickNameCol(headers);
  const firstIdx = pickCol(headers, ["first name", "firstname"]);
  const lastIdx = pickCol(headers, ["last name", "lastname"]);
  const dupsIdx = pickCol(headers, ["dups", "dup", "duplicates", "duplicate"]);
  const usableIdx = pickCol(headers, ["usable"]);
  const validIdx = (() => {
    const exact = headers.findIndex((h) => h === "valid");
    return exact >= 0 ? exact : -1;
  })();
  const pctIdx = pickCol(headers, ["validity", "pct", "percent"]);

  const rows: ValidityPreviewRow[] = [];

  for (let i = 1; i < matrix.length; i++) {
    const raw = matrix[i] ?? [];
    const initials = initialsIdx >= 0 ? String(raw[initialsIdx] ?? "").trim() : "";
    const email = emailIdx >= 0 ? String(raw[emailIdx] ?? "").trim() : "";
    const phone = phoneIdx >= 0 ? String(raw[phoneIdx] ?? "").trim() : "";
    const firstName = firstIdx >= 0 ? String(raw[firstIdx] ?? "").trim() : "";
    const lastName = lastIdx >= 0 ? String(raw[lastIdx] ?? "").trim() : "";
    const nameCol = nameIdx >= 0 ? String(raw[nameIdx] ?? "").trim() : "";
    const name = nameCol || [firstName, lastName].filter(Boolean).join(" ");
    const dups = dupsIdx >= 0 ? numCell(raw[dupsIdx]) : 0;
    const usable = usableIdx >= 0 ? numCell(raw[usableIdx]) : 0;
    const valid = validIdx >= 0 ? numCell(raw[validIdx]) : 0;
    let validityPct = pctIdx >= 0 ? numCell(raw[pctIdx]) : NaN;

    if (
      !initials &&
      !email &&
      !phone &&
      !name &&
      !Number.isFinite(dups) &&
      !Number.isFinite(usable)
    ) {
      continue;
    }

    if (!Number.isFinite(validityPct) && usable > 0 && Number.isFinite(valid)) {
      validityPct = Math.round((valid / usable) * 1000) / 10;
    }
    if (!Number.isFinite(validityPct)) validityPct = 0;

    const match = matchProfile(
      { name, firstName, lastName, email, phone, initials },
      profiles,
    );

    if (match.status !== "matched") {
      rows.push({
        rowNumber: i + 1,
        initials,
        email,
        phone,
        userId: null,
        name: name || email || phone || initials || "—",
        dups: Number.isFinite(dups) ? dups : 0,
        usable: Number.isFinite(usable) ? usable : 0,
        valid: Number.isFinite(valid) ? valid : 0,
        validityPct,
        status: "unmatched",
        error: match.reason,
      });
      continue;
    }

    const profile = match.profile;
    if ([dups, usable, valid, validityPct].some((n) => !Number.isFinite(n) || n < 0)) {
      rows.push({
        rowNumber: i + 1,
        initials: profile.initials,
        email: profile.email,
        phone: profile.phone ?? phone,
        userId: profile.id,
        name: `${profile.firstName} ${profile.lastName}`,
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
      initials: profile.initials,
      email: profile.email,
      phone: profile.phone ?? phone,
      userId: profile.id,
      name: `${profile.firstName} ${profile.lastName}`,
      dups,
      usable,
      valid,
      validityPct,
      status: "matched",
    });
  }

  return rows;
}
