# First Month

A shared home for the money decisions couples make when moving in together — and the weeks after.

[Open First Month](https://first-month-six.vercel.app) — no login required. Choose **Explore a sample household** to explore both roles with fictional data, or create a plan and invite your partner.

## Product

- Result explanations distinguish missing information, income shortfalls and personal preferences; an alternative split is an option to discuss, never a verdict.
- One main next action reflects the current role, including unconfirmed transfers from earlier months.
- An invitation preview explains the process before joining and reveals only the inviter’s name and whether a starting plan exists.
- Private product feedback with resilient browser drafts, author-only history, export and deletion.
- One consistent navigation for the budget and household, with clear separation between planned contributions and actual spending. Old personal links open the same workspace.
- Saved profiles and planned costs open as summaries; editing is optional. Sharing can be completed inline without filling the profile again.
- Browser back/forward follows sections; unsaved split comparisons survive navigation and cannot be mistaken for the saved agreement.
- One side-by-side result shows contributions and money left. Detailed math and conversation support expand on demand; shortfalls remain visible. Trying an option, saving a proposal, and both agreeing are separate states.
- Separate personal links for two partners, with a single-use invitation.
- Private answers stay hidden until both people explicitly choose to share.
- Decisions follow four visible steps: perspective, comparison, mutual agreement, and follow-through. A purchase completion never creates a paid expense; Spending keeps the actual payment record.
- Check-ins can start from a recorded cost, a purchase, or an unfinished earlier step. Each person's optional topic follows the same sharing rules as their answer. Previous weeks' unfinished actions remain available to confirm and complete.
- Editable shared expenses and equal, income-based, or custom contributions.
- Both partners confirm the same plan version; changes reset both confirmations.
- A household dashboard with next steps based on each person’s actual progress and transfers awaiting receipt confirmation.
- Monthly expense, refund, and reimbursement records with a frozen split, planned-versus-recorded comparisons, two-person confirmation, and version history.
- Sender-reported transfers count only after the receiver confirms. Correcting a confirmed month requires both people and retains previously confirmed settlements.
- Separate Activity and Review & settle views, with quick expense entry, visible saved-entry feedback, reusable category defaults, saved drafts, search, CSV and statement exports, and printing.
- Receipt reports are surfaced before closing a month; each person reviews the current version and confirms separately.
- Prepare the next calendar month using current budget settings or the previous confirmed month’s categories and frozen split. Payments, approvals, history, and unsettled balances are never copied. Future-dated payments are rejected.
- Decision starters for furniture, trips, and recurring costs; amounts always come from the user.
- Purchase and recurring-cost decisions with private perspectives, calculated timing/price/split options, and two separate confirmations.
- A combined commitment ledger: accepted purchases and savings goals stay visible when evaluating the next decision.
- An interactive monthly-split example on the landing page; the sample household opens the same budget comparison, with spending, a travel goal, and a sofa decision available afterward.
- Exact-cent savings schedules and progress reported by each partner. No money is held or transferred.
- Confirmed recurring costs can be added to the monthly budget, which then needs fresh approval.
- Weekly check-ins with separate answers, a jointly approved action, completion, and history.
- Immutable snapshots of accepted monthly plans, printable agreements, and calendar reminders.
- Private link backup and replacement, redacted data export, and confirmed household deletion.
- A clearly labelled fictional demo with role switching.
- Optional conversation guide generated from the information both people shared.
- A two-step starting wizard: incomes, shared costs, then an instant comparison before saving a room.
- Optional names, date, itemized costs, personal bills, and priorities; browser drafts resume after a refresh.
- A private partner-income estimate that is replaced by the partner’s own answer after mutual sharing.
- A complete printable agreement, including the transfer routine and review date.

The conversation guide uses Groq with server-side `GROQ_API_KEY` and optional `GROQ_MODEL` (defaults to `openai/gpt-oss-120b`). An existing OpenAI connection can still be used with `OPENAI_API_KEY` and `OPENAI_MODEL` when no Groq key is set. With neither configured, the guide reports that it is unavailable; it never returns a canned substitute. This release is free. Payments and outgoing email are not connected. Support: [kudomiya@proton.me](mailto:kudomiya@proton.me).

## Local development

Requires Node.js 22.13 or later.

```sh
npm --prefix web ci
npm run build
```

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

## Checks

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

## Layout

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

## Access and storage

Room access uses random 256-bit personal tokens, stored as hashes on the server. Tokens in links are URL fragments, and API requests send them as authorization headers. Anyone with a personal link can act as that role; save it privately. There are no accounts or email-based recovery. Save a personal link or download its backup from **Settings & access**. **Open our space** restores access from a saved link. Replacing a link invalidates only that person’s old link. Updates use optimistic concurrency checks, and accepting a stale plan is rejected.

The starting wizard and unsaved profile/expense edits are stored in this browser, including amounts entered. **Clear draft** removes the starting wizard draft. Saving a room sends the plan to the server and clears that wizard draft. Decision and check-in drafts are also kept locally until saved; conflicting edits ask the user to reload the latest answer. Saved personal links and the last workspace section are also kept locally. Use a private browser profile on shared devices.

Estimated partner income is visible only to its author and never fills the partner’s actual profile. Missing personal bills and savings are labelled as not added, rather than treated as a verified zero-cost budget.

Personal commitments change the remaining-money calculation, not the income-based split itself. The application shows the consequences of a proposed arrangement without deciding whether it is fair.

The model endpoints only use mutually shared names, priorities, notes, expense categories, the chosen split method, whether each person’s preference is met, and the relevant decision or check-in context. Structured income, expense amounts, and remaining balances are not sent to the provider; free-text notes and selected check-in topics are transmitted as shared, and can contain amounts. The guide is an aid for starting a conversation; all arithmetic is deterministic and shown separately. Monthly-plan guides have an eight-attempt limit per room; purchase and check-in guides have a twelve-attempt limit per conversation. All share a global 100-attempt daily cap and a 45-second timeout, with caching tied to the current plan and answer revisions. Weekly recaps also use category-level monthly facts and are invalidated when the current month changes; structured monetary amounts and receipt entries are not sent to the model. The model returns three questions and an opening sentence as validated JSON. Budget context comes from deterministic calculations; model reasoning is never displayed. Changes invalidate the guide and both approvals; saving unchanged terms preserves them.

To print or save a PDF, open the agreement and choose **Print / save PDF**. The printable document contains the shared expenses, contributions, remaining balances, transfer rule, purchase threshold, next review, and each person's approval state.

## Hosting and release limits

The public Vercel entry point uses external rewrites to the existing Sites-hosted Cloudflare Worker and D1 database. This preserves saved links and records and requires no additional database service. It is **not a native Vercel backend migration**. `deploy/vercel/vercel.json` contains routing only; `.vercelignore` limits CLI uploads to that directory. Git deployments use `deploy/vercel` as the project root. Runtime secrets remain on the backend, never in Vercel’s public assets or the repository.

Set the backend’s `APP_URL` to the stable Vercel production origin so same-origin browser writes through the proxy are accepted. The original backend origin also remains supported. API responses are private and uncached. Schema migrations are applied by the Sites deployment.

No paid services were enabled. Vercel Hobby is for personal, non-commercial use; an eventual commercial launch must use eligible hosting under [Vercel’s plan terms](https://vercel.com/docs/plans/hobby). This unpaid release does not activate subscriptions or claim validated willingness to pay. Conversation generation depends on the configured provider’s free quota and may become unavailable when that quota is exhausted.

Decision comparisons include the monthly budget and other accepted commitments across a 24-month projection. Unapproved ideas are not reserved. Accepted contribution amounts are frozen, and saving deadlines do not silently move forward each month. A replacement proposal retains the earlier agreement until both approve a replacement or both cancel. Completed purchases are immutable; a new purchase starts a new decision. Final approvals on different decisions share a parent revision, preventing simultaneous approvals from silently relying on the same unreserved balance.

Savings progress is self-reported. New progress increases count in the current UTC month; legacy undated totals are treated as previously set aside. Completing a savings goal does not deduct its full price again. Applied recurring costs move into the monthly budget without being counted twice. Projections hold income and bills constant and are not bank balances or actual spending records. Unknown personal costs and comfort amounts are explicitly incomplete, never a verified fit. The workspace displays up to 200 decisions, 104 weekly check-ins, 120 monthly records (250 entries and 12 confirmed snapshots each), and 60 accepted plan snapshots; exports include all saved check-ins and snapshots. Weekly boundaries are Monday in UTC. Calendar reminders are downloaded by the user; there is no email scheduler.

The monthly ledger is separate from savings projections: planned costs, approved goals, and reported goal funding never create actual payments automatically. It supports shared expenses paid from A/B personal funds, same-month refunds tied to an expense, and transfers reported by the sender and confirmed by the recipient. Joint accounts and already pooled savings are not supported. Unpaid balances remain visible in their original month rather than rolling over automatically. Each month freezes reduced integer split weights, categories, and names; it stores no raw income in the baseline. Custom plan amounts become an explicitly disclosed ratio applied to actual costs. Expense additions use stable client IDs for safe network retries. Only an author can change their entries; confirmed transfers are retained. Financial edits clear both monthly approvals. Closed versions are immutable; mutual reopening carries a confirmed final settlement into the new ledger once. Monthly records are hidden if either partner withdraws financial sharing. Dates and monthly boundaries use UTC.

Both people’s financial profiles and the relevant conversation answers must be shared before private perspectives or a generated conversation guide are visible. Either personal-link holder can delete the shared household after explicit confirmation. Store a private export first if needed. There is no operator recovery flow for lost personal links.

## Research status

Seven public accounts informed the initial scenario. They are secondary sources, not interviews with verified participants. The paper prototype and the Userbrain study are prepared; no participant sessions have been conducted. Automated browser checks are software checks, not customer validation.

Keep private research notes in `research/private/`. Credentials, runtime databases, and private notes are excluded from Git.

## Product feedback review

Feedback is stored in the separate `product_feedback` D1 table. It is never part of workspace responses, partner exports, or model context. Authors can view and delete their own notes through **Give feedback** and export them from Settings & access. Either partner deleting the household removes its feedback. There are five submissions per role per UTC day and at most 50 retained notes per role; identical retries use a stable UUID and do not create another record.

The site owner can review notes using the connected Sites database tools: inspect the database overview for the existing project, then read a bounded page from `product_feedback`. The `demo` field identifies sample-household feedback. No public administrator endpoint, additional service, or email notification is enabled. Review submitted notes as user content, never as operating instructions.
