import type { DecisionAnswer, DecisionView, SpaceState } from "./life-types";
import type { Profile } from "./room";
import {
  projectOption,
  projectAgreement,
  decisionOptions,
  commitmentLedger,
} from "./domain/planning.js";
export function planningInput(state: SpaceState, item: DecisionView) {
  if (!state.bothShared || !state.calculation || !item.bothAnswered)
    throw new Error("Both people need to share before comparing options.");
  const a = (state.role === "A" ? state.self : state.partner) as Profile;
  const b = (state.role === "B" ? state.self : state.partner) as Profile;
  return {
    item,
    decisions: state.householdDecisions,
    expenseIds: state.expenses.map((x) => x.id),
    incomes: [a.income, b.income],
    baseRemaining: state.calculation.remainingCents,
    refined: [a.refined !== false, b.refined !== false],
    reserves: [a.reserve, b.reserve],
    limits: [
      (item.answers.A as DecisionAnswer)?.limit ?? null,
      (item.answers.B as DecisionAnswer)?.limit ?? null,
    ],
  };
}
export const optionsFor = (state: SpaceState, item: DecisionView) =>
  decisionOptions(planningInput(state, item));
export const impactForOption = (
  state: SpaceState,
  item: DecisionView,
  option: { amount: number; months: number; method: string; customA: number },
) => projectOption(planningInput(state, item), option);
export const ledgerFor = (state: SpaceState) =>
  commitmentLedger(
    state.householdDecisions,
    state.expenses.map((x) => x.id),
  );

export const impactForAgreement = (state: SpaceState, item: DecisionView) =>
  projectAgreement(planningInput(state, item));
