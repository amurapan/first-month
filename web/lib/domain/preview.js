import { calculateBudget } from "./budget.js";

// Unknown partner income is different from a confirmed zero income.
export function previewBudget({
  incomeCents,
  partnerIncomeCents,
  sharedCents,
  method = "equal",
}) {
  if (!["equal", "proportional"].includes(method))
    throw new RangeError("Choose equal or income-based contributions.");
  const known = partnerIncomeCents !== null;
  if (method === "proportional" && !known)
    throw new RangeError(
      "Add an estimate of your partner’s income to compare an income-based split.",
    );
  const result = calculateBudget({
    sharedCents,
    incomeCents: [incomeCents, known ? partnerIncomeCents : 0],
    method,
    customContributionsCents: undefined,
  });
  return {
    contributionsCents: result.contributionsCents,
    remainingAfterSharedCents: [
      result.remainingCents[0],
      known ? result.remainingCents[1] : null,
    ],
    partnerIncomeKnown: known,
  };
}

export function inputCents(value) {
  const raw = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(raw))
    throw new RangeError(
      "Enter a dollar amount with up to two decimal places.",
    );
  const [whole, decimal = ""] = raw.split(".");
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > 100_000_000)
    throw new RangeError("Use an amount of $1,000,000 or less.");
  return cents;
}
