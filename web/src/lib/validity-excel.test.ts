import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseValidityWorkbook } from "./validity-excel";
import { matchProfile, normalizeMatchName, normalizePhoneDigits } from "./profile-match";
import {
  parseCoBatchValidityWorkbook,
  parseMiFinalValidityWorkbook,
} from "./validity-import";

const profiles = [
  {
    id: "u1",
    initials: "JR",
    email: "jordan@ballotaccesspros.com",
    firstName: "Jordan",
    lastName: "Reed",
    phone: "(512) 555-0101",
  },
  {
    id: "u2",
    initials: "BR",
    email: "beau@ballotaccesspros.com",
    firstName: "Beau",
    lastName: "Robacker",
    phone: "2145550199",
  },
  {
    id: "u3",
    initials: "JR",
    email: "jane@ballotaccesspros.com",
    firstName: "Jane",
    lastName: "Rivers",
    phone: null,
  },
];

function workbook(rows: (string | number)[][]) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Sheet1");
  return XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

test("normalizeMatchName handles Last, First and punctuation", () => {
  assert.equal(normalizeMatchName("Robacker, Beau"), "beau robacker");
  assert.equal(normalizeMatchName("  Beau   Robacker "), "beau robacker");
  assert.equal(normalizeMatchName("Beau-Robacker"), "beau robacker");
});

test("normalizePhoneDigits strips formatting and leading 1", () => {
  assert.equal(normalizePhoneDigits("+1 (512) 555-0101"), "5125550101");
  assert.equal(normalizePhoneDigits("5125550101"), "5125550101");
});

test("matchProfile prefers email then phone then exact name", () => {
  const byEmail = matchProfile({ email: "BEAU@ballotaccesspros.com", name: "Wrong Name" }, profiles);
  assert.equal(byEmail.status, "matched");
  if (byEmail.status === "matched") {
    assert.equal(byEmail.profile.id, "u2");
    assert.equal(byEmail.method, "email");
  }

  const byPhone = matchProfile({ phone: "214-555-0199" }, profiles);
  assert.equal(byPhone.status, "matched");
  if (byPhone.status === "matched") {
    assert.equal(byPhone.profile.id, "u2");
    assert.equal(byPhone.method, "phone");
  }

  const byName = matchProfile({ name: "Beau Robacker" }, profiles);
  assert.equal(byName.status, "matched");
  if (byName.status === "matched") {
    assert.equal(byName.profile.id, "u2");
    assert.equal(byName.method, "name");
  }
});

test("matchProfile supports Last, First and unique fuzzy names", () => {
  const flipped = matchProfile({ name: "Robacker, Beau" }, profiles);
  assert.equal(flipped.status, "matched");
  if (flipped.status === "matched") assert.equal(flipped.profile.id, "u2");

  const fuzzy = matchProfile({ name: "Beau Robackr" }, profiles);
  assert.equal(fuzzy.status, "matched");
  if (fuzzy.status === "matched") {
    assert.equal(fuzzy.profile.id, "u2");
    assert.equal(fuzzy.method, "fuzzy_name");
  }
});

test("matchProfile leaves ambiguous and missing names unmatched", () => {
  const ambiguous = matchProfile({ initials: "JR" }, profiles);
  assert.equal(ambiguous.status, "ambiguous");

  const missing = matchProfile({ name: "Nobody Here" }, profiles);
  assert.equal(missing.status, "unmatched");
  if (missing.status === "unmatched") {
    assert.match(missing.reason, /name, email, or phone/i);
  }
});

test("parseValidityWorkbook matches by name email and phone", () => {
  const buffer = workbook([
    ["Name", "Email", "Phone", "DUPs", "Usable", "Valid", "Validity%"],
    ["Beau Robacker", "", "", 2, 40, 30, 75],
    ["", "jordan@ballotaccesspros.com", "", 4, 31, 27, 87.1],
    ["", "", "512-555-0101", 1, 10, 8, 80],
    ["Nobody", "", "", 0, 1, 0, 0],
  ]);

  const rows = parseValidityWorkbook(buffer, profiles);
  assert.equal(rows.length, 4);
  assert.equal(rows[0].status, "matched");
  assert.equal(rows[0].userId, "u2");
  assert.equal(rows[1].status, "matched");
  assert.equal(rows[1].userId, "u1");
  assert.equal(rows[2].status, "matched");
  assert.equal(rows[2].userId, "u1");
  assert.equal(rows[3].status, "unmatched");
  assert.match(String(rows[3].error), /name, email, or phone/i);
});

