# First Month

A shared spending plan for couples moving in together.

[Open First Month](https://first-month-amurapan.generousbench1.chatgpt.site) — no login required. Choose **Explore a sample plan** to explore both roles with fictional data, or create a plan and invite your partner.

## Product

- Separate personal links for two partners, with a single-use invitation.
- Private answers stay hidden until both people explicitly choose to share.
- Editable shared expenses and equal, income-based, or custom contributions.
- Both partners confirm the same plan version; changes reset both confirmations.
- Plan download, calendar reminder, and persisted monthly check-ins.
- A clearly labelled fictional demo with role switching.
- Optional conversation guide generated from the information both people shared.
- A two-step starting wizard: incomes, shared costs, then an instant comparison before saving a room.
- Optional names, date, itemized costs, personal bills, and priorities; browser drafts resume after a refresh.
- A private partner-income estimate that is replaced by the partner’s own answer after mutual sharing.
- A complete printable agreement, including the transfer routine and review date.

The conversation guide uses Groq with server-side `GROQ_API_KEY` and optional `GROQ_MODEL` (defaults to `openai/gpt-oss-120b`). An existing OpenAI connection can still be used with `OPENAI_API_KEY` and `OPENAI_MODEL` when no Groq key is set. With neither configured, the guide reports that it is unavailable; it never returns a canned substitute. Billing is not implemented.

## Local development

Requires Node.js 22.13 or later.

```sh
npm --prefix web ci
npm run build
```

On a fresh local database, apply the two schema migrations once:

```sh
cd web
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_cultured_inhumans.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_daily_anita_blake.sql
cd ..
npm run dev
```

Open the URL printed by the dev server. For a local model connection, set the names from `web/.env.example` in an ignored `web/.dev.vars` file. Production secrets are configured separately with the hosting provider.

## Checks

```sh
npm test
npm --prefix web exec -- tsc --noEmit
# With the local server running:
npm run check:api
```

The domain tests cover exact-cent allocations, unknown versus zero income, incomplete personal budgets, and agreement transitions. The API check creates fictional local records and verifies role authorization, private-field redaction, invitation reuse, stale writes, both approvals, persisted check-ins, and isolation of preliminary estimates from actual partner answers. Set `TEST_BASE_URL` explicitly to test another environment.

## Layout

- `web/app/`: pages and HTTP endpoints
- `web/components/start-wizard.tsx`: the two-step local starting calculation
- `web/components/plan-app.tsx`: the shared-plan workspace
- `web/lib/room.ts`: authorization, input validation, storage, and data visibility
- `web/lib/domain/`: deterministic budget and approval logic
- `web/db/` and `web/drizzle/`: D1 schema and migrations
- `research/`: source accounts and draft participant studies

## Access and storage

Room access uses random 256-bit personal tokens, stored as hashes on the server. Tokens in links are URL fragments, and API requests send them as authorization headers. Anyone with a personal link can act as that role; save it privately. There is no account recovery. Updates use optimistic concurrency checks, and accepting a stale plan is rejected.

The starting wizard and unsaved profile/expense edits are stored in this browser, including amounts entered. **Clear draft** removes the starting wizard draft. Saving a room sends the plan to the server and clears that wizard draft. Saved personal links and the last workspace section are also kept locally. Use a private browser profile on shared devices.

Estimated partner income is visible only to its author and never fills the partner’s actual profile. Missing personal bills and savings are labelled as not added, rather than treated as a verified zero-cost budget.

Personal commitments change the remaining-money calculation, not the income-based split itself. The application shows the consequences of a proposed arrangement without deciding whether it is fair.

The model endpoint only uses mutually shared names, priorities, notes, expense categories, the chosen split method, and whether each person's preference is met. Structured income, expense amounts, and remaining balances are not sent to the provider; free-text notes are transmitted as entered. The guide is an aid for starting a conversation; all arithmetic is deterministic and shown separately. Guide requests have an eight-attempt limit per room, a global 100-attempt daily cap, a 45-second timeout, and caching for the current plan version. The model returns three questions and an opening sentence as validated JSON. Budget context comes from deterministic calculations; model reasoning is never displayed. Changes invalidate the guide and both approvals; saving unchanged terms preserves them.

To print or save a PDF, open the agreement and choose **Print / save PDF**. The printable document contains the shared expenses, contributions, remaining balances, transfer rule, purchase threshold, next review, and each person's approval state.

## Research status

Seven public accounts informed the initial scenario. They are secondary sources, not interviews with verified participants. The paper prototype and the Userbrain study are prepared; no participant sessions have been conducted. Automated browser checks are software checks, not customer validation.

Keep private research notes in `research/private/`. Credentials, runtime databases, and private notes are excluded from Git.
