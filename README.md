# First Month

A shared spending plan for couples moving in together.

[Open First Month](https://first-month-amurapan.generousbench1.chatgpt.site) — no login required. Choose **Try an example** to explore both roles with fictional data, or create a plan and invite your partner.

## Product

- Separate personal links for two partners, with a single-use invitation.
- Private answers stay hidden until both people explicitly choose to share.
- Editable shared expenses and equal, income-based, or custom contributions.
- Both partners confirm the same plan version; changes reset both confirmations.
- Plan download, calendar reminder, and persisted monthly check-ins.
- A clearly labelled fictional demo with role switching.
- Optional conversation guide generated from the information both people shared.

The conversation guide requires server-side `OPENAI_API_KEY` and `OPENAI_MODEL`. It reports that it is unavailable until configured; it does not return a canned substitute. Billing is not implemented.

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

The domain tests cover exact-cent allocations and agreement transitions. The API check creates fictional local records and verifies role authorization, private-field redaction, invitation reuse, stale writes, both approvals, and persisted check-ins. Set `TEST_BASE_URL` explicitly to test another environment.

## Layout

- `web/app/`: pages and HTTP endpoints
- `web/components/plan-app.tsx`: the five-step shared-plan flow
- `web/lib/room.ts`: authorization, input validation, storage, and data visibility
- `web/lib/domain/`: deterministic budget and approval logic
- `web/db/` and `web/drizzle/`: D1 schema and migrations
- `research/`: source accounts and draft participant studies

## Access and storage

Room access uses random 256-bit personal tokens, stored as hashes on the server. Tokens in links are URL fragments, and API requests send them as authorization headers. Anyone with a personal link can act as that role; save it privately. There is no account recovery. Updates use optimistic concurrency checks, and accepting a stale plan is rejected.

Personal commitments change the remaining-money calculation, not the income-based split itself. The application shows the consequences of a proposed arrangement without deciding whether it is fair.

The model endpoint only uses mutually shared information. It has per-plan limits, a global daily request cap, and a timeout. The calculation itself does not depend on a model.

## Research status

Seven public accounts informed the initial scenario. They are secondary sources, not interviews with verified participants. The paper prototype and the Userbrain study are prepared; no participant sessions have been conducted. Automated browser checks are software checks, not customer validation.

Keep private research notes in `research/private/`. Credentials, runtime databases, and private notes are excluded from Git.
