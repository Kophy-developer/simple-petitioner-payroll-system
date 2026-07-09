import type {
  ClockSession,
  Conversation,
  DemoUser,
  Expense,
  ExpenseConfig,
  Issue,
  LedgerRow,
  LiveClockUser,
  LoanRequest,
  MonthlyPayrollRecord,
  PayRate,
  Petition,
  RoleCategory,
  Submission,
  TurnInUpload,
  ValidityRecord,
} from "./types";

export const demoPassword = "demo1234";

export const demoUsers: DemoUser[] = [
  { id: "u-super", email: "alex@ballotaccesspros.com", firstName: "Alex", lastName: "Whitfield", initials: "AW", role: "super_admin", status: "active", profileTags: ["leadership"], roleCategoryIds: ["rc-mgmt"] },
  { id: "u-admin", email: "morgan@ballotaccesspros.com", firstName: "Morgan", lastName: "Ellis", initials: "ME", role: "account_admin", status: "active", profileTags: ["ops"], roleCategoryIds: ["rc-mgmt"], wageCurrency: "USD", hourlyWage: 22 },
  { id: "u-lead", email: "sam@ballotaccesspros.com", firstName: "Sam", lastName: "Rivera", initials: "SR", role: "team_lead", status: "active", profileTags: ["field-lead"], roleCategoryIds: ["rc-co"], teamMemberIds: ["u-pet-1", "u-pet-3"] },
  { id: "u-pet-1", email: "jordan@ballotaccesspros.com", firstName: "Jordan", lastName: "Reed", initials: "JR", role: "petitioner", status: "active", profileTags: ["colorado"], roleCategoryIds: ["rc-co"] },
  { id: "u-canv", email: "casey@ballotaccesspros.com", firstName: "Casey", lastName: "Nguyen", initials: "CN", role: "canvasser", status: "active", profileTags: ["nevada"], roleCategoryIds: ["rc-nv"] },
  { id: "u-val", email: "riley@ballotaccesspros.com", firstName: "Riley", lastName: "Santos", initials: "RS", role: "validator", status: "active", profileTags: ["audit"], roleCategoryIds: ["rc-audit"] },
  { id: "u-pet-2", email: "taylor@ballotaccesspros.com", firstName: "Taylor", lastName: "Brooks", initials: "TB", role: "petitioner", status: "active", profileTags: ["colorado"], roleCategoryIds: ["rc-co"] },
  { id: "u-pet-3", email: "drew@ballotaccesspros.com", firstName: "Drew", lastName: "Hayes", initials: "DH", role: "petitioner", status: "active", profileTags: ["colorado"], roleCategoryIds: ["rc-co"] },
];

export const petitions: Petition[] = [
  { id: "p-1", name: "Ballot Access Reform", code: "BAP", pay: 1, lotus: "A-12" },
  { id: "p-2", name: "Citizen Initiative Drive", code: "CID", pay: 0.85, lotus: "B-04" },
];

export const issues: Issue[] = [
  { id: "i-1", issueNumber: "BAP-CO-09", name: "Colorado Reform Drive — Fall Batch", petitionId: "p-1", petitionCode: "BAP", state: "CO", validatedBy: "Morgan Ellis", turnInDate: "2026-05-14", turnInNumber: "CO-2026-441", payModel: "validity_standard" },
  { id: "i-2", issueNumber: "BAP-NV-03", name: "Nevada Signature Push", petitionId: "p-1", petitionCode: "BAP", state: "NV", validatedBy: "Morgan Ellis", turnInDate: "2026-06-02", turnInNumber: "NV-2026-118", payModel: "validity_standard" },
  { id: "i-3", issueNumber: "CID-AZ-01", name: "Arizona Initiative Intake", petitionId: "p-2", petitionCode: "CID", state: "AZ", validatedBy: "Alex Whitfield", turnInDate: "2026-06-18", turnInNumber: "AZ-2026-029", payModel: "per_valid_sig" },
];

export const submissions: Submission[] = [
  { id: "s-1", userId: "u-pet-1", issueId: "i-1", rawSignatures: 36, pageNumbers: 4, pooledSignatures: 36, pooledPages: 4 },
  { id: "s-2", userId: "u-pet-2", issueId: "i-1", rawSignatures: 42, pageNumbers: 5, pooledSignatures: 41, pooledPages: 5 },
  { id: "s-3", userId: "u-pet-3", issueId: "i-1", rawSignatures: 28, pageNumbers: 3, pooledSignatures: 28, pooledPages: 3 },
  { id: "s-4", userId: "u-pet-1", issueId: "i-2", rawSignatures: 51, pageNumbers: 6, pooledSignatures: 50, pooledPages: 6 },
  { id: "s-5", userId: "u-pet-2", issueId: "i-3", rawSignatures: 33, pageNumbers: 4, pooledSignatures: 33, pooledPages: 4 },
];

