import test from "node:test";
import assert from "node:assert/strict";
import { previewBudget, inputCents } from "../web/lib/domain/preview.js";

test("unknown income permits equal contributions without inventing a partner remainder", () => {
  const result = previewBudget({
    incomeCents: 600000,
    partnerIncomeCents: null,
    sharedCents: 340001,
  });
  assert.deepEqual(result.contributionsCents, [170001, 170000]);
  assert.deepEqual(result.remainingAfterSharedCents, [429999, null]);
  assert.equal(result.partnerIncomeKnown, false);
  assert.throws(
    () =>
      previewBudget({
        incomeCents: 600000,
        partnerIncomeCents: null,
        sharedCents: 340000,
        method: "proportional",
      }),
    RangeError,
  );
});

test("confirmed zero income is different from unknown income", () => {
  const input = {
    incomeCents: 600000,
    partnerIncomeCents: 0,
    sharedCents: 340000,
  };
  assert.deepEqual(
    previewBudget(input).remainingAfterSharedCents,
    [430000, -170000],
  );
  const result = previewBudget({ ...input, method: "proportional" });
  assert.deepEqual(result.contributionsCents, [340000, 0]);
  assert.equal(result.partnerIncomeKnown, true);
  assert.throws(
    () => previewBudget({ ...input, incomeCents: 0, method: "proportional" }),
    RangeError,
  );
});

test("preliminary proportional allocations preserve the total and negative remainders", () => {
  const result = previewBudget({
    incomeCents: 100,
    partnerIncomeCents: 200,
    sharedCents: 401,
    method: "proportional",
  });
  assert.deepEqual(result.contributionsCents, [134, 267]);
  assert.deepEqual(result.remainingAfterSharedCents, [-34, -67]);
  assert.throws(
    () =>
      previewBudget({
        incomeCents: 100,
        partnerIncomeCents: 200,
        sharedCents: 10,
        method: "custom",
      }),
    RangeError,
  );
});

test("dollar inputs preserve cents and reject missing, negative, excessive or fractional-cent amounts", () => {
  assert.equal(inputCents("0"), 0);
  assert.equal(inputCents("1.01"), 101);
  assert.equal(inputCents(" 3400.5 "), 340050);
  assert.equal(inputCents("1000000"), 100000000);
  for (const value of [
    "",
    " ",
    "-1",
    "1.001",
    "1e3",
    "Infinity",
    "1000000.01",
    null,
    undefined,
  ])
    assert.throws(() => inputCents(value), RangeError);
});
