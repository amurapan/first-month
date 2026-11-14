// USD amounts are integer cents. Allocation is arithmetic, not a fairness verdict.
const MAX_CENTS = 1_000_000_000_000;

function money(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_CENTS) {
    throw new RangeError(`${label} must be a non-negative integer in cents, at most ${MAX_CENTS}`);
  }
  return value;
}

function pair(values, label) {
  if (!Array.isArray(values) || values.length !== 2) {
    throw new TypeError(`${label} must contain exactly two amounts`);
  }
  return values.map((value, index) => money(value, `${label}[${index}]`));
}

function roundedRatio(numerator, denominator) {
  // BigInt avoids floating-point multiplication errors; ties round up for A.
  return Number((2n * numerator + denominator) / (2n * denominator));
}

export function calculateBudget({
  sharedCents,
  incomeCents,
  personalCommitmentsCents = [0, 0],
  minimumRemainingCents = [0, 0],
  method = 'equal',
  customContributionsCents,
}) {
  const total = money(sharedCents, 'sharedCents');
  const incomes = pair(incomeCents, 'incomeCents');
  const personal = pair(personalCommitmentsCents, 'personalCommitmentsCents');
  const minimums = pair(minimumRemainingCents, 'minimumRemainingCents');
  let contributions;

  if (method === 'equal') {
    const first = Math.ceil(total / 2);
    contributions = [first, total - first];
  } else if (method === 'proportional') {
    const combined = BigInt(incomes[0]) + BigInt(incomes[1]);
    if (combined === 0n && total > 0) {
      throw new RangeError('Income-based splitting needs positive combined income; choose fixed contributions instead.');
    }
    const first = combined === 0n ? 0 : roundedRatio(BigInt(total) * BigInt(incomes[0]), combined);
    contributions = [first, total - first];
  } else if (method === 'custom') {
    contributions = pair(customContributionsCents, 'customContributionsCents');
    if (contributions[0] + contributions[1] !== total) {
      throw new RangeError('Custom contributions must add up to shared expenses.');
    }
  } else {
    throw new RangeError('Unknown split method.');
  }

  // Personal commitments affect remaining money, not the income-based ratio.
  const remaining = incomes.map((income, i) => income - personal[i] - contributions[i]);
  return {
    method,
    sharedCents: total,
    contributionsCents: contributions,
    remainingCents: remaining,
    minimumRemainingMet: remaining.map((amount, i) => amount >= minimums[i]),
    exceedsIncome: remaining.map(amount => amount < 0),
  };
}
