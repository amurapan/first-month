# Running First Month locally

[Back to the project](../README.md)


Requires Node.js 22.13 or later.

```sh
git clone https://github.com/amurapan/first-month.git
cd first-month
npm --prefix web run install:ci
npm run build
```

## Initialize the local database

On a fresh local database, apply the five schema migrations once:

```sh
cd web
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_cultured_inhumans.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_daily_anita_blake.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_workable_bug.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0003_lively_mephisto.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0004_eminent_ironclad.sql
cd ..
npm run dev
```

Open the URL printed by the dev server. For a local model connection, set the names from `web/.env.example` in an ignored `web/.dev.vars` file. Production secrets are configured separately with the hosting provider.

## Verification

```sh
npm test
node web/node_modules/typescript/bin/tsc -p web/tsconfig.json --noEmit
# With the local server running:
npm run check:api
npm run check:household
npm run check:month
npm run check:onboarding
node web/scripts/check-month-continuity.mjs
```

The domain tests cover exact-cent allocations and savings schedules, unknown versus zero income, incomplete personal budgets, weekly boundaries, private perspectives, and agreement transitions. The API check creates fictional local records and verifies role authorization, private-field redaction, invitation reuse, stale writes, both approvals, persisted check-ins, and isolation of preliminary estimates from actual partner answers. The household check also verifies cross-household isolation, purchase approvals, per-role saving progress, weekly actions, immutable history, atomic recurring-cost application, key rotation, and deletion. The monthly check additionally covers refunds, recorded payers, receipt confirmations, idempotent additions, fixed historical ratios, concurrent-edit rejection, two-person corrections, and closed history. The onboarding check covers minimal invitation previews, private feedback, repeat submissions, rate limits, author-only export, and household deletion. The continuity check covers preparing the next month, copying only confirmed settings, separate unsettled balances, stale source revisions, calendar boundaries, and sharing restrictions. The checks remove their own fictional test rooms. Set `TEST_BASE_URL` explicitly to test another environment.

## Project layout

- `web/app/`: pages and HTTP endpoints
- `web/components/start-wizard.tsx`: the two-step local starting calculation
- `web/components/space-app.tsx` and `space/`: household dashboard, decisions, check-ins, and settings
- `web/components/plan-app.tsx`: budget sections inside the shared workspace and printable agreement
- `web/lib/room.ts`: authorization, monthly-plan storage, and data visibility
- `web/lib/life.ts` and `conversation.ts`: household decisions, check-ins, and contextual generation
- `web/lib/months.ts` and `month-types.ts`: monthly ledger, receipts, and versioned confirmation
- `web/components/space/month-book.tsx`: monthly review and fast entry
- `web/lib/domain/`: deterministic budget, ledger and approval logic
- `web/db/` and `web/drizzle/`: D1 schema and migrations
- `research/`: source accounts and draft participant studies

## Screenshot capture

The screenshots in the README come from a temporary fictional sample household. They are captured from the application, with no access tokens or real customer data in the images. The script deletes its sample household when finished.

Install Playwright locally without changing the application dependencies, then capture against a running local server:

```sh
npm install --no-save --package-lock=false playwright axe-core
npx playwright install chromium
node scripts/capture-screenshots.cjs
```

Optional environment variables: `TEST_BASE_URL` selects the server, `CHROME_BIN` selects an existing Chrome/Chromium binary, and `PLAYWRIGHT_MODULE` selects an existing Playwright installation. The default URL is `http://127.0.0.1:5173`.

The access-browser regression can also be run after installing Playwright:

```sh
node scripts/check-access.cjs
```

It creates its own fictional household, verifies restore/backup/export/rotation/deletion, and cleans up afterward. The same environment variables as screenshot capture are supported.

For automated accessibility checks on desktop and mobile:

```sh
node scripts/check-accessibility.cjs
```

`AXE_SCRIPT` can point to an existing `axe.min.js`; otherwise `axe-core` is resolved normally. The report is written to ignored `web/.sites-runtime/accessibility-report.json`. A failing rule or browser error makes the command fail. Automated checks do not establish full WCAG conformance.
