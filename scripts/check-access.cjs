// Uses only a temporary fictional household; never an existing user space.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:5173";
(async () => {
  const browser = await chromium.launch({
      headless: true,
      ...(process.env.CHROME_BIN
        ? { executablePath: process.env.CHROME_BIN }
        : {}),
    }),
    page = await browser.newPage({
      viewport: { width: 390, height: 900 },
      reducedMotion: "reduce",
    });
  let room,
    deleted = false;
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const api = async (path, key, data, status = 200) => {
    const r = await fetch(base + path, {
      method: data ? "POST" : "GET",
      headers: {
        ...(key ? { Authorization: "Bearer " + key } : {}),
        ...(data ? { "Content-Type": "application/json" } : {}),
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    const d = await r.json();
    assert.equal(r.status, status, d.error);
    return d;
  };
  try {
    room = await api("/api/rooms", null, { demo: true }, 201);
    const path = "/api/rooms/" + room.id;
    let old = room.token;
    await page.goto(base + "/spaces");
    await page.getByLabel("Your personal link").fill("bad link");
    await page.getByRole("button", { name: "Open this space" }).click();
    await page.getByRole("alert").waitFor();
    await page
      .getByLabel("Your personal link")
      .fill(base + "/space/" + room.id + "#key=" + room.token);
    await page.getByRole("button", { name: "Open this space" }).click();
    await page.locator(".life-main h1").waitFor();
    await page
      .getByRole("button", { name: "Give feedback", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await page.getByRole("dialog").waitFor();
    assert.ok(
      await page.evaluate(() =>
        document.querySelector("dialog").contains(document.activeElement),
      ),
    );
    await page.keyboard.press("Escape");
    assert.ok(
      await page
        .getByRole("button", { name: "Give feedback", exact: true })
        .evaluate((el) => el === document.activeElement),
    );
    await page.goto(
      base + "/space/" + room.id + "?tab=settings#key=" + room.token,
    );
    await page
      .getByRole("button", { name: "Download access backup" })
      .waitFor();
    let download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download access backup" }).click();
    assert.ok(
      fs
        .readFileSync(await (await download).path(), "utf8")
        .includes("#key=" + room.token),
    );
    download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export my data" }).click();
    const data = fs.readFileSync(await (await download).path(), "utf8");
    assert.equal(data.includes(room.token), false);
    assert.equal(data.includes(room.demoPartnerToken), false);
    assert.equal(JSON.parse(data).id, room.id);
    await page
      .getByText("Replace a link that may have been shared", { exact: true })
      .click();
    await page.getByRole("button", { name: "I need a new link" }).click();
    await page
      .getByRole("button", { name: "Replace my personal link", exact: true })
      .click();
    await page.waitForURL(
      (url) => new URLSearchParams(url.hash.slice(1)).get("key") !== old,
    );
    room.token = new URLSearchParams(new URL(page.url()).hash.slice(1)).get(
      "key",
    );
    await page
      .getByRole("heading", { name: "Your space, your choices." })
      .waitFor();
    await api(path, old, undefined, 403);
    await api(path, room.demoPartnerToken);
    await page
      .getByRole("button", { name: "Delete our space", exact: true })
      .click();
    assert.ok(
      await page
        .getByRole("button", { name: "Permanently delete space" })
        .isDisabled(),
    );
    await page.getByRole("button", { name: "Keep our space" }).click();
    await page
      .getByRole("button", { name: "Delete our space", exact: true })
      .click();
    await page
      .getByLabel("Type DELETE to remove this space for both people")
      .fill("DELETE");
    await page
      .getByRole("button", { name: "Permanently delete space" })
      .click();
    await page
      .getByRole("heading", { name: "Shared bills. A plan for both of you." })
      .waitFor();
    deleted = true;
    await api(path, room.demoPartnerToken, undefined, 404);
    await page.goto(base + "/space/" + room.id + "#key=" + room.token);
    await page.getByRole("heading", { name: "Find your way home." }).waitFor();
    await page.getByRole("link", { name: "Find my spaces" }).click();
    await page.getByLabel("Your personal link").waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.deepEqual(errors, []);
    console.log(
      "Access browser flow passed: restore validation, keyboard dialog focus, backup/export, personal-link rotation, partner access, deletion confirmation and missing-space recovery.",
    );
  } finally {
    if (room && !deleted) {
      const s = await api("/api/rooms/" + room.id + "/workspace", room.token);
      await api("/api/rooms/" + room.id + "/access", room.token, {
        action: "delete",
        revision: s.revision,
        confirmation: "DELETE",
      });
    }
    await browser.close();
  }
})().catch((e) => {
  console.error(e.message.replace(/#key=[^\s"']+/g, "#key=[hidden]"));
  process.exit(1);
});
