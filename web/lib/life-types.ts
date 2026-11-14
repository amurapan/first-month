import type { MonthView } from "./month-types";
import type { Expense, Plan, Profile, Role } from "./room";

export type DecisionAnswer = {
  limit: number | null;
  timing: "now" | "save" | "flexible";
  note: string;
  shared: boolean;
  updatedAt: string;
};
export type DecisionProposal = {
  method: "equal" | "proportional" | "custom";
  customA: number;
  months: number;
  amount: number;
  notes: string;
  reviewDate: string;
  planVersion: number;
  version: number;
  author: Role;
  approvals: Record<Role, "pending" | "accepted" | "changes">;
  commitmentKey?: string;
};
export type DecisionResolution = {
  at: string;
  planVersion: number;
  title: string;
  kind: "purchase" | "recurring";
  amount: number;
  months: number;
  contributions: number[];
  firstMonth: number[];
  notes: string;
  reviewDate: string;
  method: string;
  version: number;
};
export type HouseholdDecision = {
  id: string;
  title: string;
  kind: "purchase" | "recurring";
  amount: number;
  context: string;
  creator: Role;
  status: "open" | "agreed" | "completed" | "archived";
  createdAt: string;
  updatedAt: string;
  answers: Partial<Record<Role, DecisionAnswer>>;
  proposal: DecisionProposal | null;
  resolutions: DecisionResolution[];
  completedAt?: string;
  funding?: Record<Role, number>;
  fundingMonth?: string;
  fundedThisMonth?: Record<Role, number>;
  activeResolutionVersion?: number | null;
  cancellation?: Partial<Record<Role, boolean>>;
  guide?: { key: string; text: string; contextKey?: string };
  guideCount?: number;
};
export type DecisionView = Omit<HouseholdDecision, "answers" | "guide"> & {
  revision: number;
  answers: Partial<
    Record<Role, DecisionAnswer | { shared: boolean; submitted: boolean }>
  >;
  bothAnswered: boolean;
  stale: boolean;
  guide: string | null;
};
export type ReviewAnswer = {
  feeling: "comfortable" | "mixed" | "stretched";
  worked: string;
  change: string;
  shared: boolean;
  updatedAt: string;
};
export type HouseholdReview = {
  id: string;
  week: string;
  answers: Partial<Record<Role, ReviewAnswer>>;
  action: {
    text: string;
    owner: Role | "both";
    due: string;
    approvals: Record<Role, boolean>;
    completed: boolean;
  } | null;
  guide?: { text: string; key: string; contextKey?: string };
  guideCount?: number;
};
export type ReviewView = Omit<HouseholdReview, "answers" | "guide"> & {
  revision: number;
  answers: Partial<
    Record<Role, ReviewAnswer | { shared: boolean; submitted: boolean }>
  >;
  bothAnswered: boolean;
  guide: string | null;
};
export type PlanSnapshot = {
  planVersion: number;
  createdAt: string;
  expenses: Expense[];
  plan: Plan;
  names: string[];
  contributions: number[];
  total: number;
};
export type SpaceState = {
  id: string;
  revision: number;
  role: Role;
  demo: boolean;
  moveDate: string | null;
  self: Profile;
  partner: Partial<Profile> & { name: string };
  bothShared: boolean;
  joined: boolean;
  expenses: Expense[];
  plan: Plan;
  planVersion: number;
  decisions: Record<Role, string>;
  calculation: {
    contributionsCents: number[];
    remainingCents: number[];
    minimumRemainingMet: boolean[];
  } | null;
  estimate: {
    partnerIncome: number | null;
    method: "equal" | "proportional";
  } | null;
  months: MonthView[];
  householdDecisions: DecisionView[];
  decisionCount: number;
  householdReviews: ReviewView[];
  currentWeek: string;
  planHistory: PlanSnapshot[];
  guide: string | null;
  checkins: {
    id: string;
    date: string;
    amount: number;
    note: string;
    role: Role;
  }[];
};
export type SpaceAction = (
  action: string,
  payload?: Record<string, unknown>,
) => Promise<SpaceState | null>;
