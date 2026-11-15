import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:5173";
let checks = 0;
async function call(path, key, data, expected = 200) {
  const r = await fetch(base + path, {
    method: data ? "POST" : "GET",
    headers: {
      ...(key ? { Authorization: "Bearer " + key } : {}),
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const body = await r.json();
  assert.equal(r.status, expected, body.error || path);
  checks++;
  return body;
}
const created = await call("/api/rooms", null, { demo: true }, 201),
  id = created.id,
  A = created.token,
  B = created.demoPartnerToken,
  path = "/api/rooms/" + id,
  space = path + "/workspace";
const other = await call("/api/rooms", null, { demo: true }, 201);
const read = (key) => call(space, key);
const mutate = async (key, action, data = {}, expected = 200) => {
  const s = await read(key);
  return call(
    space,
    key,
    { action, roomRevision: s.revision, ...data },
    expected,
  );
};
const roomMutate = async (key, action, data = {}) => {
  const s = await call(path, key);
  return call(path, key, { action, revision: s.revision, ...data });
};
await call(space, null, undefined, 401);
await call(space, other.token, undefined, 403);
let s = await mutate(A, "createDecision", {
  title: "TEST sofa",
  kind: "purchase",
  amount: 90001,
  context: "Input, not generated output.",
});
let d = s.householdDecisions.find((x) => x.title === "TEST sofa").id;
const get = (s) => s.householdDecisions.find((x) => x.id === d);
async function change(key, action, payload = {}, expected = 200) {
  const current = await read(key),
    row = get(current);
  return call(
    space,
    key,
    {
      action,
      id: d,
      roomRevision: current.revision,
      revision: row.revision,
      ...payload,
    },
    expected,
  );
}
await change(A, "answerDecision", {
  answer: { limit: 60001, timing: "now", note: "ONLY A", shared: false },
});
s = await read(B);
assert.deepEqual(get(s).answers.A, { submitted: true, shared: false });
assert.equal(get(s).guide, null);
await change(B, "answerDecision", {
  answer: { limit: 25000, timing: "save", note: "ONLY B", shared: true },
});
s = await read(A);
assert.equal(get(s).bothAnswered, false);
assert.equal("note" in get(s).answers.B, false);
const proposal = {
  amount: 90001,
  months: 3,
  method: "proportional",
  customA: 0,
  notes: "Save before buying.",
  reviewDate: "2026-12-01",
};
await change(A, "proposeDecision", { proposal }, 400);
await change(A, "answerDecision", {
  answer: { limit: 60001, timing: "now", note: "ONLY A", shared: true },
});
s = await change(A, "proposeDecision", { proposal });
assert.equal(get(s).proposal.version, 1);
const staleRevision = get(s).revision;
s = await change(A, "approveDecision", {
  proposalVersion: 1,
  decision: "accepted",
});
assert.equal(get(s).status, "open");
await call(
  space,
  B,
  {
    action: "approveDecision",
    id: d,
    roomRevision: s.revision,
    revision: staleRevision,
    proposalVersion: 1,
    decision: "accepted",
  },
  409,
);
s = await change(B, "approveDecision", {
  proposalVersion: 1,
  decision: "accepted",
});
assert.equal(get(s).status, "agreed");
assert.equal(get(s).resolutions.length, 1);
assert.deepEqual(get(s).resolutions[0].contributions, [60001, 30000]);
await change(A, "completeDecision", {}, 400);
s = await change(A, "fundDecision", { amount: 60001 });
assert.deepEqual(get(s).funding, { A: 60001, B: 0 });
await change(B, "fundDecision", { amount: 30001 }, 400);
await change(B, "fundDecision", { amount: 30000 });
s = await change(B, "completeDecision");
assert.equal(get(s).status, "completed");
await change(
  A,
  "answerDecision",
  { answer: { limit: 0, timing: "now", note: "", shared: true } },
  400,
);
await change(A, "reopenDecision", {}, 400);
assert.deepEqual(get(s).fundedThisMonth, { A: 60001, B: 30000 });
// A different purchase has its own history; a completed purchase cannot spend again.
s = await mutate(A, "createDecision", {
  title: "TEST replacement",
  kind: "purchase",
  amount: 90001,
  context: "",
});
d = s.householdDecisions.find((x) => x.title === "TEST replacement").id;
for (const key of [A, B])
  await change(key, "answerDecision", {
    answer: { limit: 60001, timing: "save", note: "", shared: true },
  });
s = await change(A, "proposeDecision", { proposal });
let pv = get(s).proposal.version;
await change(A, "approveDecision", {
  proposalVersion: pv,
  decision: "accepted",
});
await change(B, "approveDecision", {
  proposalVersion: pv,
  decision: "accepted",
});
// Confirming a replacement uses its new split, not the previous frozen shares.
s = await change(A, "proposeDecision", {
  proposal: { ...proposal, amount: 120000, months: 4 },
});
pv = get(s).proposal.version;
for (const key of [A, B])
  s = await change(key, "approveDecision", {
    proposalVersion: pv,
    decision: "accepted",
  });
assert.deepEqual(get(s).resolutions.at(-1).contributions, [80000, 40000]);
assert.deepEqual(get(s).resolutions.at(-1).firstMonth, [20000, 10000]);
// A replacement proposal retains the old accepted obligation. Cancellation needs two people.
s = await change(A, "proposeDecision", {
  proposal: { ...proposal, months: 4 },
});
assert.equal(get(s).status, "open");
assert.equal(get(s).activeResolutionVersion, pv);
s = await change(A, "archiveDecision");
assert.equal(get(s).status, "open");
assert.deepEqual(get(s).cancellation, { A: true });
s = await change(B, "archiveDecision");
assert.equal(get(s).status, "archived");
assert.equal(get(s).activeResolutionVersion, null);
s = await change(A, "reopenDecision");
assert.equal(get(s).status, "open");
assert.equal(get(s).activeResolutionVersion, null);
s = await change(A, "proposeDecision", { proposal });
const nextVersion = get(s).proposal.version;
for (const key of [A, B])
  await change(key, "approveDecision", {
    proposalVersion: nextVersion,
    decision: "accepted",
  });
await roomMutate(A, "expenses", {
  expenses: [{ id: "all", label: "All monthly costs", amount: 350000 }],
});
s = await read(A);
assert.equal(get(s).stale, true);
await change(A, "completeDecision", {}, 400);
// A record ID from another household never crosses authorization boundaries.
const otherState = await call(
  "/api/rooms/" + other.id + "/workspace",
  other.token,
);
await mutate(
  A,
  "answerDecision",
  {
    id: otherState.householdDecisions[0].id,
    revision: 1,
    answer: { limit: 1, timing: "now", note: "attack", shared: true },
  },
  404,
);
// Current-week answers, shared action, two confirmations, then completion.
s = await read(A);
let review = s.householdReviews.find((x) => x.week === s.currentWeek);
await mutate(A, "answerReview", {
  revision: review.revision,
  answer: {
    feeling: "mixed",
    topic: "PRIVATE TOPIC A",
    worked: "PRIVATE WEEK A",
    change: "Discuss groceries",
    shared: false,
  },
});
s = await read(B);
review = s.householdReviews.find((x) => x.week === s.currentWeek);
assert.equal("worked" in review.answers.A, false);
assert.equal("topic" in review.answers.A, false);
const privateReview = (await read(A)).householdReviews.find(
  (x) => x.week === s.currentWeek,
);
assert.equal(privateReview.answers.A.topic, "PRIVATE TOPIC A");
await mutate(
  A,
  "answerReview",
  {
    revision: privateReview.revision,
    answer: {
      feeling: "mixed",
      worked: "",
      change: "",
      shared: true,
      topic: "x".repeat(241),
    },
  },
  400,
);
assert.equal(review.guide, null);
await mutate(B, "answerReview", {
  revision: review.revision,
  answer: {
    feeling: "comfortable",
    worked: "PRIVATE WEEK B",
    change: "Protect travel savings",
    shared: true,
  },
});
s = await read(A);
review = s.householdReviews.find((x) => x.week === s.currentWeek);
await mutate(A, "answerReview", {
  revision: review.revision,
  answer: {
    feeling: "mixed",
    topic: "PRIVATE TOPIC A",
    worked: "PRIVATE WEEK A",
    change: "Discuss groceries",
    shared: true,
  },
});
s = await read(A);
review = s.householdReviews.find((x) => x.week === s.currentWeek);
assert.equal(review.bothAnswered, true);
assert.equal(review.answers.A.topic, "PRIVATE TOPIC A");
s = await mutate(A, "reviewAction", {
  id: review.id,
  revision: review.revision,
  nextAction: {
    text: "Compare grocery plans",
    owner: "both",
    due: "2026-12-01",
  },
});
review = s.householdReviews.find((x) => x.id === review.id);
await mutate(
  A,
  "completeReview",
  { id: review.id, revision: review.revision },
  400,
);
s = await mutate(A, "approveReview", {
  id: review.id,
  revision: review.revision,
});
review = s.householdReviews.find((x) => x.id === review.id);
s = await mutate(B, "approveReview", {
  id: review.id,
  revision: review.revision,
});
review = s.householdReviews.find((x) => x.id === review.id);
s = await mutate(A, "completeReview", {
  id: review.id,
  revision: review.revision,
});
assert.equal(
  s.householdReviews.find((x) => x.id === review.id).action.completed,
  true,
);
// Agreement snapshots are recorded only after both confirm, then remain immutable.
s = await call(path, A);
await roomMutate(A, "decision", {
  decision: "accepted",
  planVersion: s.planVersion,
});
await roomMutate(B, "decision", {
  decision: "accepted",
  planVersion: s.planVersion,
});
s = await read(A);
assert.equal(s.planHistory.length, 1);
assert.equal(s.planHistory[0].total, 350000);
// A confirmed recurring purchase is applied exactly once and asks for a fresh monthly approval.
s = await mutate(A, "createDecision", {
  title: "TEST internet",
  kind: "recurring",
  amount: 6000,
  context: "",
});
const recurring = s.householdDecisions.find(
  (x) => x.title === "TEST internet",
).id;
async function recurringChange(key, action, data = {}) {
  const s = await read(key),
    r = s.householdDecisions.find((x) => x.id === recurring);
  return call(space, key, {
    action,
    id: recurring,
    revision: r.revision,
    roomRevision: s.revision,
    ...data,
  });
}
for (const key of [A, B])
  await recurringChange(key, "answerDecision", {
    answer: { limit: 6000, timing: "now", note: "", shared: true },
  });
s = await recurringChange(A, "proposeDecision", {
  proposal: { ...proposal, amount: 6000, months: 1 },
});
const rv = s.householdDecisions.find((x) => x.id === recurring).proposal
  .version;
for (const key of [A, B])
  await recurringChange(key, "approveDecision", {
    proposalVersion: rv,
    decision: "accepted",
  });
s = await recurringChange(A, "applyRecurring");
assert.equal(
  s.expenses.reduce((a, b) => a + b.amount, 0),
  356000,
);
assert.deepEqual(s.decisions, { A: "pending", B: "pending" });
assert.equal(
  s.householdDecisions.find((x) => x.id === recurring).status,
  "completed",
);
assert.equal(s.planHistory[0].total, 350000);
// Different decision IDs still share one financial revision. Two final approvals
// based on one available balance cannot silently reserve that money twice.
const parallelIds = [];
async function rowChange(key, id, action, payload = {}, expected = 200) {
  const current = await read(key),
    row = current.householdDecisions.find((x) => x.id === id);
  return call(
    space,
    key,
    {
      action,
      id,
      roomRevision: current.revision,
      revision: row.revision,
      ...payload,
    },
    expected,
  );
}
for (let n = 0; n < 2; n++) {
  s = await mutate(A, "createDecision", {
    title: "TEST concurrent " + n,
    kind: "purchase",
    amount: 12000,
    context: "",
  });
  const id = s.householdDecisions.find(
    (x) => x.title === "TEST concurrent " + n,
  ).id;
  parallelIds.push(id);
  for (const key of [A, B])
    await rowChange(key, id, "answerDecision", {
      answer: { limit: 20000, timing: "now", note: "", shared: true },
    });
  await rowChange(A, id, "proposeDecision", {
    proposal: { ...proposal, amount: 12000, months: 1 },
  });
  await rowChange(A, id, "approveDecision", {
    proposalVersion: 1,
    decision: "accepted",
  });
}
s = await read(B);
const races = await Promise.all(
  parallelIds.map(async (id) => {
    const row = s.householdDecisions.find((x) => x.id === id);
    const response = await fetch(base + space, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + B,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "approveDecision",
        id,
        roomRevision: s.revision,
        revision: row.revision,
        proposalVersion: 1,
        decision: "accepted",
      }),
    });
    return { id, status: response.status };
  }),
);
assert.deepEqual(races.map((x) => x.status).sort(), [200, 409]);
checks++;
const loser = races.find((x) => x.status === 409).id;
s = await read(B);
assert.equal(s.householdDecisions.find((x) => x.id === loser).stale, true);
await rowChange(
  B,
  loser,
  "approveDecision",
  { proposalVersion: 1, decision: "accepted" },
  409,
);
s = await rowChange(B, loser, "proposeDecision", {
  proposal: { ...proposal, amount: 12000, months: 2 },
});
const revised = s.householdDecisions.find((x) => x.id === loser).proposal;
assert.deepEqual(revised.approvals, { A: "pending", B: "pending" });
for (const key of [A, B])
  await rowChange(key, loser, "approveDecision", {
    proposalVersion: revised.version,
    decision: "accepted",
  });
