import test from "node:test";
import assert from "node:assert/strict";
import {
  monthTotals,
  splitActual,
  refundable,
  currentSettlement,
  monthOutstanding,
} from "../web/lib/domain/month.js";
const baseline = {
  weights: [2, 1],
  expenses: [{ id: "rent", label: "Rent", amount: 30000 }],
  names: ["A", "B"],
  method: "proportional",
};
const entry = (id, amount, paidA, more = {}) => ({
  id,
  kind: "expense",
  amount,
  paidA,
  categoryId: "rent",
  ...more,
});
const month = (entries, more = {}) => ({
  baseline,
  entries,
  version: 1,
  settlements: [],
  ...more,
});
test("actual costs and reimbursement preserve the shared total", () => {
  const t = monthTotals(
    month([entry("a", 10000, 10000), entry("b", 20000, 0)]),
  );
  assert.equal(t.total, 30000);
  assert.deepEqual(t.shares, [20000, 10000]);
  assert.deepEqual(t.paid, [10000, 20000]);
  assert.equal(t.balance, 10000);
});
test("pending transfers do not settle balances; receipt confirmation does", () => {
  const expense = entry("e", 10000, 10000),
    transfer = entry("t", 3333, 0, { kind: "transfer", confirmed: false });
  const pending = monthTotals(month([expense, transfer]));
  assert.equal(pending.balance, -3333);
  assert.equal(pending.pending, 1);
  const confirmed = monthTotals(
    month([expense, { ...transfer, confirmed: true }]),
  );
  assert.equal(confirmed.balance, 0);
  assert.equal(confirmed.total, 10000);
});
test("refunds reduce spending and credit the actual recipient", () => {
  const t = monthTotals(
    month([
      entry("e", 10000, 10000),
      entry("r", 2500, 0, { kind: "refund", originalId: "e" }),
    ]),
  );
  assert.equal(t.total, 7500);
  assert.deepEqual(t.paid, [10000, -2500]);
  assert.deepEqual(t.shares, [5000, 2500]);
  assert.equal(t.balance, -5000);
  assert.equal(
    refundable(
      [
        entry("e", 10000, 10000),
        entry("r", 2500, 0, { kind: "refund", originalId: "e" }),
      ],
      "e",
    ),
    7500,
  );
});
test("both-person payments and personal transfers conserve net coverage", () => {
  const t = monthTotals(
    month([
      entry("e", 15001, 8000),
      entry("t", 2500, 2500, { kind: "transfer", confirmed: true }),
      entry("u", 700, 0, { kind: "transfer", confirmed: true }),
    ]),
  );
  assert.equal(t.paid[0] + t.paid[1], t.total);
  assert.equal(t.balance, t.shares[0] - 8000 - 2500 + 700);
});
test("custom baseline ratios scale to actual costs, not old dollar contributions", () => {
  const m = month([entry("e", 10001, 10001)], {
    baseline: { ...baseline, method: "custom", weights: [3, 2] },
  });
  assert.deepEqual(monthTotals(m).shares, [6001, 4000]);
});
test("odd cents round once at the aggregate and all splits conserve costs", () => {
  for (const weights of [
    [1, 1],
    [2, 1],
    [0, 1],
    [1, 0],
    [334, 667],
  ])
    for (let value = 0; value < 10000; value += 37) {
      const shares = splitActual(value, weights);
      assert.equal(shares[0] + shares[1], value);
      assert.ok(shares.every((x) => Number.isSafeInteger(x) && x >= 0));
    }
  const t = monthTotals(
    month([entry("a", 1, 1), entry("b", 1, 0)], {
      baseline: { ...baseline, weights: [1, 1] },
    }),
  );
  assert.deepEqual(t.shares, [1, 1]);
});
test("an advance without expenses remains a credit, not spending", () => {
  const t = monthTotals(
    month([entry("t", 10000, 10000, { kind: "transfer", confirmed: true })]),
  );
  assert.equal(t.total, 0);
  assert.equal(t.balance, -10000);
});
test("category overspend and new categories are calculated independently", () => {
  const t = monthTotals(
    month([
      entry("e", 35000, 35000),
      entry("other", 2500, 0, { categoryId: "other" }),
    ]),
  );
  assert.equal(t.categories[0].difference, 5000);
  assert.equal(t.categories[1].planned, 0);
  assert.equal(t.difference, 7500);
});
test("only a received settlement for the current version clears outstanding money", () => {
  const m = month([entry("e", 10000, 10000)], {
    settlements: [
      { version: 1, from: "B", amount: 3333, reportedAt: "2026-11-01" },
    ],
  });
  assert.equal(monthOutstanding(m), -3333);
  m.settlements[0].receivedAt = "2026-11-02";
  assert.equal(monthOutstanding(m), 0);
  m.version = 2;
  assert.equal(currentSettlement(m), undefined);
  assert.equal(monthOutstanding(m), -3333);
});
test("invalid ratios and impossible net refunds fail explicitly", () => {
  assert.throws(() => splitActual(1, [0, 0]));
  assert.throws(() => splitActual(1, [-1, 2]));
  assert.throws(() => splitActual(1.2, [1, 1]));
  assert.throws(() =>
    monthTotals(month([entry("r", 100, 0, { kind: "refund" })])),
  );
});
