import { calculateBudget } from "./budget.js";

// Interpretation of entered amounts only. Unknown data never becomes a zero or an affordability claim.
export function splitInsight({
  incomes,
  total,
  method,
  contributions,
  remaining,
  personal = [0, 0],
  reserves = [0, 0],
  refined = [false, false],
}) {
  const known = incomes.every((x) => x !== null);
  const deficits = remaining.map((x) => (x === null ? null : Math.max(0, -x)));
  const gaps = remaining.map((x, i) =>
    x === null || !refined[i] ? null : Math.max(0, reserves[i] - x),
  );
  const percentages = incomes.map((x, i) =>
    x === null || x === 0 ? null : (contributions[i] * 100) / x,
  );
  const capacity = known
    ? incomes.reduce((n, x, i) => n + x - (refined[i] ? personal[i] : 0), 0)
    : null;
  let alternativeCovers = false;
  if (known && method === "equal" && incomes[0] + incomes[1] > 0) {
    const other = calculateBudget({
      sharedCents: total,
      incomeCents: incomes,
      personalCommitmentsCents: personal.map((x, i) => (refined[i] ? x : 0)),
      minimumRemainingCents: reserves,
      method: "proportional",
    });
    alternativeCovers =
      other.remainingCents.every((x) => x >= 0) &&
      other.contributionsCents.some((x, i) => x !== contributions[i]);
  }
  return {
    status: deficits.some((x) => x > 0)
      ? "shortfall"
      : gaps.some((x) => x > 0)
        ? "preference"
        : !known
          ? "unknown"
          : total === 0
            ? "zero"
            : method === "equal" && incomes[0] !== incomes[1]
              ? "different"
              : "covered",
    deficits,
    gaps,
    percentages,
    alternativeCovers,
    combinedShortfall: capacity === null ? null : Math.max(0, total - capacity),
    incomplete: refined.some((x) => !x),
  };
}
