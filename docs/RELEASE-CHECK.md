# Release check · November 15, 2026

[Project overview](../README.md) · [Live product](https://first-month-six.vercel.app) · [Development](DEVELOPMENT.md)

The engineering pass is complete for the scenarios below. The [10-slide PDF pitch](pitch/first-month-pitch.pdf) is prepared; the captain's submission remains. Real-user feedback can still reveal improvements beyond these software checks.

## Requirements from the supplied hackathon slides

The review used all five supplied slide photographs. This is a transcription of the relevant requirements, not a claim of additional organizer approval.

| Requirement | Current state |
| --- | --- |
| One track | **Money**: shared expenses, purchase planning, and financial coordination. |
| B2C for US adults, 25–45 | English-language, USD product for couples moving in together. Audience selection is explicit; customer demand is not yet validated. |
| Browser-based working product | Public production app with persisted two-person state, real calculations, and optional live conversation generation. |
| No signup or login required | Personal access links; a single-use partner invitation; an independently created fictional sample household for solo review. |
| Core value must work with real inputs | Users enter their own numbers and answers. Deterministic calculations, versioned approvals, expenses, and contextual model calls are functional. Sample data is labelled. |
| Public source repository | [amurapan/first-month](https://github.com/amurapan/first-month) was accessible without authentication; GitHub reported `private: false`. |
| Production URL | [first-month-six.vercel.app](https://first-month-six.vercel.app) is reachable without an access request. |
| PDF pitch deck, up to 10 slides | **Prepared:** [10-slide PDF](pitch/first-month-pitch.pdf), with actual app screenshots, demo QR, source links, and explicitly hypothetical business figures. |
| One submission per team, by the captain | **Remaining.** Submit the PDF, production URL, and GitHub URL together. |

The slides describe a 24-hour event. The captain must use the organizer's actual deadline and any subsequent clarifications; source-code checks cannot establish timing eligibility.

## Judging criteria and the evidence we have

| Weight | Criterion | Evidence and remaining limits |
| --- | --- | --- |
| 40% | Product & engineering | Working deployed flows, persistent records, exact-cent domain tests, API checks, two-role browser checks, recoverable errors, and a public repository. |
| 20% | Value & retention | Budget changes, recording shared bills, purchase decisions, weekly actions, and month-end review provide repeat-use scenarios. Actual retention and willingness to pay remain unmeasured. |
| 15% | Problem & user | Narrow moving-in scenario; seven public accounts recorded in [research](../research/findings-ru.txt). No verified participant interviews. |
| 15% | Business potential | The [deck](pitch/README.md) includes sourced broad market context, a hypothetical $10/month household subscription, an illustrative $100M ARR scale calculation, acquisition plans, and LTV sensitivity assumptions. None is a measured CAC, LTV, conversion, retention, or revenue result. |
| 10% | Originality | Specific two-person workflow joining private perspectives, explicit approvals, and planned-versus-recorded money. Competitors exist; uniqueness is not claimed. |

## Functional verification

| Area | Result |
| --- | --- |
| Domain logic | **66 tests passed**: exact-cent allocation, saving schedules, unknown versus zero income, commitment planning, approval transitions, monthly ledger logic, and date boundaries. |
| Base API | **54 checks passed** against production and an isolated local installation. Role authorization, invitations, mutual sharing, private estimates, stale writes, and approvals. |
| Household API | **167 checks passed**: private answers and topics, purchase approvals, savings, weekly actions, recurring costs, histories, scoped export, link rotation, and deletion. |
| Monthly API | **92 checks passed**: expenses, refunds, sender/recipient roles, idempotent writes, frozen ratios, concurrent edits, settlements, corrections, and history. |
| Onboarding API | **35 checks passed**: invitation privacy, private feedback, rate limits, retries, export, and deletion. |
| Month continuity API | **40 checks passed**: clean next-month preparation, confirmed settings, separate old balances, future-date restrictions, and stale source revisions. |
| TypeScript and production build | Passed. |
| Clean installation | Installed the locked dependencies in an isolated source copy, built it, applied all five local migrations, started it on a separate port, and passed the base API checks. No production database or real user household was modified. |

**388 API checks across the five suites**, in addition to the domain and browser checks. The test scripts create fictional households and delete their own records.

## Browser scenarios exercised

- **Starting and joining:** the two-step comparison, different/unknown incomes, the private partner-income estimate, invitation preview, own-browser invitation guard, second partner joining, mutual sharing, and replacing an estimate with the partner's actual answer.
- **Budget and navigation:** saved summaries, inline sharing, editing drafts, conflicts, exact-cent custom contributions, explicit proposal save, separate approvals, browser back/forward, old personal URLs, and printable agreement.
- **Spending:** quick entry, reusable defaults, saved-entry feedback, failed-save recovery, edit/refund, recipient-only receipt confirmation, two-person month close, reimbursement, mutual correction, CSV/statement/print, and an empty prepared next month.
- **Decisions:** private perspectives, comparison, two approvals, updated proposals arriving from the partner, savings-completion gating, recurring costs applied to the budget, and purchase completion without creating a paid expense.
- **Check-in:** private topics, persistent drafts, failed-save recovery, next-step owner/date, both confirmations, completion, and an unfinished action still available after a simulated week boundary.
- **Access and control:** invalid-link feedback, restored access, keyboard dialog focus, downloaded access backup, token-free data export, personal-link replacement, the old link being rejected, continued partner access, explicit deletion, and missing-space recovery.
- **Motion:** real pending generation, first-result reveal/skip, precise accessible money values, negative and zero values, reduced-motion behavior, and print output.

Layouts were exercised at **320, 360, 390, 768, 1024, and 1440 pixels** across the core flows. Browser automation used Chromium. Safari, Firefox, real mobile devices, and assistive-technology sessions were not covered.

## Findings fixed during this pass

1. **Early input on the restore page could disappear before hydration.** The link field and submit button now wait until their handlers are attached. The restoration regression exercises invalid and valid links, followed by export, rotation, and deletion.
2. **Secondary text was too faint on several surfaces.** Adjusted captions, option labels, status labels, legal copy, and mobile navigation while retaining the existing palette.
3. **Two allocation graphics had unsupported ARIA labels on generic elements.** Both now have an image role with their existing accessible names.

Axe-core reported **zero WCAG 2 A/AA and WCAG 2.1 AA rule violations in the 24 scanned states**: 12 screens/states at desktop and mobile widths. This is an automated result for those states, not a full accessibility certification. The scanner runs after fonts and entrance motion settle, so temporary animation opacity is not mistaken for the resting text color.

## Model availability and error handling

Live conversation generation was checked on the public site. The configured provider is a runtime dependency with a finite quota; an unavailable model produces an explicit error with retry rather than a canned response.

The original local development environment encountered an upstream TLS failure when calling the model. The isolated installation without a configured key correctly reported that generation was unavailable, and its base API suite passed. Production generation was checked separately. TLS verification was not disabled.

## Reproduce the checks

Core commands are in [Development](DEVELOPMENT.md#verification). The browser access regression and accessibility scanner are committed in [scripts](../scripts). Both support `TEST_BASE_URL`, an existing Playwright installation, and an optional Chrome path.

The [screenshot script](../scripts/capture-screenshots.cjs) captures the actual interface from a temporary sample household. The README images contain fictional data and no personal access tokens.

## Submission package

- [PDF pitch deck](pitch/first-month-pitch.pdf), exactly 10 slides: problem, audience, live workflow, value, return loop, market/business assumptions, differentiation, and validation status. [Editable source, speaking notes, and sources](pitch/README.md) are included. PDF checks cover page count, 16:9 dimensions, selectable Cyrillic text, embedded fonts, link annotations, and QR decoding; all pages were visually reviewed.
- Production URL: `https://first-month-six.vercel.app`
- Public source: `https://github.com/amurapan/first-month`
- **Remaining:** captain's submission before the organizer's deadline. Preparing and publishing these files does not submit the entry.

Actual payment collection remains intentionally disabled. Human usability, demand, and willingness-to-pay validation are future product work, not completed research.
