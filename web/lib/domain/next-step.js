import { currentMonth, currentSettlement } from "./month.js";

/** @param {import('../life-types').SpaceState} state */
export function nextStep(state, period = currentMonth()) {
  const step = (kind, id = null, month = null) => ({ kind, id, period: month });
  if (!state.joined) return step("invite");
  if (!state.self.shared) return step("share");
  if (!state.bothShared) return step("waiting");
  const role = state.role,
    other = role === "A" ? "B" : "A";
  // Requests in an earlier month must remain reachable after the calendar rolls over.
  const months = [...state.months].sort((a, b) =>
    a.period.localeCompare(b.period),
  );
  for (const month of months) {
    const receipt = currentSettlement(month);
    if (
      month.entries.some(
        (e) => e.kind === "transfer" && !e.confirmed && e.author !== role,
      ) ||
      (receipt && !receipt.receivedAt && receipt.from !== role)
    )
      return step("receipt", null, month.period);
  }
  for (const month of months) {
    if (month.reopen[other] && !month.reopen[role])
      return step("reopen", null, month.period);
    if (
      month.status === "open" &&
      month.approvals[other] &&
      !month.approvals[role]
    )
      return step("month-review", null, month.period);
  }
  if (state.decisions[role] !== "accepted") return step("plan");
  if (state.decisions[other] !== "accepted") return step("plan-waiting");
  const decision = state.householdDecisions.find(
    (x) =>
      x.status === "open" &&
      (!x.answers[role]?.shared ||
        x.stale ||
        (x.bothAnswered &&
          (!x.proposal || x.proposal.approvals[role] !== "accepted"))),
  );
  if (decision) return step("decision", decision.id);
  const month = state.months.find((x) => x.period === period);
  if (
    !month ||
    (month.status === "open" &&
      !month.entries.some((x) => x.kind === "expense"))
  )
    return step("month-start", null, period);
  const review = state.householdReviews.find(
    (x) => x.week === state.currentWeek,
  );
  if (!review?.answers[role]?.shared) return step("check-in");
  if (review.action && !review.action.completed) return step("follow-through");
  return step("current", null, period);
}
