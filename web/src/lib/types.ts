export type UserRole = "circulator" | "admin" | "super_admin";

export type DemoUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  circulatorId?: string;
};

export type Circulator = {
  id: string;
  firstName: string;
  lastName: string;
  initials: string;
  status: "active" | "inactive";
};

export type Petition = {
  id: string;
  name: string;
  code: string;
  pay: number;
  lotus: string;
};

export type Issue = {
  id: string;
  issueNumber: string;
  name: string;
  petitionCode: string;
  state: string;
  validatedBy: string;
  turnInDate: string;
  turnInNumber: string;
};

export type Submission = {
  id: string;
  circulatorId: string;
  issueId: string;
  rawSignatures: number;
  pageNumbers: number;
  pooledSignatures: number;
  pooledPages: number;
};

export type LedgerRow = {
  id: string;
  circulatorId: string;
  issueId: string;
  sigs: number;
  pay: number;
  estimatedPay: number;
  dups: number | null;
  usable: number | null;
  valid: number | null;
  validityPercent: number | null;
  payRate: number;
  payable: number | null;
  totalPay: number | null;
  upfront: number | null;
  hold: number | null;
  validityPending: boolean;
};

export type Expense = {
  id: string;
  circulatorId: string;
  type: "draw" | "chargeback" | "hotel_travel" | "other";
  amount: number;
  date: string;
  receiptName: string;
};

export type LoanRequest = {
  id: string;
  circulatorId: string;
  amount: number;
  holdSnapshot: number;
  status: "pending" | "approved" | "rejected" | "auto_rejected";
  createdAt: string;
};

export type PayRate = {
  issueId: string;
  rate: number;
};
