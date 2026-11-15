import type { Expense, Role } from "./room";
export type MonthBaseline = {
  planVersion: number;
  capturedAt: string;
  names: string[];
  expenses: Expense[];
  method: "equal" | "proportional" | "custom";
  weights: number[];
  sourceConfirmed: boolean;
  sourcePeriod?: string;
  sourceMonthVersion?: number;
};
export type MonthEntry = {
  id: string;
  kind: "expense" | "refund" | "transfer";
  amount: number;
  paidA: number;
  categoryId: string;
  title: string;
  date: string;
  author: Role;
  createdAt: string;
  updatedAt: string;
  originalId?: string;
  confirmed?: boolean;
  confirmedAt?: string;
  locked?: boolean;
};
export type MonthSettlement = {
  version: number;
  from: Role;
  amount: number;
  reportedAt: string;
  receivedAt?: string;
};
export type MonthSnapshot = {
  version: number;
  baseline: MonthBaseline;
  entries: MonthEntry[];
  agreedAt: string;
  approvals: Record<Role, boolean>;
};
export type HouseholdMonth = {
  period: string;
  baseline: MonthBaseline;
  entries: MonthEntry[];
  version: number;
  status: "open" | "agreed";
  approvals: Record<Role, boolean>;
  reopen: Partial<Record<Role, boolean>>;
  history: MonthSnapshot[];
  settlements: MonthSettlement[];
  createdAt: string;
  updatedAt: string;
};
export type MonthView = HouseholdMonth & { revision: number };
