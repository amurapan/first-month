// Automated WCAG checks cover selected states; they do not replace a human audit.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:5173";
(async () => {
  const browser = await chromium.launch({
      headless: true,
      ...(process.env.CHROME_BIN
        ? { executablePath: process.env.CHROME_BIN }
        : {}),
    }),
    page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
  const results = [],
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let room;
  const api = async (path, key, data) => {
    const r = await fetch(base + path, {
      method: data ? "POST" : "GET",
      headers: {
        ...(key ? { Authorization: "Bearer " + key } : {}),
        ...(data ? { "Content-Type": "application/json" } : {}),
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    const d = await r.json();
    assert.ok(r.ok, d.error);
    return d;
  };
  async function scanAtWidth(name) {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    await page.addScriptTag({
      path: process.env.AXE_SCRIPT || require.resolve("axe-core/axe.min.js"),
    });
    const result = await page.evaluate(() =>
      axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      }),
    );
    results.push({
      name,
      violations: result.violations.map((x) => ({
        id: x.id,
        impact: x.impact,
        description: x.description,
        nodes: x.nodes.map((n) => ({
          target: n.target,
          text: n.html.slice(0, 160),
          failure: n.failureSummary,
        })),
      })),
    });
  }
  async function scan(name) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await scanAtWidth(name + " desktop");
    await page.setViewportSize({ width: 390, height: 900 });
    await scanAtWidth(name + " mobile");
    await page.setViewportSize({ width: 1440, height: 1000 });
  }

  try {
    for (const [path, name] of [
      ["/", "landing"],
      ["/start", "start"],
      ["/spaces", "restore"],
      ["/privacy", "privacy"],
      ["/terms", "terms"],
    ]) {
      await page.goto(base + path);
      await page.locator("h1").waitFor();
      await scan(name);
    }
    room = await api("/api/rooms", null, { demo: true });
    let state = await api("/api/rooms/" + room.id + "/workspace", room.token);
    const did = state.householdDecisions.find((x) => x.status === "open").id;
    for (const [tab, extra] of [
      ["home", ""],
      ["budget", "&section=2"],
      ["months", ""],
      ["decisions", "&decision=" + did],
      ["reviews", ""],
      ["settings", ""],
    ]) {
      await page.goto(
        base +
          "/space/" +
          room.id +
          "?tab=" +
          tab +
          extra +
          "#key=" +
          room.token,
      );
      await page.locator(".life-main h1").waitFor();
      await scan(tab);
      if (tab === "reviews") {
        await page.getByRole("button", { name: "Edit my check-in" }).click();
        await scan("review-form");
      }
    }
    const report = require("node:path").resolve(
      __dirname,
      "../web/.sites-runtime/accessibility-report.json",
    );
    fs.mkdirSync(require("node:path").dirname(report), { recursive: true });
    fs.writeFileSync(report, JSON.stringify({ results, errors }, null, 2));
    console.log(
      JSON.stringify(
        results.map((x) => ({
          name: x.name,
          violations: x.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.length,
          })),
        })),
      ),
    );
    assert.deepEqual(errors, []);
    assert.ok(
      results.every((x) => x.violations.length === 0),
      "Accessibility violations found; see " + report,
    );
  } finally {
    if (room) {
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
