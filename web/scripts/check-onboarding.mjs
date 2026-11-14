import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:5173";
let checks = 0;
const created = [];
async function call(path, key, data, status = 200) {
  const response = await fetch(base + path, {
    method: data ? "POST" : "GET",
    headers: {
      ...(key ? { Authorization: "Bearer " + key } : {}),
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const result = await response.json();
  assert.equal(response.status, status, result.error || path);
  checks++;
  assert.match(response.headers.get("cache-control"), /no-store/);
  return result;
}
try {
  const a = await call(
    "/api/rooms",
    null,
    { name: "Preview Alex", partnerName: "Preview Jordan" },
    201,
  );
  created.push(a);
  const path = "/api/rooms/" + a.id;
  const preview = await call(path + "/invitation", null, { invite: a.invite });
  assert.deepEqual(preview, {
    inviterName: "Preview Alex",
    startingPlanReady: false,
  });
  await call(path + "/invitation", null, { invite: a.invite });
  await call(path + "/invitation", null, { invite: "0".repeat(64) }, 410);
  let state = await call(path, a.token);
  const replacement = await call(path, a.token, {
    action: "invite",
    revision: state.revision,
  });
  await call(path + "/invitation", null, { invite: a.invite }, 410);
  const b = await call(path, null, {
    action: "join",
    invite: replacement.invite,
  });
  await call(path + "/invitation", null, { invite: replacement.invite }, 410);
  await call(path, null, { action: "join", invite: replacement.invite }, 410);
  const other = await call("/api/rooms", null, { demo: true }, 201);
  created.push(other);
  await call(path + "/feedback", null, undefined, 401);
  await call(path + "/feedback", other.token, undefined, 403);
  const note = {
    action: "create",
    id: randomUUID(),
    kind: "confusing",
    screen: "home",
    message: "TEST NOTE: the next step needed more context.",
  };
  await call(
    path + "/feedback",
    a.token,
    { ...note, screen: "/space#secret" },
    400,
  );
  await call(
    path + "/feedback",
    a.token,
    { ...note, message: "a".repeat(2001) },
    400,
  );
  await call(path + "/feedback", a.token, { ...note, message: "    " }, 400);
  const outcomes = await Promise.all([
    call(path + "/feedback", a.token, note),
    call(path + "/feedback", a.token, note),
  ]);
  for (const r of outcomes) assert.equal(r.feedback.length, 1);
  assert.equal(
    (await call(path + "/feedback", a.token, note)).feedback.length,
    1,
  );
  await call(
    path + "/feedback",
    a.token,
    { ...note, message: "Different content" },
    409,
  );
  assert.equal((await call(path + "/feedback", b.token)).feedback.length, 0);
  await call(path + "/feedback", b.token, { action: "remove", id: note.id });
  assert.equal((await call(path + "/feedback", a.token)).feedback.length, 1);
  await call("/api/rooms/" + other.id + "/feedback", other.token, note, 409);
  assert.equal(
    JSON.stringify(await call(path + "/workspace", b.token)).includes(
      note.message,
    ),
    false,
  );
  const mine = await call(path + "/access", a.token, { action: "export" }),
    theirs = await call(path + "/access", b.token, { action: "export" });
  assert.equal(mine.feedback[0].message, note.message);
  assert.equal(theirs.feedback.length, 0);
  // Failed retries must not spend the quota again; concurrent first submissions may reserve two slots.
  let saved = 1,
    limited = false;
  for (let i = 0; i < 5; i++) {
    const r = await fetch(base + path + "/feedback", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + a.token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...note, id: randomUUID() }),
    });
    if (r.status === 429) {
      limited = true;
      break;
    }
    assert.equal(r.status, 200);
    saved++;
  }
  assert.equal(limited, true);
  assert.ok(saved <= 5);
  await call(path + "/feedback", a.token, note); // original remains retryable after rate cap
  await call(path + "/feedback", a.token, { action: "remove", id: note.id });
  assert.equal(
    (await call(path + "/feedback", a.token)).feedback.some(
      (x) => x.id === note.id,
    ),
    false,
  );
  const retained = (await call(path + "/feedback", a.token)).feedback[0];
  state = await call(path, a.token);
  await call(path + "/access", a.token, {
    action: "delete",
    revision: state.revision,
    confirmation: "DELETE",
  });
  created.splice(created.indexOf(a), 1);
  await call(path + "/feedback", a.token, undefined, 404);
  // Reusing an old ID in another owned test room proves the stored row was removed too.
  await call("/api/rooms/" + other.id + "/feedback", other.token, {
    ...note,
    id: retained.id,
  });
  console.log(
    `${checks} onboarding API checks passed; invitation privacy, author isolation, retries, limits and export.`,
  );
} finally {
  for (const room of created) {
    const path = "/api/rooms/" + room.id,
      state = await call(path, room.token);
    await call(path + "/access", room.token, {
      action: "delete",
      revision: state.revision,
      confirmation: "DELETE",
    });
    await call(path + "/feedback", room.token, undefined, 404);
  }
}
