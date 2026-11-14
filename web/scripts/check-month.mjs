import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:5173";
let checks = 0;
async function call(path, key, data, status = 200) {
  const r = await fetch(base + path, {
    method: data ? "POST" : "GET",
    headers: {
      ...(key ? { Authorization: "Bearer " + key } : {}),
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const b = await r.json();
  assert.equal(r.status, status, b.error || path);
  checks++;
  return b;
}
const created = await call("/api/rooms", null, { demo: true }, 201),
  id = created.id,
  A = created.token,
  B = created.demoPartnerToken,
  path = "/api/rooms/" + id;
const other = await call("/api/rooms", null, { demo: true }, 201);
const d = new Date();
d.setUTCDate(1);
d.setUTCMonth(d.getUTCMonth() - 1);
const period = d.toISOString().slice(0, 7),
  date = period + "-05";
const read = (key = A) => call(path + "/workspace", key);
const get = (s) => s.months.find((x) => x.period === period);
async function change(key, action, extra = {}, status = 200) {
  const s = await read(key);
  return call(
    path + "/months",
    key,
    {
      action,
      period,
      roomRevision: s.revision,
      revision: get(s)?.revision,
      ...(action === "edit"
        ? {
            expectedUpdatedAt: get(s)?.entries.find(
              (x) => x.id === extra.entry?.id,
            )?.updatedAt,
          }
        : {}),
      ...extra,
    },
    status,
  );
}
const expense = (amount, paidA, title, categoryId = "rent") => ({
  id: randomUUID(),
  kind: "expense",
  amount,
  paidA,
  title,
  categoryId,
  date,
});
try {
  await call(path + "/months", null, { action: "start", period }, 401);
  await call(path + "/months", other.token, { action: "start", period }, 403);
  let s = await change(A, "start");
  assert.deepEqual(get(s).baseline.weights, [2, 1]);
  const baseline = JSON.stringify(get(s).baseline),
    cat = get(s).baseline.expenses[0].id;
  const e1 = expense(10000, 10000, "Paid by A", cat),
    e2 = expense(20000, 0, "Paid by B", cat);
  let before = await read();
  const retry = {
    action: "add",
    period,
    roomRevision: before.revision,
    revision: get(before).revision,
    entry: e1,
  };
  s = await call(path + "/months", A, retry);
  s = await call(path + "/months", A, retry);
  assert.equal(get(s).entries.length, 1);
  await call(
    path + "/months",
    A,
    { ...retry, entry: { ...e1, amount: 20000, paidA: 20000 } },
    409,
  );
  await change(B, "add", { entry: e2 });
  await change(B, "remove", { entryId: e1.id }, 403);
  await change(B, "edit", { entry: { ...e1, title: "Not mine" } }, 403);
  await change(
    A,
    "add",
    {
      entry: {
        ...expense(1000, 1000, "Impossible", cat),
        date: period + "-32",
      },
    },
    400,
  );
  await change(
    A,
    "add",
    {
      entry: {
        ...expense(1000, 1000, "Wrong period", cat),
        date: new Date().toISOString().slice(0, 10),
      },
    },
    400,
  );
  const refund = {
    ...expense(1000, 0, "Refund"),
    kind: "refund",
    originalId: e2.id,
  };
  await change(B, "add", { entry: { ...refund, amount: 20001 } }, 400);
  await change(B, "add", { entry: refund });
  await change(B, "remove", { entryId: e2.id }, 400);
  const mixed = expense(1500, 500, "Covered together", cat);
  await change(A, "add", { entry: mixed });
  const transfer = {
    ...expense(5000, 5000, "Sent to partner", "transfer"),
    kind: "transfer",
  };
  await change(B, "add", { entry: transfer }, 400);
  before = await read();
  const transferRetry = {
    action: "add",
    period,
    roomRevision: before.revision,
    revision: get(before).revision,
    entry: transfer,
  };
  await call(path + "/months", A, transferRetry);
  await call(path + "/months", A, transferRetry);
  await change(A, "confirmTransfer", { entryId: transfer.id }, 403);
  await change(A, "approve", {}, 400);
  await change(B, "confirmTransfer", { entryId: transfer.id });
  await change(A, "remove", { entryId: transfer.id }, 403);
  s = await change(A, "approve");
  assert.deepEqual(get(s).approvals, { A: true, B: false });
  const stale = {
    action: "approve",
    period,
    roomRevision: s.revision,
    revision: get(s).revision,
  };
  s = await change(B, "add", { entry: expense(300, 0, "Late expense", cat) });
  assert.deepEqual(get(s).approvals, { A: false, B: false });
  await call(path + "/months", A, stale, 409);
  await change(A, "approve");
  s = await change(B, "approve");
  assert.equal(get(s).status, "agreed");
  assert.equal(get(s).history.length, 1);
  const snapshot = JSON.stringify(get(s).history[0]),
    version = get(s).version;
  await change(A, "add", { entry: expense(1, 1, "Late", cat) }, 400);
  await change(B, "reportSettlement", {}, 403);
  s = await change(A, "reportSettlement");
  assert.equal(get(s).settlements[0].amount, 5033);
  await change(A, "receiveSettlement", {}, 403);
  await change(A, "requestReopen", {}, 400);
  await change(B, "rejectSettlement");
  await change(A, "reportSettlement");
  s = await change(B, "receiveSettlement");
  assert.ok(get(s).settlements[0].receivedAt);
  assert.equal(JSON.stringify(get(s).history[0]), snapshot);
  let room = await call(path, A);
  await call(path, A, {
    action: "profile",
    revision: room.revision,
    profile: { ...room.self, income: 300000 },
  });
  s = await read();
  assert.equal(JSON.stringify(get(s).baseline), baseline);
  s = await change(A, "requestReopen");
  assert.equal(get(s).status, "agreed");
  s = await change(B, "requestReopen");
  assert.equal(get(s).status, "open");
  assert.equal(
    get(s).entries.filter((x) => x.id === "settlement:" + version).length,
    1,
  );
  await change(A, "remove", { entryId: "settlement:" + version }, 403);
  s = await change(A, "edit", {
    entry: { ...e1, amount: 10300, paidA: 10300 },
  });
  assert.equal(JSON.stringify(get(s).history[0]), snapshot);
  await change(A, "approve");
  s = await change(B, "approve");
  assert.equal(get(s).history.length, 2);
  s = await change(B, "reportSettlement");
  assert.equal(get(s).settlements.at(-1).amount, 100);
  await change(A, "receiveSettlement");
  const exported = await call(path + "/access", A, { action: "export" });
  assert.equal(
    exported.months.find((x) => x.period === period).history.length,
    2,
  );
  assert.equal(JSON.stringify(exported).includes(A), false);
  room = await call(path, B);
  await call(path, B, {
    action: "profile",
    revision: room.revision,
    profile: { ...room.self, shared: false },
  });
  s = await read();
  assert.deepEqual(s.months, []);
  await change(A, "start", {}, 400);
  const hidden = await call(path + "/access", A, { action: "export" });
  assert.deepEqual(hidden.months, []);
  console.log(
    JSON.stringify({
      passed: true,
      httpChecks: checks,
      covers: [
        "fixed monthly shares",
        "exact expenses/refunds/transfers",
        "receipt confirmation",
        "role ownership",
        "idempotency",
        "stale writes",
        "two-person close",
        "immutable history",
        "settlement and corrections",
        "private data export",
      ],
    }),
  );
} finally {
  for (const r of [created, other]) {
    const p = "/api/rooms/" + r.id;
    const s = await call(p + "/workspace", r.token);
    await call(p + "/access", r.token, {
      action: "delete",
      revision: s.revision,
      confirmation: "DELETE",
    });
  }
}
