import {
  benchmarkPercent,
  clockSessions,
  conversations,
  demoUsers,
  expenseConfig,
  expenses,
  getLedgerForUser,
  getPayrollBalance,
  getSubmissionsForIssue,
  issues,
  ledgerRows,
  liveClockUsers,
  loanRequests,
  monthlyPayroll,
  petitions,
  payRates,
  roleCategories,
  submissions,
  turnIns,
  validityRecords,
} from "@/lib/demo-data";
import type { DemoUser } from "@/lib/types";

export const api = {
  auth: {
    login: async (email: string, password: string) => {
      const user = demoUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (!user || password !== "demo1234") return { error: "Invalid credentials" };
      return { token: "demo-jwt", user };
    },
  },
  users: {
    list: async () => demoUsers,
    get: async (id: string) => demoUsers.find((u) => u.id === id),
  },
  issues: { list: async () => issues },
  petitions: { list: async () => petitions },
  payRates: { list: async () => payRates },
  submissions: {
    list: async (issueId?: string) =>
      issueId ? getSubmissionsForIssue(issueId) : submissions,
  },
  turnIns: {
    list: async () => turnIns,
    pending: async () => turnIns.filter((t) => t.status === "pending"),
    get: async (id: string) => turnIns.find((t) => t.id === id),
  },
  validity: {
    list: async (issueId?: string) =>
      issueId ? validityRecords.filter((v) => v.issueId === issueId) : validityRecords,
  },
  ledger: {
    get: async (userId: string) => getLedgerForUser(userId),
    all: async () => ledgerRows,
  },
  expenses: {
    list: async (userId?: string) =>
      userId ? expenses.filter((e) => e.userId === userId) : expenses,
    balance: async (userId: string) => getPayrollBalance(userId),
  },
  loans: {
    list: async () => loanRequests,
    pending: async () => loanRequests.filter((l) => l.status === "pending"),
  },
  clock: {
    sessions: async () => clockSessions,
    live: async () => liveClockUsers,
    activeForUser: async (userId: string) =>
      clockSessions.find((s) => s.userId === userId && !s.clockOut),
  },
  payroll: {
    monthly: async () => monthlyPayroll,
  },
  roleCategories: { list: async () => roleCategories },
  expenseConfig: { get: async () => expenseConfig },
  conversations: { list: async () => conversations },
  settings: { benchmark: async () => benchmarkPercent },
};

export type ApiUser = DemoUser;