// Withdrawing financial sharing removes all peer private answers and generated recaps.
s = await call(path, B);
await roomMutate(B, "profile", { profile: { ...s.self, shared: false } });
s = await read(A);
assert.equal(s.planHistory.length, 0);
assert.equal("note" in get(s).answers.B, false);
assert.equal(
  s.householdReviews.find((x) => x.id === review.id).bothAnswered,
  false,
);
const exported = await call(path + "/access", A, { action: "export" });
assert.equal(JSON.stringify(exported).includes("ONLY B"), false);
assert.equal(JSON.stringify(exported).includes("PRIVATE WEEK B"), false);
assert.equal(JSON.stringify(exported).includes(A), false);
// Rotate one role: its old key fails, the peer key remains valid.
s = await read(A);
const rotated = await call(path + "/access", A, {
  action: "rotate",
  revision: s.revision,
});
await call(space, A, undefined, 403);
await read(B);
s = await read(rotated.token);
await call(
  path + "/access",
  rotated.token,
  { action: "delete", revision: s.revision, confirmation: "no" },
  400,
);
await call(
  path + "/access",
  rotated.token,
  { action: "delete", revision: s.revision - 1, confirmation: "DELETE" },
  409,
);
await call(path + "/access", rotated.token, {
  action: "delete",
  revision: s.revision,
  confirmation: "DELETE",
});
await call(space, B, undefined, 404);
const o = await call("/api/rooms/" + other.id + "/workspace", other.token);
await call("/api/rooms/" + other.id + "/access", other.token, {
  action: "delete",
  revision: o.revision,
  confirmation: "DELETE",
});
console.log(
  JSON.stringify({
    passed: true,
    httpChecks: checks,
    covers: [
      "private perspectives",
      "two-party decisions",
      "exact saving schedule",
      "progress per role",
      "stale budget",
      "cross-household access",
      "weekly actions",
      "immutable accepted plans",
      "atomic recurring cost application",
      "redacted exports",
      "key rotation",
      "scoped deletion",
    ],
  }),
);
