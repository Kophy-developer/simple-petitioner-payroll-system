import type {
  Circulator,
  DemoUser,
  Expense,
  Issue,
  LedgerRow,
  LoanRequest,
  PayRate,
  Petition,
  Submission,
} from "./types";

export const demoUsers: DemoUser[] = [
  {
    id: "u-circ",
    email: "jordan.reed@ballotaccesspros.com",
    name: "Jordan Reed",
    role: "circulator",
    circulatorId: "c-1",
  },
  {
    id: "u-admin",
    email: "admin@ballotaccesspros.com",
    name: "Morgan Ellis",
    role: "admin",
  },
  {
    id: "u-super",
    email: "super@ballotaccesspros.com",
    name: "Alex Whitfield",
    role: "super_admin",
  },
];

export const demoPassword = "demo1234";

export const circulators: Circulator[] = [
  {
    id: "c-1",
    firstName: "Jordan",
    lastName: "Reed",
    initials: "JR",
    status: "active",
  },
  {
    id: "c-2",
    firstName: "Casey",
    lastName: "Nguyen",
    initials: "CN",
    status: "active",
  },
  {
    id: "c-3",
    firstName: "Taylor",
    lastName: "Brooks",
    initials: "TB",
    status: "active",
  },
  {
    id: "c-4",
    firstName: "Riley",
    lastName: "Santos",
    initials: "RS",
    status: "inactive",
  },
];

export const petitions: Petition[] = [
  {
    id: "p-1",
    name: "Ballot Access Reform",
    code: "BAP",
    pay: 1.0,
    lotus: "A-12",
  },
  {
    id: "p-2",
    name: "Citizen Initiative Drive",
    code: "CID",
    pay: 0.85,
    lotus: "B-04",
  },
];

export const issues: Issue[] = [
  {
    id: "i-1",
    issueNumber: "BAP-CO-09",
    name: "Colorado Reform Drive — Fall Batch",
    petitionCode: "BAP",
    state: "CO",
    validatedBy: "Morgan Ellis",
    turnInDate: "2026-05-14",
    turnInNumber: "CO-2026-441",
  },
  {
    id: "i-2",
    issueNumber: "BAP-NV-03",
    name: "Nevada Signature Push",
    petitionCode: "BAP",
    state: "NV",
    validatedBy: "Morgan Ellis",
    turnInDate: "2026-06-02",
    turnInNumber: "NV-2026-118",
  },
  {
    id: "i-3",
    issueNumber: "CID-AZ-01",
    name: "Arizona Initiative Intake",
    petitionCode: "CID",
    state: "AZ",
    validatedBy: "Alex Whitfield",
    turnInDate: "2026-06-18",
    turnInNumber: "AZ-2026-029",
  },
];

export const submissions: Submission[] = [
  {
    id: "s-1",
    circulatorId: "c-1",
    issueId: "i-1",
    rawSignatures: 36,
    pageNumbers: 4,
    pooledSignatures: 36,
    pooledPages: 4,
  },
  {
    id: "s-2",
    circulatorId: "c-2",
    issueId: "i-1",
    rawSignatures: 42,
    pageNumbers: 5,
    pooledSignatures: 41,
    pooledPages: 5,
  },
  {
    id: "s-3",
    circulatorId: "c-3",
    issueId: "i-1",
    rawSignatures: 28,
    pageNumbers: 3,
    pooledSignatures: 28,
    pooledPages: 3,
  },
  {
    id: "s-4",
    circulatorId: "c-1",
    issueId: "i-2",
    rawSignatures: 51,
    pageNumbers: 6,
    pooledSignatures: 50,
    pooledPages: 6,
  },
  {
    id: "s-5",
    circulatorId: "c-2",
    issueId: "i-3",
    rawSignatures: 33,
    pageNumbers: 4,
    pooledSignatures: 33,
    pooledPages: 4,
  },
];

export const payRates: PayRate[] = [
  { issueId: "i-1", rate: 1.5 },
  { issueId: "i-2", rate: 1.5 },
  { issueId: "i-3", rate: 1.25 },
];

export const benchmarkPercent = 75;