export const payRates: PayRate[] = [
  { petitionId: "p-1", issueId: "i-1", rate: 1.5 },
  { petitionId: "p-1", issueId: "i-2", rate: 1.5 },
  { petitionId: "p-2", issueId: "i-3", rate: 1.25 },
];

export const benchmarkPercent = 75;

export const ledgerRows: LedgerRow[] = [
  { id: "l-1", userId: "u-pet-1", issueId: "i-1", sigs: 36, pay: 1, estimatedPay: 36, dups: 4, usable: 31, valid: 27, validityPercent: 75, payRate: 1.5, payable: 36, totalPay: 54, upfront: 45.9, hold: 8.1, payModel: "validity_standard", validityPending: false },
  { id: "l-2", userId: "u-pet-2", issueId: "i-1", sigs: 42, pay: 1, estimatedPay: 42, dups: 6, usable: 34, valid: 29, validityPercent: 70, payRate: 1.5, payable: 40, totalPay: 60, upfront: 51, hold: 9, payModel: "validity_standard", validityPending: false },
  { id: "l-3", userId: "u-pet-3", issueId: "i-1", sigs: 28, pay: 1, estimatedPay: 28, dups: 2, usable: 25, valid: 22, validityPercent: 79, payRate: 1.5, payable: 28, totalPay: 42, upfront: 35.7, hold: 6.3, payModel: "validity_standard", validityPending: false },
  { id: "l-4", userId: "u-pet-1", issueId: "i-2", sigs: 51, pay: 1, estimatedPay: 51, dups: null, usable: null, valid: null, validityPercent: null, payRate: 1.5, payable: null, totalPay: null, upfront: null, hold: null, payModel: "validity_standard", validityPending: true },
  { id: "l-5", userId: "u-pet-2", issueId: "i-3", sigs: 33, pay: 0.85, estimatedPay: 28.05, dups: 3, usable: 28, valid: 24, validityPercent: 73, payRate: 1.25, payable: 24, totalPay: 30, upfront: 25.5, hold: 4.5, payModel: "per_valid_sig", validityPending: false },
];

export const validityRecords: ValidityRecord[] = [
  { id: "v-1", issueId: "i-1", userId: "u-pet-1", dups: 4, usable: 31, valid: 27, validityPercent: 75 },
  { id: "v-2", issueId: "i-1", userId: "u-pet-2", dups: 6, usable: 34, valid: 29, validityPercent: 70 },
  { id: "v-3", issueId: "i-1", userId: "u-pet-3", dups: 2, usable: 25, valid: 22, validityPercent: 79 },
  { id: "v-4", issueId: "i-3", userId: "u-pet-2", dups: 3, usable: 28, valid: 24, validityPercent: 73 },
];

export const expenses: Expense[] = [
  { id: "e-1", userId: "u-pet-1", issueId: "i-1", type: "hotel_travel", amount: 124.5, date: "2026-05-10", receiptName: "marriott-co.pdf" },
  { id: "e-2", userId: "u-pet-1", issueId: null, type: "upfront_draw", amount: 85, date: "2026-05-16", receiptName: "fuel.jpg" },
  { id: "e-3", userId: "u-pet-1", issueId: "i-1", type: "chargeback", amount: 42, date: "2026-05-22", receiptName: "supplies.pdf" },
  { id: "e-4", userId: "u-pet-2", issueId: null, type: "car_rental", amount: 180, date: "2026-06-01", receiptName: "hertz.pdf" },
  { id: "e-5", userId: "u-canv", issueId: null, type: "housing", amount: 95, date: "2026-06-05", receiptName: "rent.jpg" },
];

export const loanRequests: LoanRequest[] = [
  { id: "lr-1", userId: "u-pet-1", amount: 50, holdSnapshot: 8.1, status: "pending", createdAt: "2026-06-28T14:22:00Z" },
  { id: "lr-2", userId: "u-pet-2", amount: 120, holdSnapshot: 9, status: "auto_rejected", createdAt: "2026-06-25T09:10:00Z" },
  { id: "lr-3", userId: "u-pet-3", amount: 25, holdSnapshot: 6.3, status: "approved", createdAt: "2026-06-20T16:45:00Z" },
];

export const turnIns: TurnInUpload[] = [
  { id: "t-1", userId: "u-pet-1", fileName: "co-batch-09.pdf", issueIds: ["i-1"], turnInDate: "2026-05-14", turnInNumber: "CO-2026-441", notes: "Fall batch pages", status: "approved", submittedAt: "2026-05-13T10:00:00Z" },
  { id: "t-2", userId: "u-pet-1", fileName: "nv-batch-03.pdf", issueIds: ["i-2"], turnInDate: "2026-06-02", turnInNumber: "NV-2026-118", notes: "", status: "pending", submittedAt: "2026-06-01T16:30:00Z" },
  { id: "t-3", userId: "u-pet-2", fileName: "az-reject.xlsx", issueIds: ["i-3"], turnInDate: "2026-06-10", turnInNumber: "AZ-DRAFT-02", notes: "Resubmitting corrected file", status: "rejected", reviewNotes: "Missing signature pages 12–14", submittedAt: "2026-06-09T11:00:00Z" },
];

