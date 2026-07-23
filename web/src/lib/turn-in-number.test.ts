import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatTurnInNumber, isDateBasedTurnInNumber } from "./turn-in-number";

describe("turn-in number", () => {
  it("formats state and date as STATE-MM-DD", () => {
    assert.equal(formatTurnInNumber("CO", "2026-07-04"), "CO-07-04");
    assert.equal(formatTurnInNumber("ca", "2026-01-09"), "CA-01-09");
    assert.equal(formatTurnInNumber("", "2026-07-04"), "");
    assert.equal(formatTurnInNumber("CO", "bad"), "");
  });

  it("detects date-based numbers", () => {
    assert.equal(isDateBasedTurnInNumber("CO-07-04"), true);
    assert.equal(isDateBasedTurnInNumber("CO-01"), false);
    assert.equal(isDateBasedTurnInNumber("BAP-CO-01"), false);
  });
});
