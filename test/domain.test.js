import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBudget } from '../src/domain/budget.js';
import { createReview, reviseReview, recordDecision } from '../src/domain/review.js';

const initial = {
  sharedCents: 340_000,
  incomeCents: [600_000, 300_000],
  personalCommitmentsCents: [90_000, 30_000],
  minimumRemainingCents: [200_000, 120_000],
};

test('equal contributions can fail one partner’s stated constraint', () => {
  const result = calculateBudget(initial);
  assert.deepEqual(result.contributionsCents, [170_000, 170_000]);
  assert.deepEqual(result.remainingCents, [340_000, 100_000]);
  assert.deepEqual(result.minimumRemainingMet, [true, false]);
});

test('proportional contributions preserve the total to the cent', () => {
  const result = calculateBudget({ ...initial, method: 'proportional' });
  assert.deepEqual(result.contributionsCents, [226_667, 113_333]);
  assert.deepEqual(result.remainingCents, [283_333, 156_667]);
  assert.deepEqual(result.minimumRemainingMet, [true, true]);
});

test('an income change can invalidate a previously feasible method', () => {
  const result = calculateBudget({ ...initial, incomeCents: [600_000, 240_000], method: 'proportional' });
  assert.deepEqual(result.contributionsCents, [242_857, 97_143]);
  assert.deepEqual(result.minimumRemainingMet, [true, false]);
});

test('a custom arrangement is evaluated without being labelled fair', () => {
  const result = calculateBudget({ ...initial, incomeCents: [600_000, 240_000], method: 'custom', customContributionsCents: [250_000, 90_000] });
  assert.deepEqual(result.remainingCents, [260_000, 120_000]);
  assert.deepEqual(result.minimumRemainingMet, [true, true]);
  assert.equal('fair' in result, false);
});

test('personal debts do not silently alter income-based shares', () => {
  const before = calculateBudget({ ...initial, method: 'proportional' });
  const after = calculateBudget({ ...initial, personalCommitmentsCents: [150_000, 0], method: 'proportional' });
  assert.deepEqual(before.contributionsCents, after.contributionsCents);
  assert.notDeepEqual(before.remainingCents, after.remainingCents);
});

test('one zero income is supported without division errors', () => {
  const result = calculateBudget({ sharedCents: 100, incomeCents: [0, 200], method: 'proportional' });
  assert.deepEqual(result.contributionsCents, [0, 100]);
});

test('two zero incomes need an explicit alternative for positive expenses', () => {
  assert.throws(() => calculateBudget({ sharedCents: 100, incomeCents: [0, 0], method: 'proportional' }), /positive combined income/);
  const fixed = calculateBudget({ sharedCents: 100, incomeCents: [0, 0], method: 'custom', customContributionsCents: [50, 50] });
  assert.deepEqual(fixed.exceedsIncome, [true, true]);
});

test('zero expenses and zero incomes produce finite zero amounts', () => {
  const result = calculateBudget({ sharedCents: 0, incomeCents: [0, 0], method: 'proportional' });
  assert.deepEqual(result.contributionsCents, [0, 0]);
  assert.deepEqual(result.remainingCents, [0, 0]);
});

test('odd-cent totals are preserved for equal and proportional splits', () => {
  for (const method of ['equal', 'proportional']) {
    const result = calculateBudget({ sharedCents: 101, incomeCents: [100, 100], method });
    assert.deepEqual(result.contributionsCents, [51, 50]);
  }
});

test('invalid inputs and mismatched custom totals are rejected', () => {
  for (const value of [-1, 1.5, NaN, Infinity, '100', 1_000_000_000_001]) {
    assert.throws(() => calculateBudget({ ...initial, sharedCents: value }), RangeError);
  }
  assert.throws(() => calculateBudget({ ...initial, method: 'custom', customContributionsCents: [1, 2] }), /add up/);
  assert.throws(() => calculateBudget({ ...initial, incomeCents: [1] }), TypeError);
  assert.throws(() => calculateBudget({ ...initial, method: 'automatic-fairness' }), /Unknown/);
});

test('allocations remain non-negative and sum exactly across rounding boundaries', () => {
  for (const total of [0, 1, 2, 101, 340_001, 999_999_999_999]) {
    for (const incomes of [[1, 3], [3, 7], [999_999_999_999, 1], [17, 19]]) {
      const { contributionsCents: amounts } = calculateBudget({ sharedCents: total, incomeCents: incomes, method: 'proportional' });
      assert.equal(amounts[0] + amounts[1], total);
      assert.ok(amounts.every(value => Number.isSafeInteger(value) && value >= 0));
    }
  }
});

test('acceptance by one partner alone never finalizes the plan', () => {
  const review = createReview({ sharedCents: 340_000 });
  const updated = recordDecision(review, 'A', 'accepted', 1);
  assert.equal(updated.status, 'awaiting_review');
  assert.equal(review.decisions.A, 'pending');
});

test('both partners must accept the same version', () => {
  let review = createReview({ sharedCents: 340_000 });
  review = recordDecision(review, 'A', 'accepted', 1);
  review = recordDecision(review, 'B', 'accepted', 1);
  assert.equal(review.status, 'agreed');
});

test('any draft revision clears both approvals and rejects stale acceptance', () => {
  let review = createReview({ sharedCents: 340_000 });
  review = recordDecision(review, 'A', 'accepted', 1);
  review = recordDecision(review, 'B', 'accepted', 1);
  const changed = reviseReview(review, { sharedCents: 280_000 }, 1);
  assert.equal(changed.version, 2);
  assert.deepEqual(changed.decisions, { A: 'pending', B: 'pending' });
  assert.equal(changed.status, 'awaiting_review');
  assert.throws(() => recordDecision(changed, 'A', 'accepted', 1), /plan changed/);
  assert.throws(() => reviseReview(changed, {}, 1), /plan changed/);
});

test('a partner can request changes to an accepted plan', () => {
  let review = createReview({ sharedCents: 340_000 });
  review = recordDecision(review, 'A', 'accepted', 1);
  review = recordDecision(review, 'B', 'accepted', 1);
  review = recordDecision(review, 'B', 'needs_changes', 1);
  assert.equal(review.status, 'needs_changes');
});

test('unknown roles and decisions are rejected', () => {
  const review = createReview({});
  assert.throws(() => recordDecision(review, 'C', 'accepted', 1), /Unknown partner/);
  assert.throws(() => recordDecision(review, 'A', 'accepted-for-both', 1), /Unknown decision/);
});