export const roleCategories: RoleCategory[] = [
  { id: "rc-mgmt", name: "Management", description: "Leadership and account operations", memberIds: ["u-super", "u-admin"] },
  { id: "rc-co", name: "Colorado Field", description: "Colorado petition team", memberIds: ["u-lead", "u-pet-1", "u-pet-3"] },
  { id: "rc-nv", name: "Nevada Field", description: "Nevada canvassing team", memberIds: ["u-canv"] },
  { id: "rc-audit", name: "Audit", description: "Validity operators", memberIds: ["u-val"] },
];

export const clockSessions: ClockSession[] = [
  { id: "cs-1", userId: "u-canv", clockIn: "2026-07-09T08:00:00Z", clockOut: null, durationMinutes: null, distanceMiles: null },
  { id: "cs-2", userId: "u-pet-1", clockIn: "2026-07-08T13:00:00Z", clockOut: "2026-07-08T19:30:00Z", durationMinutes: 390, distanceMiles: 14.2 },
];

export const liveClockUsers: LiveClockUser[] = [
  { userId: "u-canv", lat: 39.1638, lng: -119.7674, since: "2026-07-09T08:00:00Z" },
];

export const monthlyPayroll: MonthlyPayrollRecord[] = [
  { id: "mp-1", userId: "u-pet-1", month: 5, year: 2026, totalPay: 54, totalExpenses: 251.5, netPayable: -197.5, upfrontPaid: 45.9, holdBalance: 8.1, status: "locked" },
];

export const conversations: Conversation[] = [
  { id: "c-mgmt", name: "Management", type: "management", unread: 2, lastMessageAt: "2026-07-09T12:00:00Z", participantIds: ["u-super", "u-admin"] },
  { id: "c-1", name: "Jordan Reed", type: "dm", unread: 0, lastMessageAt: "2026-07-08T18:00:00Z", participantIds: ["u-lead", "u-pet-1"] },
  { id: "c-2", name: "Colorado Field", type: "group", unread: 1, lastMessageAt: "2026-07-09T09:30:00Z", participantIds: ["u-lead", "u-pet-1", "u-pet-3"] },
];

export const expenseConfig: ExpenseConfig = {
  carRental: { type: "per_issue", rate: 0, issueRates: [{ issueId: "i-1", rate: 45 }, { issueId: "i-2", rate: 50 }] },
  housing: { type: "standard", rate: 95, issueRates: [] },
};

export const expenseTypeLabels: Record<Expense["type"], string> = {
  upfront_draw: "Upfront Draw",
  chargeback: "Chargeback",
  hotel_travel: "Hotel / Travel",
  health: "Health",
  car_rental: "Car Rental",
  housing: "Housing",
  other: "Other",
};

export const loanStatusLabels: Record<LoanRequest["status"], string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  auto_rejected: "Declined",
};

export const turnInStatusLabels: Record<TurnInUpload["status"], string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export function getUser(id: string) {
  return demoUsers.find((u) => u.id === id);
}

export function getUserName(id: string) {
  const u = getUser(id);
  return u ? `${u.firstName} ${u.lastName}` : "Unknown";
}

export function getIssue(id: string) {
  return issues.find((i) => i.id === id);
}

export function getPetition(id: string) {
  return petitions.find((p) => p.id === id);
}

export function getSubmissionsForIssue(issueId: string) {
  return submissions.filter((s) => s.issueId === issueId);
}

export function getLedgerForUser(userId: string) {
  return ledgerRows.filter((l) => l.userId === userId);
}

export function getExpensesForUser(userId: string) {
  return expenses.filter((e) => e.userId === userId);
}

export function getPayrollBalance(userId: string) {
  const rows = getLedgerForUser(userId);
  const totalPay = rows.reduce((s, r) => s + (r.totalPay ?? 0), 0);
  const totalUpfront = rows.reduce((s, r) => s + (r.upfront ?? 0), 0);
  const totalHold = rows.reduce((s, r) => s + (r.hold ?? 0), 0);
  const totalExpenses = getExpensesForUser(userId).reduce((s, e) => s + e.amount, 0);
  return {
    totalPay,
    totalUpfront,
    totalHold,
    totalExpenses,
    liveBalance: totalUpfront - totalExpenses,
  };
}

export function getRoleCategoryName(id: string) {
  return roleCategories.find((c) => c.id === id)?.name ?? id;
}
