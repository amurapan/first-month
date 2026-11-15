/** @typedef {import('../month-types').MonthEntry} Entry */
/** @typedef {import('../month-types').MonthBaseline} Baseline */
/** @typedef {import('../month-types').HouseholdMonth} Month */
export const currentMonth = (now = new Date().toISOString()) => now.slice(0, 7);
export function shiftMonth(period, offset = 1) {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + offset, 1, 12))
    .toISOString()
    .slice(0, 7);
}
export function monthTitle(period) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(period + "-01T12:00:00Z"));
}
/** Split once, preserving every cent. A receives the rounded half-cent. */
export function splitActual(total, weights) {
  if (
    !Number.isSafeInteger(total) ||
    total < 0 ||
    !Array.isArray(weights) ||
    weights.length !== 2 ||
    weights.some((x) => !Number.isSafeInteger(x) || x < 0) ||
    weights[0] + weights[1] === 0
  )
    throw new RangeError(
      "A non-negative total and two valid shares are required.",
    );
  const den = BigInt(weights[0]) + BigInt(weights[1]),
    num = BigInt(total) * BigInt(weights[0]);
  const a = Number((2n * num + den) / (2n * den));
  return [a, total - a];
}
/** Expenses and refunds affect costs; confirmed transfers only settle who covered them.
 * @param {{baseline:Baseline,entries:Entry[]}} month */
export function monthTotals(month) {
  const { baseline, entries } = month;
  const categories = baseline.expenses.map((x) => ({
    id: x.id,
    label: x.label,
    planned: x.amount,
    actual: 0,
    count: 0,
  }));
  const paid = [0, 0],
    sent = [0, 0];
  let total = 0,
    pending = 0;
  for (const e of entries) {
    if (e.kind === "transfer") {
      if (e.confirmed) {
        sent[e.paidA === e.amount ? 0 : 1] += e.amount;
      } else pending++;
      continue;
    }
    const sign = e.kind === "refund" ? -1 : 1;
    total += sign * e.amount;
    paid[0] += sign * e.paidA;
    paid[1] += sign * (e.amount - e.paidA);
    const cat = categories.find((x) => x.id === e.categoryId);
    if (cat) {
      cat.actual += sign * e.amount;
      cat.count++;
    } else
      categories.push({
        id: e.categoryId,
        label: e.categoryId === "other" ? "Other shared costs" : e.title,
        planned: 0,
        actual: sign * e.amount,
        count: 1,
      });
  }
  if (total < 0)
    throw new RangeError("Refunds cannot exceed recorded expenses.");
  const shares = splitActual(total, baseline.weights),
    balance = shares[0] - paid[0] - sent[0] + sent[1];
  const planned = baseline.expenses.reduce((n, x) => n + x.amount, 0);
  return {
    total,
    paid,
    sent,
    shares,
    balance,
    planned,
    difference: total - planned,
    pending,
    categories: categories.map((x) => ({
      ...x,
      difference: x.actual - x.planned,
    })),
    expenseCount: entries.filter((x) => x.kind === "expense").length,
  };
}
/** @param {Month} month */
export function currentSettlement(month) {
  return month.settlements.find((x) => x.version === month.version);
}
/** @param {Month} month */
export function monthOutstanding(month) {
  const s = currentSettlement(month);
  return s?.receivedAt ? 0 : monthTotals(month).balance;
}
/** @param {Entry[]} entries */
export function refundable(entries, id) {
  const e = entries.find((x) => x.id === id && x.kind === "expense");
  return e
    ? e.amount -
        entries
          .filter((x) => x.kind === "refund" && x.originalId === id)
          .reduce((sum, x) => sum + x.amount, 0)
    : 0;
}
/** @param {Month} month */
export function changeMonth(month) {
  month.version++;
  month.approvals = { A: false, B: false };
  month.reopen = {};
  month.updatedAt = new Date().toISOString();
}
