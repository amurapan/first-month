import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  currentMonth,
  monthOutstanding,
  shiftMonth,
} from "../lib/domain/month.js";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:5173";
let checks = 0;
async function call(path, key, data, expected = 200) {
  const response = await fetch(base + path, {
    method: data ? "POST" : "GET",
    headers: {
      ...(key ? { Authorization: "Bearer " + key } : {}),
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const result = await response.json();
  assert.equal(response.status, expected, result.error || path);
  checks++;
  return result;
}
const created = await call("/api/rooms", null, { demo: true }, 201);
const path = "/api/rooms/" + created.id,
  A = created.token,
  B = created.demoPartnerToken;
const current = currentMonth(),
  next = shiftMonth(current);
const read = () => call(path + "/workspace", A);
const month = (s, period = current) =>
  s.months.find((m) => m.period === period);
async function action(key, period, action, extra = {}, expected = 200) {
  const s = await read();
  return call(
    path + "/months",
    key,
    {
      action,
      period,
      roomRevision: s.revision,
      revision: month(s, period)?.revision,
      ...extra,
    },
    expected,
  );
}
try {
  assert.equal(shiftMonth("2026-12"), "2027-01");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  await action(A, shiftMonth(next), "start", {}, 400);
  await action(
    A,
    next,
    "start",
    { sourcePeriod: current, sourceRevision: month(await read()).revision },
    400,
  );
  await action(A, current, "approve");
  let s = await action(B, current, "approve");
  const source = structuredClone(month(s));
  const outstanding = monthOutstanding(source);
  assert.notEqual(outstanding, 0);
  await action(
    A,
    next,
    "start",
    { sourcePeriod: shiftMonth(current, -1), sourceRevision: source.revision },
    400,
  );
  await action(
    A,
    next,
    "start",
    { sourcePeriod: current, sourceRevision: source.revision - 1 },
    409,
  );
  await action(A, current, "requestReopen");
  await action(
    A,
    next,
    "start",
    { sourcePeriod: current, sourceRevision: month(await read()).revision },
    400,
  );
  await action(A, current, "cancelReopen");
  // The new household plan is deliberately different from the frozen month's ratio.
  let room = await call(path, A);
  await call(path, A, {
    action: "plan",
    revision: room.revision,
    plan: { ...room.plan, method: "equal" },
  });
  s = await action(A, next, "start", {
    sourcePeriod: current,
    sourceRevision: month(await read()).revision,
  });
  const prepared = month(s, next);
  assert.deepEqual(prepared.baseline.weights, source.baseline.weights);
  assert.deepEqual(prepared.baseline.expenses, source.baseline.expenses);
  assert.equal(prepared.baseline.sourcePeriod, current);
  assert.equal(prepared.baseline.sourceMonthVersion, source.version);
  assert.deepEqual(prepared.entries, []);
  assert.deepEqual(prepared.approvals, { A: false, B: false });
  assert.deepEqual(prepared.settlements, []);
  assert.deepEqual(prepared.history, []);
  assert.equal(prepared.status, "open");
  assert.equal(monthOutstanding(month(s)), outstanding);
  assert.deepEqual(month(s).history, source.history);
  await action(A, next, "approve", {}, 400);
  const e = {
    id: randomUUID(),
    kind: "expense",
    amount: 1000,
    paidA: 1000,
    title: "Not yet paid",
    categoryId: "other",
    date: next + "-01",
  };
  await action(A, next, "add", { entry: e }, 400);
  await action(
    A,
    next,
    "add",
    { entry: { ...e, date: new Date().toISOString().slice(0, 10) } },
    400,
  );
  // A repeated start never overwrites an existing month or recopies entries.
  s = await action(B, next, "start", { split: "equal" });
  assert.deepEqual(month(s, next).baseline, prepared.baseline);
  s = await action(B, next, "refreshPlan", { split: "plan" });
  assert.deepEqual(month(s, next).baseline.weights, [1, 1]);
  assert.equal(month(s, next).baseline.sourcePeriod, undefined);
  assert.deepEqual(month(s, next).entries, []);
  // Sharing permission remains required for prepared months as well.
  room = await call(path, B);
  await call(path, B, {
    action: "profile",
    revision: room.revision,
    profile: { ...room.self, shared: false },
  });
  assert.deepEqual((await read()).months, []);
  await call(path + "/months", A, { action: "start", period: next }, 400);
  console.log(
    `Passed ${checks} continuity API checks: frozen settings, separate balances, no copied payments or approvals, upcoming-month boundaries, stale sources, mutual review, and sharing privacy.`,
  );
} finally {
  const s = await call(path, A);
  await call(path + "/access", A, {
    action: "delete",
    revision: s.revision,
    confirmation: "DELETE",
  });
}
