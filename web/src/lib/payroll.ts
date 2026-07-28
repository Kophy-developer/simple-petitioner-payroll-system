import type { PayModel } from "./types";

export function calculatePayable(
  sigs: number,
  validityPercent: number | null,
  benchmarkPercent: number,
): number | null {
  if (validityPercent === null) return null;
  if (validityPercent >= benchmarkPercent) return sigs;
  const shortfall = benchmarkPercent - validityPercent;
  return Math.round(sigs * (1 - shortfall / 100));
}

export function calculateLedgerAmounts(input: {
  sigs: number;
  pay: number;
  payRate: number;
  valid: number | null;
  validityPercent: number | null;
  benchmarkPercent: number;
  payModel: PayModel;
  holdPct?: number;
}) {
  const estimatedPay = roundMoney(input.sigs * input.pay);
  const holdPct = input.holdPct ?? 15;

  if (input.payModel === "per_valid_sig") {
    if (input.valid === null) {
      return emptyPayout(estimatedPay);
    }
    const totalPay = roundMoney(input.valid * input.payRate);
    return finalize(estimatedPay, input.valid, totalPay, holdPct);
  }

  const payable = calculatePayable(
    input.sigs,
    input.validityPercent,
    input.benchmarkPercent,
  );
  if (payable === null) return emptyPayout(estimatedPay);
  const totalPay = roundMoney(input.pay * payable * input.payRate);
  return finalize(estimatedPay, payable, totalPay, holdPct);
}

function emptyPayout(estimatedPay: number) {
  return {
    estimatedPay,
    payable: null,
    totalPay: null,
    upfront: null,
    hold: null,
    validityPending: true,
  };
}

function finalize(
  estimatedPay: number,
  payable: number,
  totalPay: number,
  holdPct = 15,
) {
  const holdFrac = Math.min(100, Math.max(0, holdPct)) / 100;
  return {
    estimatedPay,
    payable,
    totalPay,
    upfront: roundMoney(totalPay * (1 - holdFrac)),
    hold: roundMoney(totalPay * holdFrac),
    validityPending: false,
  };
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function payModelLabel(model: PayModel) {
  return model === "per_valid_sig" ? "Per Valid Sig" : "Validity Standard";
}
