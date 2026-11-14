import assert from "node:assert/strict";

const base = process.env.TEST_BASE_URL || "http://127.0.0.1:5173";
let checks = 0;
async function call(path, { key, data, expected = 200 } = {}) {
  const response = await fetch(base + path, {
    method: data ? "POST" : "GET",
    headers: {
      ...(key ? { Authorization: "Bearer " + key } : {}),
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const body = await response.json();
  assert.equal(response.status, expected, body.error || path);
  checks += 1;
  return body;
}
const creation = await call("/api/rooms", {
  data: {
    name: "API Alex",
    partnerName: "API Jordan",
    moveDate: "2026-12-01",
    demo: false,
  },
  expected: 201,
});
const path = "/api/rooms/" + creation.id,
  keyA = creation.token;
await call(path, { expected: 401 });
await call(path, { key: "0".repeat(64), expected: 403 });
const { token: keyB } = await call(path, {
  data: { action: "join", invite: creation.invite },
});
await call(path, {
  data: { action: "join", invite: creation.invite },
  expected: 410,
});
const read = (key) => call(path, { key });
async function mutate(key, action, data) {
  const current = await read(key);
  return call(path, {
    key,
    data: { action, revision: current.revision, ...data },
  });
}
let state = await read(keyA);
assert.equal("income" in state.partner, false);
const a = {
  name: "API Alex",
  income: 600000,
  personal: 90000,
  reserve: 200000,
  priority: "Independence",
  concern: "PRIVATE A",
  shared: true,
};
const b = {
  name: "API Jordan",
  income: 300000,
  personal: 30000,
  reserve: 120000,
  priority: "Room to save",
  concern: "PRIVATE B",
  shared: false,
};
await mutate(keyA, "profile", { profile: a });
await mutate(keyB, "profile", { profile: b });
state = await read(keyA);
assert.equal(state.bothShared, false);
assert.equal(state.calculation, null);
assert.equal("income" in state.partner, false);
assert.equal("concern" in state.partner, false);
await call(path, {
  key: keyA,
  data: {
    action: "decision",
    revision: state.revision,
    planVersion: state.planVersion,
    decision: "accepted",
  },
  expected: 400,
});
await mutate(keyB, "profile", { profile: { ...b, shared: true } });
state = await read(keyA);
assert.equal(state.partner.income, 300000);
assert.equal(state.partner.concern, "PRIVATE B");
await mutate(keyA, "expenses", {
  expenses: [
    { id: "rent", label: "Rent", amount: 240000 },
    { id: "other", label: "Other shared expenses", amount: 100000 },
  ],
});
state = await read(keyA);
const plan = { ...state.plan, method: "proportional" };
state = await mutate(keyA, "plan", { plan });
assert.deepEqual(state.calculation.contributionsCents, [226667, 113333]);
const oldRevision = state.revision;
await mutate(keyA, "decision", {
  planVersion: state.planVersion,
  decision: "accepted",
});
await call(path, {
  key: keyB,
  data: {
    action: "decision",
    revision: oldRevision,
    planVersion: state.planVersion,
    decision: "accepted",
  },
  expected: 409,
});
state = await mutate(keyB, "decision", {
  planVersion: state.planVersion,
  decision: "accepted",
});
assert.deepEqual(state.decisions, { A: "accepted", B: "accepted" });
const acceptedVersion = state.planVersion;
state = await mutate(keyA, "plan", { plan: state.plan });
assert.equal(
  state.planVersion,
  acceptedVersion,
  "Reopening an unchanged plan must preserve its version",
);
assert.deepEqual(state.decisions, { A: "accepted", B: "accepted" });
state = await mutate(keyB, "expenses", {
  expenses: [{ id: "rent", label: "Rent", amount: 280000 }],
});
assert.deepEqual(state.decisions, { A: "pending", B: "pending" });
await call(path, {
  key: keyA,
  data: {
    action: "decision",
    revision: state.revision,
    planVersion: acceptedVersion,
    decision: "accepted",
  },
  expected: 409,
});
state = await mutate(keyA, "checkin", {
  checkin: {
    date: "2026-12-31",
    amount: 290000,
    note: "Groceries were a little higher.",
  },
});
assert.equal(state.checkins.length, 1);
assert.equal((await read(keyB)).checkins[0].amount, 290000);
await call(path, {
  key: keyA,
  data: {
    action: "plan",
    revision: state.revision,
    plan: { ...plan, method: "custom", customA: 999999 },
  },
  expected: 400,
});
const guideResponse = await fetch(base + path + "/guide", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + keyA,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ revision: state.revision }),
});
assert.ok(
  [200, 503].includes(guideResponse.status),
  "Guide must work or explicitly report missing configuration",
);
await mutate(keyB, "profile", { profile: { ...b, shared: false } });
state = await read(keyA);
assert.equal(state.bothShared, false);
assert.equal("income" in state.partner, false);
assert.equal(state.guide, null);
assert.deepEqual(state.decisions, { A: "pending", B: "pending" });
await call(path + "/guide", {
  key: keyA,
  data: { revision: state.revision },
  expected: 400,
});
// Preliminary estimates are private assumptions, never partner-authored answers.
const quickData = {
  income: 600000,
  partnerIncome: 300000,
  expenses: [
    { id: "shared", label: "Shared monthly expenses", amount: 340000 },
  ],
  method: "proportional",
};
const quick = await call("/api/rooms", {
  data: { quickStart: quickData },
  expected: 201,
});
const quickPath = "/api/rooms/" + quick.id;
let quickA = await call(quickPath, { key: quick.token });
assert.equal(quickA.moveDate, null);
assert.equal(quickA.self.refined, false);
assert.equal(quickA.self.shared, false);
assert.equal(quickA.partner.submitted, false);
assert.equal(quickA.estimate.partnerIncome, 300000);
assert.equal(quickA.calculation, null);
const quickBToken = (
  await call(quickPath, { data: { action: "join", invite: quick.invite } })
).token;
let quickB = await call(quickPath, { key: quickBToken });
assert.equal(quickB.estimate, null);
assert.equal(quickB.self.income, 0);
assert.equal(quickB.self.submitted, false);
assert.equal("income" in quickB.partner, false);
await call(quickPath, {
  key: quickBToken,
  data: {
    action: "estimate",
    revision: quickB.revision,
    estimate: { partnerIncome: 100000, method: "equal" },
  },
  expected: 400,
});
quickA = await call(quickPath, { key: quick.token });
quickA = await call(quickPath, {
  key: quick.token,
  data: {
    action: "estimate",
    revision: quickA.revision,
    estimate: { partnerIncome: null, method: "equal" },
  },
});
assert.equal(quickA.estimate.partnerIncome, null);
await call(quickPath, {
  key: quick.token,
  data: {
    action: "estimate",
    revision: quickA.revision,
    estimate: { partnerIncome: null, method: "proportional" },
  },
  expected: 400,
});
quickA = await call(quickPath, {
  key: quick.token,
  data: {
    action: "estimate",
    revision: quickA.revision,
    estimate: { partnerIncome: 300000, method: "proportional" },
  },
});
quickA = await call(quickPath, {
  key: quick.token,
  data: {
    action: "profile",
    revision: quickA.revision,
    profile: { ...quickA.self, shared: true },
  },
});
quickB = await call(quickPath, { key: quickBToken });
quickB = await call(quickPath, {
  key: quickBToken,
  data: {
    action: "profile",
    revision: quickB.revision,
    profile: {
      ...quickB.self,
      income: 400000,
      shared: true,
      personal: 99900,
      reserve: 99900,
      refined: false,
    },
  },
});
assert.equal(quickB.bothShared, true);
assert.equal(quickB.estimate, null);
assert.deepEqual(quickB.calculation.contributionsCents, [204000, 136000]);
assert.deepEqual(
  quickB.calculation.remainingCents,
  [396000, 264000],
  "Excluded personal amounts must not affect the calculation",
);
quickA = await call(quickPath, { key: quick.token });
assert.equal(quickA.estimate, null);
assert.equal(quickA.partner.income, 400000);
await call(quickPath, {
  key: quick.token,
  data: {
    action: "estimate",
    revision: quickA.revision,
    estimate: { partnerIncome: 800000, method: "equal" },
  },
  expected: 400,
});
await call("/api/rooms", {
  data: { quickStart: { ...quickData, partnerIncome: null } },
  expected: 400,
});
await call("/api/rooms", {
  data: { demo: true, quickStart: quickData },
  expected: 400,
});
console.log(
  JSON.stringify({
    passed: true,
    httpChecks: checks,
    covers: [
      "role authorization",
      "single-use invitation",
      "mutual sharing",
      "private field redaction",
      "exact calculations",
      "stale-write conflict",
      "both approvals",
      "revision invalidation",
      "persisted check-in",
      "withdrawal of sharing",
      "private preliminary estimates",
      "unknown versus zero income",
      "actual partner answers replace estimates",
      "optional personal costs",
    ],
  }),
);
