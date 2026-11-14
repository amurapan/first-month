import { calculateBudget } from "./budget.js";
import { savingsSchedule } from "./life.js";

/** @typedef {import('../life-types').HouseholdDecision | import('../life-types').DecisionView} Decision */
/** @typedef {{incomes:number[],baseRemaining:number[],refined:boolean[],reserves:number[],limits:(number|null)[],decisions:Decision[],expenseIds:string[],item:Decision,asOf?:string}} PlanningInput */
export const planningMonth = (date = new Date().toISOString()) =>
  date.slice(0, 7);
const monthNumber = (date) =>
  Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
export function monthLabel(offset = 0, asOf = new Date().toISOString()) {
  const n = monthNumber(asOf) + offset;
  return monthFormatter.format(
    new Date(Date.UTC(Math.floor(n / 12), n % 12, 1)),
  );
}
/** @param {Decision} item */
export function activeResolution(item) {
  if (
    item.status === "completed" ||
    item.status === "archived" ||
    item.activeResolutionVersion === null
  )
    return null;
  return (
    item.resolutions.find((x) => x.version === item.activeResolutionVersion) ||
    item.resolutions.at(-1) ||
    null
  );
}
/** Project obligations from the accepted shares, never from today's income split. */
/** @param {{contributions:number[],months:number,at:string,funding?:Partial<Record<string,number>>,fundingMonth?:string,fundedThisMonth?:Partial<Record<string,number>>,asOf?:string}} input */
export function fundingProjection({
  contributions,
  months,
  at,
  funding = {},
  fundingMonth,
  fundedThisMonth = {},
  asOf = new Date().toISOString(),
}) {
  const elapsed = Math.max(0, monthNumber(asOf) - monthNumber(at));
  const periods = Math.max(1, months - elapsed);
  const current = planningMonth(asOf);
  const schedules = contributions.map((target, i) => {
    const side = i === 0 ? "A" : "B",
      saved = funding[side] || 0,
      net = fundingMonth === current ? fundedThisMonth[side] || 0 : 0;
    const paid = Math.max(0, net),
      prior = Math.max(0, Math.min(saved, saved - net)),
      outstanding = Math.max(0, target - prior);
    const schedule = savingsSchedule(outstanding, periods);
    // Already reported money consumes this month's allocation even when it
    // exceeds the original target. It never becomes new income after a correction.
    const first = Math.max(schedule[0], paid);
    return [
      first,
      ...(periods > 1
        ? savingsSchedule(Math.max(0, outstanding - first), periods - 1)
        : []),
    ];
  });
  return {
    schedules,
    overdue:
      elapsed >= months &&
      contributions.some((v, i) => v > (funding[i ? "B" : "A"] || 0)),
    remaining: contributions.map((v, i) =>
      Math.max(0, v - (funding[i ? "B" : "A"] || 0)),
    ),
    excess: contributions.map((v, i) =>
      Math.max(0, (funding[i ? "B" : "A"] || 0) - v),
    ),
  };
}
/** @param {Decision[]} decisions @param {string[]} expenseIds */
export function commitmentLedger(
  decisions,
  expenseIds = [],
  excludeId = "",
  asOf = new Date().toISOString(),
) {
  const rows = [];
  const totals = Array.from({ length: 24 }, () => [0, 0]);
  for (const item of decisions) {
    if (item.id === excludeId) continue;
    const accepted = activeResolution(item);
    let schedules,
      overdue = false;
    if (accepted) {
      if (item.kind === "recurring") {
        if (expenseIds.includes("decision:" + item.id)) continue;
        schedules = accepted.contributions.map((value) =>
          Array(24).fill(value),
        );
      } else {
        const projected = fundingProjection({
          ...accepted,
          funding: item.funding,
          fundingMonth: item.fundingMonth,
          fundedThisMonth: item.fundedThisMonth,
          asOf,
        });
        schedules = projected.schedules;
        overdue = projected.overdue;
      }
    } else if (
      item.kind === "purchase" &&
      item.status === "completed" &&
      item.completedAt &&
      planningMonth(item.completedAt) === planningMonth(asOf)
    ) {
      const settled = item.resolutions.at(-1);
      if (!settled) continue;
      // Savings were already set aside. Completion does not spend income twice.
      schedules = settled.contributions.map((v, i) => [
        settled.months === 1
          ? v
          : item.fundingMonth === planningMonth(asOf)
            ? Math.max(0, item.fundedThisMonth?.[i ? "B" : "A"] || 0)
            : 0,
      ]);
    } else {
      // Cancelled goals can still contain money set aside in the current month.
      if (item.fundingMonth !== planningMonth(asOf)) continue;
      schedules = ["A", "B"].map((side) => [
        Math.max(0, item.fundedThisMonth?.[side] || 0),
      ]);
    }
    const allocations = totals.map((_, m) => [
      schedules[0][m] || 0,
      schedules[1][m] || 0,
    ]);
    if (!allocations.some((pair) => pair.some((x) => x > 0))) continue;
    allocations.forEach((pair, m) =>
      pair.forEach((value, i) => (totals[m][i] += value)),
    );
    rows.push({
      id: item.id,
      title: item.title,
      kind: item.kind,
      allocations,
      overdue,
      completed: item.status === "completed",
      retained: !!accepted && item.status !== "agreed",
    });
  }
  const key =
    planningMonth(asOf) +
    ":" +
    JSON.stringify(
      rows
        .map((r) => [r.id, r.allocations])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    );
  return { rows, totals, key };
}
/** @param {PlanningInput} input @param {{amount:number,months:number,method:string,customA?:number}} option @param {import('../life-types').DecisionResolution | null} [agreement] */
export function projectOption(input, option, agreement = null) {
  const asOf = input.asOf || new Date().toISOString();
  if (
    option.months < 1 ||
    option.months > 24 ||
    !Number.isInteger(option.months)
  )
    throw new RangeError("Choose a period from 1 to 24 months.");
  if (input.item.kind === "recurring" && option.months !== 1)
    throw new RangeError("Recurring costs apply every month.");
  const split = agreement
    ? { contributionsCents: agreement.contributions }
    : calculateBudget({
        sharedCents: option.amount,
        incomeCents: input.incomes,
        method: option.method,
        customContributionsCents: [
          option.customA || 0,
          option.amount - (option.customA || 0),
        ],
      });
  const ledger = commitmentLedger(
    input.decisions,
    input.expenseIds,
    input.item.id,
    asOf,
  );
  const contributions = agreement?.contributions || split.contributionsCents;
  const funded = fundingProjection({
    contributions,
    months: option.months,
    at: agreement?.at || asOf,
    funding: input.item.funding,
    fundingMonth: input.item.fundingMonth,
    fundedThisMonth: input.item.fundedThisMonth,
    asOf,
  });
  const schedule =
    input.item.kind === "recurring"
      ? contributions.map((v) => Array(24).fill(v))
      : funded.schedules;
  const timeline = ledger.totals.map((other, m) => ({
    label: monthLabel(m, asOf),
    other,
    option: contributions.map((_, i) => schedule[i][m] || 0),
    remaining: input.baseRemaining.map(
      (v, i) => v - other[i] - (schedule[i][m] || 0),
    ),
  }));
  const preferenceMet = input.refined.map((known, i) =>
    known
      ? timeline.every((row) => row.remaining[i] >= input.reserves[i])
      : null,
  );
  const withinLimit = input.limits.map((limit, i) =>
    limit === null ? null : schedule[i].every((v) => v <= limit),
  );
  const negative = timeline.some((row) => row.remaining.some((v) => v < 0));
  const strained =
    negative || preferenceMet.includes(false) || withinLimit.includes(false);
  const status = strained
    ? "strained"
    : preferenceMet.includes(null) || withinLimit.includes(null)
      ? "incomplete"
      : "fits";
  return {
    ...option,
    customA: option.customA || 0,
    contributions,
    schedule,
    overdue: funded.overdue,
    firstMonth: timeline[0].option,
    remaining: timeline[0].remaining,
    timeline,
    preferenceMet,
    withinLimit,
    status,
    ledger,
    excess: funded.excess,
    stillToFund: funded.remaining,
  };
}
/** The accepted plan keeps its original shares and end month as time passes.
 * @param {PlanningInput} input */
