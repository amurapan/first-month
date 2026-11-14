import test from "node:test";
import assert from "node:assert/strict";
import {
  commitmentLedger,
  decisionOptions,
  fundingProjection,
  projectOption,
  projectAgreement,
  activeResolution,
} from "../web/lib/domain/planning.js";
const asOf = "2026-11-15T12:00:00Z";
function item(extra = {}) {
  return {
    id: "purchase",
    title: "A sofa",
    kind: "purchase",
    amount: 90000,
    status: "open",
    createdAt: asOf,
    updatedAt: asOf,
    creator: "A",
    answers: {
      A: { limit: 60000, timing: "now", shared: true },
      B: { limit: 25000, timing: "save", shared: true },
    },
    proposal: null,
    resolutions: [],
    ...extra,
  };
}
function accepted(extra = {}) {
  return item({
    id: "existing",
    status: "agreed",
    activeResolutionVersion: 1,
    proposal: { version: 1 },
    resolutions: [
      {
        version: 1,
        at: asOf,
        amount: 90000,
        months: 3,
        contributions: [60000, 30000],
        firstMonth: [20000, 10000],
      },
    ],
    ...extra,
  });
}
function input(extra = {}) {
  return {
    item: item(),
    decisions: [],
    expenseIds: [],
    incomes: [600000, 300000],
    baseRemaining: [280000, 150000],
    reserves: [200000, 100000],
    refined: [true, true],
    limits: [60000, 25000],
    asOf,
    ...extra,
  };
}
test("options solve timing and lower-price alternatives from actual limits", () => {
  const r = decisionOptions(input());
  assert.equal(r.options[0].status, "strained");
  assert.equal(r.options.find((x) => x.id === "save").months, 2);
  assert.equal(r.options.find((x) => x.id === "lower").amount, 75001);
  assert.equal(r.suggestedId, "save");
});
test("accepted allocations survive changed income and an unaccepted replacement", () => {
  const d = accepted({
    status: "open",
    proposal: { version: 2, amount: 300000 },
  });
  assert.equal(activeResolution(d).version, 1);
  const l = commitmentLedger([d], [], "", asOf);
  assert.deepEqual(l.totals[0], [20000, 10000]);
  assert.equal(l.rows[0].retained, true);
});
test("current decision, unapproved ideas, and applied recurring costs are not counted twice", () => {
  const recurring = accepted({ id: "internet", kind: "recurring" });
  assert.deepEqual(
    commitmentLedger(
      [accepted(), item({ id: "new" }), recurring],
      ["decision:internet"],
      "existing",
      asOf,
    ).totals[0],
    [0, 0],
  );
});
test("other commitments change suggested timing and exact combined remainder", () => {
  const d = accepted({
    resolutions: [
      { version: 1, at: asOf, months: 2, contributions: [100000, 80000] },
    ],
  });
  const r = decisionOptions(input({ decisions: [d] }));
  const saving = r.options.find((x) => x.id === "save");
  assert.equal(saving.months, 3);
  assert.deepEqual(saving.remaining, [210000, 100000]);
  assert.deepEqual(saving.ledger.totals[0], [50000, 40000]);
});
test("savings completion counts only funding reported in this month", () => {
  const d = accepted({
    status: "completed",
    completedAt: asOf,
    funding: { A: 60000, B: 30000 },
    fundingMonth: "2026-11",
    fundedThisMonth: { A: 20000, B: 10000 },
  });
  assert.deepEqual(
    commitmentLedger([d], [], "", asOf).totals[0],
    [20000, 10000],
  );
  assert.deepEqual(
    commitmentLedger([d], [], "", "2026-12-01").totals[0],
    [0, 0],
  );
});
test("a direct completed purchase is retained in its purchase month", () => {
  const d = accepted({
    status: "completed",
    completedAt: asOf,
    resolutions: [
      { version: 1, at: asOf, months: 1, contributions: [60000, 30000] },
    ],
  });
  assert.deepEqual(
    commitmentLedger([d], [], "", asOf).totals[0],
    [60000, 30000],
  );
});
test("funding corrections never create negative obligations or hide a shortfall", () => {
  const x = fundingProjection({
    contributions: [60000, 30000],
    months: 3,
    at: asOf,
    funding: { A: 5000, B: 0 },
    fundingMonth: "2026-11",
    fundedThisMonth: { A: -5000, B: 0 },
    asOf,
  });
  assert.equal(
    x.schedules[0].reduce((a, b) => a + b, 0),
    55000,
  );
  assert.ok(x.schedules.flat().every((v) => Number.isInteger(v) && v >= 0));
});
test("early funding stays in this month and reduces subsequent allocations", () => {
  const x = fundingProjection({
    contributions: [60001, 30000],
    months: 3,
    at: asOf,
    funding: { A: 50000, B: 0 },
    fundingMonth: "2026-11",
    fundedThisMonth: { A: 50000, B: 0 },
    asOf,
  });
  assert.deepEqual(x.schedules[0], [50000, 5001, 5000]);
});
test("overdue savings do not get a silently extended end date", () => {
  const d = accepted({
    resolutions: [
      {
        version: 1,
        at: "2026-07-01",
        months: 3,
        contributions: [60000, 30000],
      },
    ],
    funding: { A: 40000, B: 10000 },
  });
  const l = commitmentLedger([d], [], "", asOf);
  assert.equal(l.rows[0].overdue, true);
  assert.deepEqual(l.totals[0], [20000, 20000]);
  assert.deepEqual(l.totals[1], [0, 0]);
});
test("unknown costs and comfort amounts remain unknown; explicit zero is binding", () => {
  const r = decisionOptions(
    input({ refined: [false, true], limits: [null, 25000] }),
  );
  assert.equal(r.options.find((x) => x.id === "save").status, "incomplete");
  assert.equal(r.suggestedId, null);
  assert.equal(
    projectOption(input({ limits: [0, 25000] }), {
      amount: 100,
      months: 1,
      method: "equal",
    }).status,
    "strained",
  );
});
test("fingerprint follows allocations and month, not unrelated notes", () => {
  const a = accepted();
  const before = commitmentLedger([a], [], "", asOf).key;
  assert.equal(
    commitmentLedger([{ ...a, context: "changed note" }], [], "", asOf).key,
    before,
  );
  assert.notEqual(commitmentLedger([a], [], "", "2026-12-01").key, before);
  assert.notEqual(
    commitmentLedger([{ ...a, funding: { A: 10000, B: 0 } }], [], "", asOf).key,
    before,
  );
});
test("excess savings remain explicit and cannot transfer to the other partner", () => {
  const r = projectOption(
    input({ item: item({ funding: { A: 70000, B: 0 } }) }),
    { amount: 90000, months: 2, method: "proportional" },
  );
  assert.deepEqual(r.excess, [10000, 0]);
  assert.deepEqual(r.stillToFund, [0, 30000]);
  assert.deepEqual(r.firstMonth, [0, 15000]);
});

test("accepted detail retains frozen shares and end month after income changes", () => {
  const d = accepted({
    resolutions: [
      {
        version: 1,
        at: "2026-09-01",
        months: 3,
        amount: 90000,
        method: "proportional",
        contributions: [60000, 30000],
      },
    ],
    funding: { A: 40000, B: 10000 },
  });
  const r = projectAgreement(input({ item: d, incomes: [0, 0] }));
  assert.deepEqual(r.contributions, [60000, 30000]);
  assert.deepEqual(r.schedule, [[20000], [20000]]);
  assert.deepEqual(r.firstMonth, [20000, 20000]);
  assert.equal(r.overdue, false);
  const next = projectAgreement(input({ item: d, asOf: "2026-12-01" }));
  assert.equal(next.overdue, true);
});