test("parseValidityWorkbook keeps initials as unique last resort and reports ambiguity", () => {
  const buffer = workbook([
    ["Initials", "DUPs", "Usable", "Valid", "Validity%"],
    ["BR", 1, 5, 4, 80],
    ["JR", 1, 5, 4, 80],
  ]);

  const rows = parseValidityWorkbook(buffer, profiles);
  assert.equal(rows[0].status, "matched");
  assert.equal(rows[0].userId, "u2");
  assert.equal(rows[1].status, "unmatched");
  assert.match(String(rows[1].error), /ambiguous initials/i);
});

test("parseValidityWorkbook still accepts legacy initials+email files", () => {
  const buffer = workbook([
    ["Initials", "Email", "DUPs", "Usable", "Valid", "Validity%"],
    ["XX", "jordan@ballotaccesspros.com", 4, 31, 27, 75],
  ]);
  const rows = parseValidityWorkbook(buffer, profiles);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "matched");
  assert.equal(rows[0].userId, "u1");
});

test("parseValidityWorkbook skips Total and summary rows", () => {
  const buffer = workbook([
    ["Name", "DUPs", "Usable", "Valid", "Validity%"],
    ["Beau Robacker", 2, 40, 30, 75],
    ["Total", 10, 100, 80, 80],
    ["Grand Total", 10, 100, 80, 80],
    ["Summary", 1, 1, 1, 100],
  ]);
  const rows = parseValidityWorkbook(buffer, profiles);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "matched");
  assert.equal(rows[0].userId, "u2");
});

test("parseMiFinalValidityWorkbook reads Name aliases", () => {
  const buffer = workbook([
    ["Name", "Duplicate", "Failed", "Wrong County", "Valid", "Usable Raw", "Validity"],
    ["Beau Robacker", 1, 0, 0, 20, 25, 80],
  ]);
  const rows = parseMiFinalValidityWorkbook(buffer);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "Beau Robacker");
  assert.equal(rows[0].valid, 20);
});

test("parseCoBatchValidityWorkbook reads circulator aliases", () => {
  const buffer = workbook([
    ["circulator", "duplicate_n", "usable_cn", "valid_cn", "validity_cn"],
    ["Beau Robacker", 2, 30, 24, 80],
  ]);
  const rows = parseCoBatchValidityWorkbook(buffer);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].circulator, "Beau Robacker");
  assert.equal(rows[0].validCn, 24);
  assert.equal(rows[0].validityPct, 80);
});

test("parseValidityWorkbook normalizes fractional validity percents", () => {
  const buffer = workbook([
    ["Name", "DUPs", "Usable", "Valid", "Validity%"],
    ["Beau Robacker", 2, 40, 30, 0.75],
    ["Beau Robacker", 0, 100, 74.8, 0.748],
    ["Beau Robacker", 0, 100, 61, 0.61],
    ["Beau Robacker", 0, 50, 40, 61],
    ["Beau Robacker", 0, 100, 100, 1],
    ["Beau Robacker", 0, 0, 0, 1],
    ["Beau Robacker", 0, 80, 60, ""],
  ]);

  const rows = parseValidityWorkbook(buffer, profiles);
  assert.equal(rows[0].validityPct, 75);
  assert.equal(rows[1].validityPct, 74.8);
  assert.equal(rows[2].validityPct, 61);
  assert.equal(rows[3].validityPct, 61);
  assert.equal(rows[4].validityPct, 100);
  assert.equal(rows[5].validityPct, 1);
  assert.equal(rows[6].validityPct, 75);
});

test("normalizeValidityPercent scales stored fractions for display", async () => {
  const { normalizeValidityPercent } = await import("./payroll-math");
  assert.equal(normalizeValidityPercent(0.61), 61);
  assert.equal(normalizeValidityPercent(0.748), 74.8);
  assert.equal(normalizeValidityPercent(61), 61);
  assert.equal(normalizeValidityPercent(74.8), 74.8);
  assert.equal(normalizeValidityPercent(1), 1);
  assert.equal(normalizeValidityPercent(null), null);
});

test("parseCoBatchValidityWorkbook normalizes fractional validity", () => {
  const buffer = workbook([
    ["circulator", "duplicate_n", "usable_cn", "valid_cn", "validity_cn"],
    ["Beau Robacker", 2, 30, 24, 0.8],
  ]);
  const rows = parseCoBatchValidityWorkbook(buffer);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].validityPct, 80);
});

test("parseMiFinalValidityWorkbook normalizes fractional validity", () => {
  const buffer = workbook([
    ["Name", "Duplicate", "Failed", "Wrong County", "Valid", "Usable Raw", "Validity"],
    ["Beau Robacker", 1, 0, 0, 20, 25, 0.8],
  ]);
  const rows = parseMiFinalValidityWorkbook(buffer);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].validityPct, 80);
});