export const ledgerRows: LedgerRow[] = [
  {
    id: "l-1",
    circulatorId: "c-1",
    issueId: "i-1",
    sigs: 36,
    pay: 1.0,
    estimatedPay: 36.0,
    dups: 4,
    usable: 31,
    valid: 27,
    validityPercent: 75,
    payRate: 1.5,
    payable: 36,
    totalPay: 54.0,
    upfront: 45.9,
    hold: 8.1,
    validityPending: false,
  },
  {
    id: "l-2",
    circulatorId: "c-2",
    issueId: "i-1",
    sigs: 42,
    pay: 1.0,
    estimatedPay: 42.0,
    dups: 6,
    usable: 34,
    valid: 29,
    validityPercent: 70,
    payRate: 1.5,
    payable: 40,
    totalPay: 60.0,
    upfront: 51.0,
    hold: 9.0,
    validityPending: false,
  },
  {
    id: "l-3",
    circulatorId: "c-3",
    issueId: "i-1",
    sigs: 28,
    pay: 1.0,
    estimatedPay: 28.0,
    dups: 2,
    usable: 25,
    valid: 22,
    validityPercent: 79,
    payRate: 1.5,
    payable: 28,
    totalPay: 42.0,
    upfront: 35.7,
    hold: 6.3,
    validityPending: false,
  },
  {
    id: "l-4",
    circulatorId: "c-1",
    issueId: "i-2",
    sigs: 51,
    pay: 1.0,
    estimatedPay: 51.0,
    dups: null,
    usable: null,
    valid: null,
    validityPercent: null,
    payRate: 1.5,
    payable: null,
    totalPay: null,
    upfront: null,
    hold: null,
    validityPending: true,
  },
  {
    id: "l-5",
    circulatorId: "c-2",
    issueId: "i-3",
    sigs: 33,
    pay: 0.85,
    estimatedPay: 28.05,
    dups: 3,
    usable: 28,
    valid: 24,
    validityPercent: 73,
    payRate: 1.25,
    payable: 32,
    totalPay: 34.0,
    upfront: 28.9,
    hold: 5.1,
    validityPending: false,
  },
];

export const expenses: Expense[] = [
  {
    id: "e-1",
    circulatorId: "c-1",
    type: "hotel_travel",
    amount: 124.5,
    date: "2026-05-10",
    receiptName: "marriott-co-springs.pdf",
  },
  {
    id: "e-2",
    circulatorId: "c-1",
    type: "draw",
    amount: 85.0,
    date: "2026-05-16",
    receiptName: "fuel-receipt.jpg",
  },
  {
    id: "e-3",
    circulatorId: "c-1",
    type: "chargeback",
    amount: 42.0,
    date: "2026-05-22",
    receiptName: "supplies-chargeback.pdf",
  },
  {
    id: "e-4",
    circulatorId: "c-2",
    type: "draw",
    amount: 60.0,
    date: "2026-06-01",
    receiptName: "atm-withdrawal.jpg",
  },
];

export const loanRequests: LoanRequest[] = [
  {
    id: "lr-1",
    circulatorId: "c-1",
    amount: 50.0,
    holdSnapshot: 8.1,
    status: "pending",
    createdAt: "2026-06-28T14:22:00Z",
  },
  {
    id: "lr-2",
    circulatorId: "c-2",
    amount: 120.0,
    holdSnapshot: 9.0,
    status: "auto_rejected",
    createdAt: "2026-06-25T09:10:00Z",
  },
  {
    id: "lr-3",
    circulatorId: "c-3",
    amount: 25.0,
    holdSnapshot: 6.3,
    status: "approved",
    createdAt: "2026-06-20T16:45:00Z",
  },
];

export function getCirculator(id: string) {
  return circulators.find((c) => c.id === id);
}

export function getCirculatorName(id: string) {
  const c = getCirculator(id);
  return c ? `${c.firstName} ${c.lastName}` : "Unknown";
}

export function getIssue(id: string) {
  return issues.find((i) => i.id === id);
}

export function getPetitionForIssue(issueId: string) {
  const issue = getIssue(issueId);
  if (!issue) return undefined;
  return petitions.find((p) => p.code === issue.petitionCode);
}

export function getSubmissionsForIssue(issueId: string) {
  return submissions.filter((s) => s.issueId === issueId);
}

export function getLedgerForCirculator(circulatorId: string) {
  return ledgerRows.filter((l) => l.circulatorId === circulatorId);
}

export function getExpensesForCirculator(circulatorId: string) {
  return expenses.filter((e) => e.circulatorId === circulatorId);
}

export function getPayrollSummary(circulatorId: string) {
  const rows = getLedgerForCirculator(circulatorId);
  const totalUpfront = rows.reduce((sum, r) => sum + (r.upfront ?? 0), 0);
  const totalHold = rows.reduce((sum, r) => sum + (r.hold ?? 0), 0);
  const totalExpenses = getExpensesForCirculator(circulatorId).reduce(
    (sum, e) => sum + e.amount,
    0,
  );
  const balance = totalUpfront - totalExpenses;

  return { totalUpfront, totalHold, totalExpenses, balance };
}

export const expenseTypeLabels: Record<Expense["type"], string> = {
  draw: "Draw",
  chargeback: "Chargeback",
  hotel_travel: "Hotel / Travel",
  other: "Other",
};

export const loanStatusLabels: Record<LoanRequest["status"], string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  auto_rejected: "Declined",
};
