const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

async function main() {
  const root = path.resolve(__dirname, "..");
  const output = path.join(root, "docs/pitch/first-month-pitch.pdf");
  const preview = process.env.PITCH_PREVIEW_DIR;
  if (preview) fs.mkdirSync(preview, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_BIN
      ? { executablePath: process.env.CHROME_BIN }
      : {}),
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1600, height: 900 },
      deviceScaleFactor: 1,
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.emulateMedia({ media: "print", reducedMotion: "reduce" });
    await page.goto(
      pathToFileURL(path.join(root, "docs/pitch/index.html")).href,
    );
    await page.evaluate(() => document.fonts.ready);
    const audit = await page.evaluate(() => {
      const slides = [...document.querySelectorAll(".slide")];
      const missingImages = [...document.images]
        .filter((image) => !image.complete || !image.naturalWidth)
        .map((image) => image.getAttribute("src"));
      const overflow = [];
      slides.forEach((slide, index) => {
        const box = slide.getBoundingClientRect();
        const walker = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          if (!node.textContent.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const rect of range.getClientRects()) {
            const bottom = node.parentElement.closest("footer")
              ? box.bottom - 20
              : box.bottom - 88;
            if (
              rect.left < box.left + 25 ||
              rect.right > box.right - 25 ||
              rect.bottom > bottom
            ) {
              overflow.push({
                slide: index + 1,
                text: node.textContent.trim().slice(0, 90),
              });
              break;
            }
          }
        }
      });
      return { slides: slides.length, missingImages, overflow };
    });
    if (
      audit.slides !== 10 ||
      audit.missingImages.length ||
      audit.overflow.length ||
      errors.length
    ) {
      throw new Error(JSON.stringify({ ...audit, errors }, null, 2));
    }
    await page.pdf({
      path: output,
      preferCSSPageSize: true,
      printBackground: true,
      displayHeaderFooter: false,
      tagged: true,
      outline: true,
    });
    if (preview) {
      for (let index = 0; index < audit.slides; index += 1) {
        await page
          .locator(".slide")
          .nth(index)
          .screenshot({
            path: path.join(
              preview,
              `slide-${String(index + 1).padStart(2, "0")}.png`,
            ),
          });
      }
    }
    console.log(
      `Built ${path.relative(root, output)}: ${audit.slides} slides; images and text bounds checked.`,
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