export function projectAgreement(input) {
  const agreement = activeResolution(input.item);
  if (!input.item.proposal) throw new Error("No proposal to project.");
  return projectOption(input, agreement || input.item.proposal, agreement);
}
/** @param {PlanningInput} input */
export function decisionOptions(input) {
  const amount = input.item.amount;
  const method = input.incomes.some((v) => v > 0) ? "proportional" : "equal";
  const now = projectOption(input, { amount, months: 1, method });
  let saving = null;
  if (input.item.kind === "purchase") {
    for (let months = 2; months <= 24; months++) {
      const next = projectOption(input, { amount, months, method });
      saving = next;
      if (next.status !== "strained") break;
    }
  }
  // The ceiling is solved against both partners' declared constraints, with
  // exact cents and all other accepted commitments included.
  let lo = 0,
    hi = amount;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const p = projectOption(input, { amount: mid, months: 1, method });
    if (p.status !== "strained") lo = mid;
    else hi = mid - 1;
  }
  const lower =
    lo < amount
      ? projectOption(input, { amount: lo, months: 1, method })
      : null;
  const options = [
    {
      id: "now",
      title:
        input.item.kind === "recurring" ? "Add it monthly" : "Buy in one month",
      ...now,
    },
  ];
  if (saving)
    options.push({
      id: "save",
      title: "Save over " + saving.months + " months",
      ...saving,
    });
  if (lower && lower.amount > 0)
    options.push({ id: "lower", title: "Choose a lower price", ...lower });
  else {
    const otherMethod =
      method === "proportional"
        ? "equal"
        : input.incomes.some((v) => v > 0)
          ? "proportional"
          : null;
    if (otherMethod) {
      const alternative = projectOption(input, {
        amount,
        months: 1,
        method: otherMethod,
      });
      if (alternative.contributions.some((v, i) => v !== now.contributions[i]))
        options.push({
          id: "split",
          title:
            otherMethod === "equal" ? "Split it equally" : "Split by income",
          ...alternative,
        });
    }
  }
  const suggested =
    options.find(
      (x) =>
        x.status === "fits" &&
        (x.id !== "now" ||
          !Object.values(input.item.answers).some(
            (x) => "timing" in x && x.timing === "save",
          )),
    ) ||
    options.find((x) => x.status === "fits") ||
    null;
  return {
    options,
    suggestedId: suggested?.id || null,
    noRoom: lo === 0 && amount > 0,
    ledger: now.ledger,
  };
}
