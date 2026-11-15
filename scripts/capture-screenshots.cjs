// Capture the real UI using a temporary, explicitly fictional household.
// Run against your own development or deployed instance; no user rooms are read.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:5173";
const output = path.resolve(__dirname, "../docs/images");

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_BIN
      ? { executablePath: process.env.CHROME_BIN }
      : {}),
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
    reducedMotion: "reduce",
    deviceScaleFactor: 1,
  });
  page.setDefaultTimeout(20000);
  let room;
  const api = async (route, key, data) => {
    const response = await fetch(base + route, {
      method: data ? "POST" : "GET",
      headers: {
        ...(key ? { Authorization: "Bearer " + key } : {}),
        ...(data ? { "Content-Type": "application/json" } : {}),
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    const body = await response.json();
    assert.ok(response.ok, body.error || "Screenshot fixture request failed");
    return body;
  };
  const read = (key) => api("/api/rooms/" + room.id + "/workspace", key);
  const go = async (tab, extra = "") => {
    await page.goto(
      base + "/space/" + room.id + "?tab=" + tab + extra + "#key=" + room.token,
    );
    await page.locator(".life-main h1").waitFor();
  };
  const capture = async (name, scrollTarget) => {
    await page.evaluate(() => document.fonts.ready);
    if (scrollTarget) await scrollTarget.scrollIntoViewIfNeeded();
    else await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(500); // Settle layout and sticky navigation before capture.
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      name + " overflows",
    );
    await page.screenshot({
      path: path.join(output, name + ".png"),
      animations: "disabled",
    });
  };
  try {
    await page.goto(base);
    await page
      .getByRole("heading", { name: "Shared bills. A plan for both of you." })
      .waitFor();
    await capture("landing");
    room = await api("/api/rooms", null, { demo: true });
    const state = await read(room.token);
    const decision = state.householdDecisions.find((x) => x.status === "open");
    await go("budget", "&section=2");
    await page.locator(".balance-result").waitFor();
    await capture("budget");
    await go("months");
    await page.locator(".spending-summary").waitFor();
    await capture("spending");
    await page.setViewportSize({ width: 1440, height: 1320 });
    await go("decisions", "&decision=" + decision.id);
    await page.locator(".decision-studio").waitFor();
    await capture("decisions");
    await go("reviews");
    await page.locator(".review-perspectives").waitFor();
    await capture("checkin");

    await page.setViewportSize({ width: 390, height: 960 });
    await go("budget", "&section=2");
    await page.locator(".balance-result").waitFor();
    await capture("mobile-budget");
    await go("months");
    await page
      .getByRole("button", { name: "Quick add expense", exact: true })
      .click();
    await page.getByLabel("Amount paid", { exact: true }).fill("64.50");
    await page
      .getByLabel("Category", { exact: true })
      .selectOption("groceries");
    await page.getByLabel("Amount paid", { exact: true }).blur();
    await capture("mobile-spending", page.locator(".month-entry-form"));

    let current = await read(room.token);
    let review = current.householdReviews.find(
      (x) => x.week === current.currentWeek,
    );
    current = await api("/api/rooms/" + room.id + "/workspace", room.token, {
      action: "reviewAction",
      roomRevision: current.revision,
      id: review.id,
      revision: review.revision,
      nextAction: {
        text: "Compare two sofa options before we buy",
        owner: "both",
        due: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      },
    });
    for (const key of [room.token, room.demoPartnerToken]) {
      current = await read(key);
      review = current.householdReviews.find(
        (x) => x.week === current.currentWeek,
      );
      await api("/api/rooms/" + room.id + "/workspace", key, {
        action: "approveReview",
        roomRevision: current.revision,
        id: review.id,
        revision: review.revision,
      });
    }
    await go("reviews");
    await page.locator(".weekly-action").waitFor();
    await capture("mobile-checkin", page.locator(".weekly-action"));
    console.log("Captured 8 actual UI screenshots with fictional sample data.");
  } finally {
    try {
      if (room) {
        const state = await read(room.token);
        await api("/api/rooms/" + room.id + "/access", room.token, {
          action: "delete",
          revision: state.revision,
          confirmation: "DELETE",
        });
      }
    } finally {
      await browser.close();
    }
  }
}
main().catch((error) => {
  console.error(error.message.replace(/#key=[^\s"']+/g, "#key=[hidden]"));
  process.exitCode = 1;
});
