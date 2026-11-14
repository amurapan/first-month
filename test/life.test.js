import test from "node:test";
import assert from "node:assert/strict";
import {
  savingsSchedule,
  decisionImpact,
  weekStart,
  bothAnswersShared,
  redactAnswers,
  approvalTransition,
  resetProposal,
  decisionStale,
} from "../web/lib/domain/life.js";
const input = {
  amount: 90001,
  kind: "purchase",
  months: 3,
  method: "proportional",
  incomes: [600000, 300000],
  baseRemaining: [283333, 156667],
  refined: [true, true],
  reserves: [200000, 120000],
  limits: [60000, 25000],
};
test("saving schedules preserve every cent for every supported period", () => {
  for (const cents of [0, 1, 101, 90001, 100000000])
    for (let months = 1; months <= 24; months++) {
      const s = savingsSchedule(cents, months);
      assert.equal(s.length, months);
      assert.equal(
        s.reduce((a, b) => a + b, 0),
        cents,
      );
      assert.ok(Math.max(...s) - Math.min(...s) <= 1);
    }
});
test("a purchase compares monthly saving with personal preferences and comfort amounts", () => {
  const x = decisionImpact(input);
  assert.deepEqual(x.contributions, [60001, 30000]);
  assert.deepEqual(x.firstMonth, [20001, 10000]);
  assert.deepEqual(x.remaining, [263332, 146667]);
  assert.deepEqual(x.preferenceMet, [true, true]);
  assert.deepEqual(x.withinLimit, [true, true]);
  const now = decisionImpact({ ...input, months: 1 });
  assert.deepEqual(now.withinLimit, [false, false]);
});
test("missing personal costs and unknown comfort amounts are not treated as satisfied", () => {
  const x = decisionImpact({
    ...input,
    refined: [false, true],
    limits: [null, 0],
  });
  assert.equal(x.preferenceMet[0], null);
  assert.deepEqual(x.withinLimit, [null, false]);
});
test("a recurring expense cannot be spread across a saving period", () => {
  assert.throws(
    () => decisionImpact({ ...input, kind: "recurring" }),
    RangeError,
  );
  assert.equal(
    decisionImpact({ ...input, kind: "recurring", months: 1 }).firstMonth[0],
    60001,
  );
});
test("invalid amount, period, split, and zero combined income are rejected", () => {
  for (const months of [0, 1.5, 25])
    assert.throws(() => decisionImpact({ ...input, months }), RangeError);
  assert.throws(() => decisionImpact({ ...input, amount: -1 }), RangeError);
  assert.throws(
    () => decisionImpact({ ...input, incomes: [0, 0] }),
    RangeError,
  );
  assert.throws(
    () => decisionImpact({ ...input, method: "custom", customA: 999999 }),
    RangeError,
  );
});
test("weeks are stable across Sundays and year boundaries", () => {
  assert.equal(weekStart(new Date("2026-11-15T23:59:59Z")), "2026-11-09");
  assert.equal(weekStart(new Date("2026-11-16T00:00:00Z")), "2026-11-16");
  assert.equal(weekStart(new Date("2027-01-01T12:00:00Z")), "2026-12-28");
});
function item() {
  return {
    status: "open",
    answers: {
      A: { shared: true, note: "private A", limit: 111 },
      B: { shared: false, note: "private B", limit: 222 },
    },
    proposal: {
      version: 3,
      planVersion: 5,
      approvals: { A: "pending", B: "pending" },
    },
  };
}
test("private peer answers are absent, including when only one person shared", () => {
  const d = item();
  assert.equal(bothAnswersShared(d), false);
  assert.deepEqual(redactAnswers(d, "A", false).B, {
    submitted: true,
    shared: false,
  });
  assert.equal(redactAnswers(d, "B", false).B.note, "private B");
  assert.equal("note" in redactAnswers(d, "B", false).A, false);
});
test("both people must approve the exact proposal using the current monthly plan", () => {
  const d = item();
  assert.throws(() => approvalTransition(d, "A", "accepted", 5, 3), RangeError);
  d.answers.B.shared = true;
  const one = approvalTransition(d, "A", "accepted", 5, 3);
  assert.equal(one.status, "open");
  assert.equal(d.proposal.approvals.A, "pending");
  const two = approvalTransition(one, "B", "accepted", 5, 3);
  assert.equal(two.status, "agreed");
  assert.throws(
    () => approvalTransition(two, "B", "accepted", 6, 3),
    RangeError,
  );
  assert.throws(
    () => approvalTransition(two, "B", "accepted", 5, 2),
    RangeError,
  );
  assert.equal(approvalTransition(two, "A", "changes", 5, 3).status, "open");
});
test("changing an answer invalidates approvals and changes the proposal version", () => {
  const d = item();
  d.status = "agreed";
  d.guide = { text: "old" };
  resetProposal(d);
  assert.equal(d.proposal.version, 4);
  assert.deepEqual(d.proposal.approvals, { A: "pending", B: "pending" });
  assert.equal(d.status, "open");
  assert.equal(d.guide, undefined);
  assert.equal(decisionStale(d, 6), true);
  d.status = "completed";
  assert.equal(decisionStale(d, 6), false);
});
