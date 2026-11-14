import { calculateBudget } from "./budget.js";

export function weekStart(date = new Date()) {
  const d = new Date(date);
  if (!Number.isFinite(d.getTime()))
    throw new RangeError("Choose a valid date.");
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export function savingsSchedule(cents, months) {
  if (
    !Number.isSafeInteger(cents) ||
    cents < 0 ||
    !Number.isInteger(months) ||
    months < 1 ||
    months > 24
  )
    throw new RangeError("Choose a valid amount and saving period.");
  const base = Math.floor(cents / months),
    extra = cents % months;
  return Array.from({ length: months }, (_, i) => base + (i < extra ? 1 : 0));
}
/** @param {{amount:number, kind:string, months?:number, method?:string, customA?:number, incomes:number[], baseRemaining:number[], refined:boolean[], reserves:number[], limits?:(number|null)[]}} input */
export function decisionImpact({
  amount,
  kind,
  months = 1,
  method = "equal",
  customA = 0,
  incomes,
  baseRemaining,
  refined,
  reserves,
  limits = [null, null],
}) {
  if (!Number.isInteger(months) || months < 1 || months > 24)
    throw new RangeError("Choose between 1 and 24 months.");
  if (kind !== "purchase" && kind !== "recurring")
    throw new RangeError("Choose a purchase or a recurring cost.");
  if (kind === "recurring" && months !== 1)
    throw new RangeError("Recurring costs apply in full every month.");
  for (const values of [baseRemaining, refined, reserves, limits])
    if (!Array.isArray(values) || values.length !== 2)
      throw new RangeError("Both sides of the budget are needed.");
  const result = calculateBudget({
    sharedCents: amount,
    incomeCents: incomes,
    method,
    customContributionsCents: [customA, amount - customA],
  });
  const schedule = result.contributionsCents.map((value) =>
    savingsSchedule(value, months),
  );
  const firstMonth = schedule.map((values) => values[0]);
  const remaining = baseRemaining.map((value, i) => value - firstMonth[i]);
  return {
    contributions: result.contributionsCents,
    schedule,
    firstMonth,
    remaining,
    preferenceMet: remaining.map((value, i) =>
      refined[i] === false ? null : value >= reserves[i],
    ),
    withinLimit: firstMonth.map((value, i) =>
      limits[i] === null ? null : value <= limits[i],
    ),
  };
}
export function bothAnswersShared(item) {
  return !!item.answers.A?.shared && !!item.answers.B?.shared;
}
export function redactAnswers(item, role, visible) {
  const result = {};
  for (const side of ["A", "B"]) {
    const answer = item.answers[side];
    if (answer)
      result[side] =
        side === role || visible
          ? answer
          : { submitted: true, shared: answer.shared };
  }
  return result;
}
export function decisionStale(item, planVersion) {
  return (
    !!item.proposal &&
    item.proposal.planVersion !== planVersion &&
    !["completed", "archived"].includes(item.status)
  );
}
export function resetProposal(item) {
  if (item.proposal) {
    item.proposal.approvals = { A: "pending", B: "pending" };
    item.proposal.version += 1;
  }
  if (item.status === "agreed") item.status = "open";
  delete item.guide;
}
export function approvalTransition(
  item,
  role,
  value,
  planVersion,
  proposalVersion,
) {
  if (!["A", "B"].includes(role) || !["accepted", "changes"].includes(value))
    throw new RangeError("Choose a valid response.");
  if (!item.proposal || item.proposal.version !== proposalVersion)
    throw new RangeError("The proposal changed. Review it again.");
  if (item.proposal.planVersion !== planVersion)
    throw new RangeError(
      "Your monthly plan changed. Update this proposal before agreeing.",
    );
  if (!bothAnswersShared(item))
    throw new RangeError("Both people need to share their decision answers.");
  if (["completed", "archived"].includes(item.status))
    throw new RangeError("Reopen this decision before changing it.");
  const next = structuredClone(item);
  next.proposal.approvals[role] = value;
  next.status = Object.values(next.proposal.approvals).every(
    (x) => x === "accepted",
  )
    ? "agreed"
    : "open";
  return next;
}
