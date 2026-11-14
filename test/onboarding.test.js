import test from "node:test";
import assert from "node:assert/strict";
import { splitInsight } from "../web/lib/domain/insight.js";
import { nextStep } from "../web/lib/domain/next-step.js";
const amounts = {
  incomes: [300000, 600000],
  total: 400000,
  method: "equal",
  contributions: [200000, 200000],
  remaining: [100000, 400000],
};
test("unknown income and zero income stay distinct, without invented percentages", () => {
  const unknown = splitInsight({
    ...amounts,
    incomes: [300000, null],
    remaining: [100000, null],
  });
  assert.equal(unknown.status, "unknown");
  assert.equal(unknown.percentages[1], null);
  assert.equal(unknown.combinedShortfall, null);
  const zero = splitInsight({
    ...amounts,
    incomes: [300000, 0],
    remaining: [100000, -200000],
  });
  assert.equal(zero.status, "shortfall");
  assert.equal(zero.percentages[1], null);
  assert.equal(zero.combinedShortfall, 100000);
});
test("changing a split is offered only when it actually closes both entered shortfalls", () => {
  const gap = splitInsight({
    ...amounts,
    incomes: [100000, 600000],
    remaining: [-100000, 400000],
  });
  assert.equal(gap.alternativeCovers, true);
  const impossible = splitInsight({
    ...amounts,
    incomes: [100000, 200000],
    remaining: [-100000, 0],
  });
  assert.equal(impossible.alternativeCovers, false);
  assert.equal(impossible.combinedShortfall, 100000);
  const personal = splitInsight({
    ...amounts,
    personal: [250000, 0],
    refined: [true, true],
    remaining: [-150000, 400000],
  });
  assert.equal(personal.alternativeCovers, false);
});
test("personal preferences are distinct from income deficits and unfilled personal data", () => {
  const data = { ...amounts, reserves: [150000, 450000] };
  assert.equal(splitInsight(data).status, "different");
  const refined = splitInsight({ ...data, refined: [true, true] });
  assert.equal(refined.status, "preference");
  assert.deepEqual(refined.gaps, [50000, 50000]);
  assert.equal(
    splitInsight({
      ...amounts,
      total: 0,
      contributions: [0, 0],
      remaining: amounts.incomes,
    }).status,
    "zero",
  );
  assert.equal(
    splitInsight({ ...amounts, incomes: [300000, 300000] }).status,
    "covered",
  );
});
test("odd cents and zero shared costs do not generate false shortfalls", () => {
  const r = splitInsight({
    incomes: [200, 200],
    total: 101,
    method: "equal",
    contributions: [51, 50],
    remaining: [149, 150],
  });
  assert.equal(r.status, "covered");
  assert.equal(r.alternativeCovers, false);
  assert.deepEqual(r.deficits, [0, 0]);
});
const state = () => ({
  joined: true,
  self: { shared: true },
  partner: {},
  role: "A",
  bothShared: true,
  decisions: { A: "accepted", B: "accepted" },
  months: [],
  householdDecisions: [],
  householdReviews: [],
  currentWeek: "2026-11-09",
});
const month = (period) => ({
  period,
  version: 1,
  status: "open",
  entries: [],
  settlements: [],
  approvals: { A: false, B: false },
  reopen: {},
});
test("onboarding has one next step without sharing or accepting on behalf of a partner", () => {
  assert.equal(
    nextStep({ ...state(), joined: false, self: { shared: false } }).kind,
    "invite",
  );
  assert.equal(nextStep({ ...state(), self: { shared: false } }).kind, "share");
  assert.equal(nextStep({ ...state(), bothShared: false }).kind, "waiting");
  assert.equal(
    nextStep({ ...state(), decisions: { A: "pending", B: "accepted" } }).kind,
    "plan",
  );
  assert.equal(
    nextStep({ ...state(), decisions: { A: "accepted", B: "pending" } }).kind,
    "plan-waiting",
  );
});
test("old incoming transfers outrank new month prompts; an author is never asked to confirm receipt", () => {
  const old = month("2026-10");
  old.entries = [{ kind: "transfer", author: "B", confirmed: false }];
  const s = { ...state(), months: [month("2026-11"), old] };
  assert.deepEqual(nextStep(s, "2026-11"), {
    kind: "receipt",
    id: null,
    period: "2026-10",
  });
  old.entries[0].author = "A";
  assert.equal(nextStep(s, "2026-11").kind, "month-start");
  old.settlements = [{ version: 1, from: "B", amount: 100 }];
  assert.equal(nextStep(s, "2026-11").kind, "receipt");
  old.settlements[0].receivedAt = "now";
  old.reopen.B = true;
  assert.equal(nextStep(s).kind, "reopen");
  old.reopen.A = true;
  old.approvals.B = true;
  assert.equal(nextStep(s).kind, "month-review");
});
test("a shared decision waiting for the other person never asks for the same answer again", () => {
  const s = state();
  s.householdDecisions = [
    {
      id: "d",
      status: "open",
      answers: { A: { shared: true } },
      bothAnswered: false,
      proposal: null,
    },
  ];
  assert.equal(nextStep(s).kind, "month-start");
  s.householdDecisions[0].answers.A.shared = false;
  assert.equal(nextStep(s).kind, "decision");
});
test("weekly action appears after a recorded expense and the author’s check-in", () => {
  const s = state(),
    m = month("2026-11");
  m.entries = [{ kind: "expense" }];
  s.months = [m];
  assert.equal(nextStep(s, "2026-11").kind, "check-in");
  s.householdReviews = [
    {
      week: s.currentWeek,
      answers: { A: { shared: true } },
      action: { completed: false },
    },
  ];
  assert.equal(nextStep(s, "2026-11").kind, "follow-through");
  s.householdReviews[0].action.completed = true;
  assert.equal(nextStep(s, "2026-11").kind, "current");
});
