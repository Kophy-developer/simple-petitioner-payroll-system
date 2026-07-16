import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseValidityWorkbook } from "./validity-excel";

test("parseValidityWorkbook matches by initials and email", () => {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Initials", "Email", "DUPs", "Usable", "Valid", "Validity%"],
    ["JR", "jordan@ballotaccesspros.com", 4, 31, 27, 75],
    ["XX", "nobody@example.com", 1, 2, 1, 50],
  ]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Sheet1");
  const buffer = XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

  const rows = parseValidityWorkbook(buffer, [
    {
      id: "u1",
      initials: "JR",
      email: "jordan@ballotaccesspros.com",
      firstName: "Jordan",
      lastName: "Reed",
    },
  ]);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].status, "matched");
  assert.equal(rows[0].userId, "u1");
  assert.equal(rows[0].dups, 4);
  assert.equal(rows[1].status, "unmatched");
});
