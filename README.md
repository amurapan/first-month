# First Month

A shared spending plan for couples moving in together: agree on expenses, compare contributions, decide who pays, and review changes together.

## Current status

The repository contains the budget calculations, plan approval logic, and research materials. The web interface, persistence, and model integration are still to be built.

## Development

Requires Node.js 22 or later. The current domain modules have no external dependencies.

```sh
npm test
```

## Domain logic

- `src/domain/budget.js`: equal, income-based, and custom contributions, calculated in integer cents. Personal commitments affect remaining money without silently changing contribution ratios.
- `src/domain/review.js`: separate decisions for both partners. Revising a plan clears previous approvals, and stale versions cannot be accepted.
- `test/domain.test.js`: rounding, income changes, invalid inputs, and agreement transitions.

The review module is a state model. The server must still enforce role access and atomic version checks.

## Research

`research/evidence.csv` links seven public accounts and separates reported behavior from interpretation. These are secondary sources, not interviews with verified participants.

`research/worksheet.txt` and the role cards form a paper prototype. `research/userbrain-study-en.txt` contains a draft usability study. No participant sessions have been conducted yet.

Keep credentials in local environment files. Keep private participant notes in `research/private/`; both are excluded from Git.
