export function calculatePayable(
  sigs: number,
  validityPercent: number | null,
  benchmarkPercent: number,
): number | null {
  if (validityPercent === null) {
    return null;
  }

  if (validityPercent >= benchmarkPercent) {
    return sigs;
  }

  const shortfall = benchmarkPercent - validityPercent;
  return Math.round(sigs * (1 - shortfall / 100));
}

export function calculateLedgerAmounts(input: {
  sigs: number;
  pay: number;
  payRate: number;
  validityPercent: number | null;
  benchmarkPercent: number;
}) {
  const estimatedPay = roundMoney(input.sigs * input.pay);
  const payable = calculatePayable(
    input.sigs,
    input.validityPercent,
    input.benchmarkPercent,
  );

  if (payable === null) {
    return {
      estimatedPay,
      payable: null,
      totalPay: null,
      upfront: null,
      hold: null,
      validityPending: true,
    };
  }

  const totalPay = roundMoney(input.pay * payable * input.payRate);
  const upfront = roundMoney(totalPay * 0.85);
  const hold = roundMoney(totalPay * 0.15);

  return {
    estimatedPay,
    payable,
    totalPay,
    upfront,
    hold,
    validityPending: false,
  };
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
