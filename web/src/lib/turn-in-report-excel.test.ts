import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  extractPayFromCode,
  normalizeTurnInNumber,
  parseTurnInReportWorkbook,
  summarizeTurnInReport,
} from "./turn-in-report-excel";

describe("turn-in report excel", () => {
  it("extracts pay from priced codes", () => {
    assert.equal(extractPayFromCode("ROAD"), 0);
    assert.equal(extractPayFromCode("TAX $3"), 3);
    assert.equal(extractPayFromCode("VOTER ID $3"), 3);
  });

  it("normalizes turn-in numbers", () => {
    assert.equal(normalizeTurnInNumber("BAP-CO-01", "CO-01"), "BAP-CO-01");
    assert.equal(normalizeTurnInNumber("", "CO-09"), "BAP-CO-09");
  });

  it("parses CO turn-in workbook sheets into issues and entries", () => {
    const path = "/Users/macpro/Downloads/CO Turn in Report (1).xlsx";
    let buffer: Buffer;
    try {
      buffer = readFileSync(path);
    } catch {
      return;
    }
    const parsed = parseTurnInReportWorkbook(buffer);
    const summary = summarizeTurnInReport(parsed);
    assert.equal(parsed.state, "CO");
    assert.ok(parsed.issues.length >= 18);
    assert.ok(parsed.issues.some((i) => i.turnInNumber === "BAP-CO-01"));
    const first = parsed.issues.find((i) => i.turnInNumber === "BAP-CO-01");
    assert.ok(first);
    assert.ok(first.columns.some((c) => c.code === "ROAD"));
    assert.ok(first.columns.some((c) => /TAX/i.test(c.code)));
    assert.ok(first.columns.some((c) => /GAS/i.test(c.code)));
    assert.ok(first.entries.length > 0);
    assert.ok(summary.entryCount > 0);
    assert.ok(summary.personCount > 0);
  });
});
