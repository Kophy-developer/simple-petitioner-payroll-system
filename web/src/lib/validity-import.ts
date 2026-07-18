import * as XLSX from "xlsx";

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

export function parseCoBatchValidityWorkbook(buffer: ArrayBuffer): CoBatchValidityRow[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  return rows
    .map((row) => ({
      batchDate: row.batchDate == null ? null : String(row.batchDate),
      petition: row.petition == null ? null : String(row.petition),
      priceCode: row.priceCode == null ? null : String(row.priceCode),
      team: row.team == null ? null : String(row.team),
      circulator: String(row.circulator ?? "").trim(),
      processedCn: n(row.processed_cn),
      deficientN: n(row.deficient_n),
      duplicateN: n(row.duplicate_n),
      disqualifiedN: n(row.disqualified_n),
      usableCn: n(row.usable_cn),
      hardMatchN: n(row.hardMatch_n),
      softMatchN: n(row.softMatch_n),
      registrationN: n(row.registration_n),
      nonMatchN: n(row.nonMatch_n),
      validCn: n(row.valid_cn),
      validityPct: n(row.validity_cn),
    }))
    .filter((row) => row.circulator);
}

export function parseMiFinalValidityWorkbook(buffer: ArrayBuffer): MiFinalValidityRow[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  return rows
    .map((row) => ({
      name: String(row.Name ?? "").trim(),
      duplicate: n(row.Duplicate),
      failed: n(row.Failed),
      wrongCounty: n(row["Wrong County"]),
      valid: n(row.Valid),
      usableRaw: n(row["Usable Raw"]),
      validityPct: n(row.Validity),
    }))
    .filter((row) => row.name);
}
