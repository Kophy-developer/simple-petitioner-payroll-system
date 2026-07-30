import * as XLSX from "xlsx";
import { resolveImportedValidityPercent } from "@/lib/payroll-math";

export type CoBatchValidityRow = {
  batchDate: string | null;
  petition: string | null;
  priceCode: string | null;
  team: string | null;
  circulator: string;
  processedCn: number;
  deficientN: number;
  duplicateN: number;
  disqualifiedN: number;
  usableCn: number;
  hardMatchN: number;
  softMatchN: number;
  registrationN: number;
  nonMatchN: number;
  validCn: number;
  validityPct: number;
};

export type MiFinalValidityRow = {
  name: string;
  duplicate: number;
  failed: number;
  wrongCounty: number;
  valid: number;
  usableRaw: number;
  validityPct: number;
};

function n(value: unknown) {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return value;
  const cleaned = String(value).replace(/%/g, "").trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pctCell(value: unknown) {
  if (value == null || value === "") return NaN;
  if (typeof value === "number") return value;
  const cleaned = String(value).replace(/%/g, "").trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function normKey(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[%#]/g, "")
    .replace(/[_\s]+/g, "");
}

function cell(row: Record<string, unknown>, aliases: string[], opts?: { exactOnly?: boolean }) {
  const entries = Object.entries(row);
  for (const alias of aliases) {
    const want = normKey(alias);
    const exact = entries.find(([key]) => normKey(key) === want);
    if (exact) return exact[1];
  }
  if (opts?.exactOnly) return null;
  for (const alias of aliases) {
    const want = normKey(alias);
    if (want === "valid") continue;
    const soft = entries.find(([key]) => {
      const k = normKey(key);
      if (k === "validity" || k.startsWith("validity")) return want.startsWith("validity");
      return k.includes(want);
    });
    if (soft) return soft[1];
  }
  return null;
}

function textCell(row: Record<string, unknown>, aliases: string[]) {
  const value = cell(row, aliases);
  if (value == null || value === "") return "";
  return String(value).trim();
}

export function parseCoBatchValidityWorkbook(buffer: ArrayBuffer): CoBatchValidityRow[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  return rows
    .map((row) => {
      const usableCn = n(cell(row, ["usable_cn", "usable"]));
      const validCn = n(cell(row, ["valid_cn", "valid"], { exactOnly: true }));
      return {
        batchDate: (() => {
          const v = cell(row, ["batchDate", "batch date"], { exactOnly: true });
          return v == null || v === "" ? null : String(v);
        })(),
        petition: (() => {
          const v = cell(row, ["petition"], { exactOnly: true });
          return v == null || v === "" ? null : String(v);
        })(),
        priceCode: (() => {
          const v = cell(row, ["priceCode", "price code"], { exactOnly: true });
          return v == null || v === "" ? null : String(v);
        })(),
        team: (() => {
          const v = cell(row, ["team"], { exactOnly: true });
          return v == null || v === "" ? null : String(v);
        })(),
        circulator: textCell(row, [
          "circulator",
          "name",
          "full name",
          "petitioner",
          "email",
          "phone",
        ]),
        processedCn: n(cell(row, ["processed_cn", "processed"])),
        deficientN: n(cell(row, ["deficient_n", "deficient"])),
        duplicateN: n(cell(row, ["duplicate_n", "duplicate", "dups", "dup"])),
        disqualifiedN: n(cell(row, ["disqualified_n", "disqualified"])),
        usableCn,
        hardMatchN: n(cell(row, ["hardMatch_n", "hardMatch", "hard match"])),
        softMatchN: n(cell(row, ["softMatch_n", "softMatch", "soft match"])),
        registrationN: n(cell(row, ["registration_n", "registration"])),
        nonMatchN: n(cell(row, ["nonMatch_n", "nonMatch", "non match"])),
        validCn,
        validityPct: resolveImportedValidityPercent(
          pctCell(cell(row, ["validity_cn", "validity", "validity pct"])),
          validCn,
          usableCn,
        ),
      };
    })
    .filter((row) => row.circulator);
}

export function parseMiFinalValidityWorkbook(buffer: ArrayBuffer): MiFinalValidityRow[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  return rows
    .map((row) => {
      const usableRaw = n(cell(row, ["Usable Raw", "usable raw", "usable"]));
      const valid = n(cell(row, ["Valid", "valid"], { exactOnly: true }));
      return {
        name: textCell(row, ["Name", "name", "full name", "circulator", "petitioner", "email", "phone"]),
        duplicate: n(cell(row, ["Duplicate", "duplicate", "dups", "dup"])),
        failed: n(cell(row, ["Failed", "failed"])),
        wrongCounty: n(cell(row, ["Wrong County", "wrong county", "wrongcounty"])),
        valid,
        usableRaw,
        validityPct: resolveImportedValidityPercent(
          pctCell(cell(row, ["Validity", "validity", "validity pct"])),
          valid,
          usableRaw,
        ),
      };
    })
    .filter((row) => row.name);
}
