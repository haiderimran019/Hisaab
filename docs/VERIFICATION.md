# Verification — 21 October 2026

## Completed

- `npm test`: 101 passing tests in the app, plus 28 in `server/` covering precise settlement, decimal rounding, fees exceeding proceeds, PKR rate validation, invalid dates and July–June boundaries, every business-slab boundary, surcharge threshold, unsupported years, 154A rates/conditions including the PSEB sales-return exception, separate tax bases, withholding segregation, unsupported profiles, expense allocation, strict schemas, CSV formula injection, HTML escaping, zero confirmed export bases, unsafe aggregate precision, AJK/GB review gate and authenticated encrypted-backup round trips/tampering/wrong passphrases.
- `npm run build`: TypeScript check and Vite production build pass.
- Dependency installation audit: zero vulnerabilities in the installed dependency tree at installation. This is a point-in-time package audit, not a penetration test.
- Browser: income creation, editing and search with a six-decimal FX rate; script-shaped text safely rendered; expense business-use allocation; invoice creation, quantity × price and print preview; encrypted-vault setup with isolated synthetic QA data; no demo copied into vault; persistence across reload; locked reload; wrong-passphrase rejection; successful unlock; encrypted backup download; restore consent rejection and successful authenticated restore.
- Browser: tax gates and tax-year switching, FX calculator, source links and responsive desktop/mobile layouts. Screenshots contain only labelled synthetic demo data.

## Added 21 October 2026 — statement import, reconciliation, licensing, Filing Pack

- `npm test`: 36 further tests covering RFC-4180 parsing with quoted commas and CRLF, header detection under a bank title block, debit/credit sign handling, Dr/Cr markers, Pakistani money formats including lakh grouping and bracketed negatives, day-first and month-first dates, rejection of impossible dates, unreadable rows reported with their row numbers, both-debit-and-credit rows, duplicate detection within and across imports, fingerprint normalisation, missing-mapping refusals, own-transfer pairing and its time window, reconciliation differences, readiness blockers, duplicates excluded from balances, orphaned-account rejection, licence signature verification, forged and foreign-signed keys, expiry, unknown plans, whitespace tolerance, trial expiry, plan limits, monthly import counting, v1→v2 migration with no record loss, refusal of unknown workspace versions, and Filing Pack boundary text plus markup escaping.
- `npx tsc --noEmit` and `npm run build` pass.
- Browser (dev server, Chromium in the Claude pane): imported a synthetic HBL-style CSV with a three-line title block, a blank row, quoted commas, comma-grouped amounts and a TOTAL footer row. Five lines were read with correct signs and day-first dates; the TOTAL row was reported as unreadable, not imported. Committed the import; the account card then reported PKR 474,100.00 extra and unexplained rather than adjusting itself. Classified a line as income: the form prefilled from the statement line, the line became `income`, kept its row reference, and offered Undo. Created an account with comma-formatted balances. Printed the Filing Pack: the "Not reviewed" stamp, the unresolved-items front page and the red unexplained figure all rendered.
- Browser: created an encrypted workspace (14-day Pro trial started), activated a genuine signed Pro key (365 days), had a key with one tampered signature character rejected with a readable reason, and confirmed the licence survived lock and unlock — i.e. it is stored inside the encrypted vault. The throwaway test workspace was removed from browser storage afterwards.
- Browser: 375 × 812 mobile layout checked on the Statements page with no horizontal overflow.

### Not verified for this change

- No real customer bank statement has been imported. All import testing used synthetic files written for the purpose. Real Pakistani bank, Payoneer and Wise exports have not been seen, so the claim "supported today" in the empty state is a design intent, not a measured result.
- Cross-currency own transfers are not detected: the pairing heuristic matches equal amounts, so a USD withdrawal arriving as PKR is not offered as a pair and must be marked by hand.
- Free-plan gating was reviewed in code and its limit values are unit-tested, but the blocked paths were not exercised in the browser, because the test workspace was on a trial and then a Pro key.
- The Filing Pack has not been shown to a tax practitioner. No part of it has been professionally reviewed.
- No payment was taken, no refund processed, and the payment details in `src/pricing.ts` are deliberately empty.

## Added 21 October 2026 — interface rebuild, two-factor, privacy controls, review tick

- `npm test`: 23 further tests. Two-factor: base32 round-trips at every padding length, rejection of invalid secrets, **the three RFC 6238 published test vectors** (287082 / 081804 / 005924), drift of one step either side accepted and two steps refused, malformed codes refused without throwing, spaces tolerated, the otpauth link's contents, countdown bounds, recovery codes unique and stored only as hashes, and recovery matching regardless of case or separators. Review tick: verification against the exact pack, a changed figure turning it stale, a changed statement line turning it stale, a wrong tax year, an unpublished reviewer, a foreign signing key, unreadable input, fingerprint scope including record-order independence, and the pack's reviewed and unreviewed wording. Migration: v2 → v3 keeping statements and not inventing security settings.
- `npx tsc --noEmit` and `npm run build` pass. The built bundle contains no `new Worker` call; a CSP worker warning seen in the Vite dev server comes from the development environment, not from this application.
- Browser, two-factor end to end: created a workspace, set up two-factor, and confirmed it with a code computed by an **independent TOTP implementation written separately in the page** — which is what proves a real authenticator app will work. Locked; the passphrase alone then produced a "One more step" screen with no workspace data rendered behind it; a wrong code was refused with a readable reason; a recovery code opened the workspace; the same recovery code was refused on the next unlock; an authenticator code still worked afterwards.
- Browser, privacy controls: hide-amounts, never-touch-the-network and a 15-minute auto-lock were set, the workspace locked and reopened, and all three came back — confirming they persist inside the encrypted workspace rather than in plain browser storage.
- Browser, interface: the six-step home renders with the correct current step and progress ring, on desktop and at 375 × 812 with no horizontal overflow; the mobile bottom bar shows the pending-line badge; the Privacy page renders all ten sections.
- The throwaway test workspace was removed from browser storage afterwards.

### Not verified for this change

- No real authenticator app was used — interoperability is argued from the RFC test vectors and an independent implementation, which is strong evidence but is not the same as scanning the key into Google Authenticator on a phone. Do that once before launch.
- The review tick has never been exercised with a real practitioner's key, because none exists. It was tested with keys generated inside the test run.
- Clock-skew behaviour was tested by moving the timestamp, not by changing a device clock.
- Screen-reader and keyboard-only passes over the new interface have not been done; no accessibility audit has been performed.
- The new interface has not been tested on a real phone browser, only at phone dimensions in a desktop engine.

## Added 21 October 2026 — reported bugs, unnamed income, the service

- **Sidebar could not be scrolled.** With nine navigation entries the fixed-height column overflowed on a short window and the last items were unreachable. It now scrolls, with the bar hidden so it does not steal width from the labels; verified by scrolling to the end and measuring that the last control is on screen, and that the workspace switcher is back to a single line.
- **Printed invoices were clipped at the right edge.** The sheet ran to the paper edge with no page margin. Added `@page{margin:14mm}`, fixed table layout for print, and wrapping for long figures. Verified at 375 px: the paper is 351 px inside a 375 px viewport, no horizontal overflow, the table does not exceed the sheet, the preview scrolls to its end and its toolbar stays reachable.
- **Income with no client name.** `client` is now optional; blank reads as "No client recorded" rather than an empty cell, with a plain-text fallback in the aria-labels and an em dash in the avatar. Two tests assert a blank and a whitespace-only name both save, still count as domestic business income, and still reach the estimate.
- `server/`: 15 tests, no network and no wrangler needed, run against an in-memory store double. They cover the refusal of seven realistic financial payloads, extra fields on sign-up, beacon date and plan validation, rate limiting actually biting, the rate key not being reversible to an IP, consent and double opt-in, identical responses for a repeated sign-up, email validation, unguessable confirmation links, foreign-origin rejection, admin token checks, and malformed or oversized bodies returning no stack trace.
- `npx tsc --noEmit` passes in both the app and `server/`.

### Not verified for this change

- **The service has never been deployed or run against real D1.** Everything is tested against the in-memory double, so the SQL in `d1Store` — in particular the `on conflict` upserts and the `julianday` date window — is unexercised. Run `npm run db:init:local` and `wrangler dev` before trusting it.
- No confirmation email has ever been sent. The Resend path is written but untested, and without `RESEND_KEY` addresses stay `pending` forever.
- The usage ping has never reached a server; `API_BASE` is empty in this build so `pingOnce` returns early.
- The printed output was checked in a desktop engine's print preview at phone dimensions, not by exporting a PDF from a real Android Chrome, which is where the clipping was reported.
- The visual pass (flat surfaces, square corners, segmented progress rail, restrained accent) is a judgement call, not a measured result. No user has been asked whether it reads better.

## Added 21 October 2026 — the balance chain, document reading, trust defaults

- **Balance-chain verification.** Where a statement carries a running balance, every row must satisfy `balance[n] = balance[n-1] + amount[n]`. Seven tests cover it: a misread amount caught at the right row and kept out of the ledger; one bad row not poisoning the rows after it (the chain resumes from the printed balance); two identical same-day payments proved genuine and un-flagged as duplicates; a whole file imported twice still caught as a repeat; a file with no balance column simply not checked; a gap in the column ending the run rather than reporting a false break; and the chain agreeing with the account reconciliation. Verified in the browser with a statement containing a deliberate misread row and a real same-day repeat — both handled exactly as designed, with the expected and found figures shown.
- **`POST /v1/extract`.** 13 further server tests: refused entirely when no model is configured; licence signature verified in the Worker with forged, foreign-signed, expired and free-plan keys all refused; only PDF/PNG/JPEG accepted and extra fields rejected; model output parsed strictly so malformed rows are discarded rather than repaired; prose, broken JSON and fenced code handled; row count capped; both Gemini and Anthropic request shapes correct and sending the file as a document rather than as text; the response labelled as unchecked; an upstream error body never relayed back (asserted against a body containing an account number); and per-IP rate limiting.
- **Trust defaults.** Usage counting is now opt-in and off by default — `pingEnabled()` returns true only for an explicit opt-in key, and there is no default-on path in the file. The email ask is labelled as optional with an alternative. Trust statements added to the lock screen and the privacy panel. The privacy notice and `docs/PRIVACY.md` regenerated from the same source.

### Not verified for this change

- **`/v1/extract` has never called a real model.** Every test uses a fake `fetch`. The Gemini and Anthropic request shapes are written from their documented formats and have not been sent to either API, so the first real call may need adjusting.
- **No real bank statement PDF has been read.** Extraction quality, and therefore how often the balance chain catches a misread, is completely unmeasured. That number is the one that decides whether this feature is usable, and it can only be found with real documents.
- The balance chain only helps where a statement prints a running balance. Statements without one are imported unverified, and the import screen says so.
- The service is still undeployed; none of the endpoints has run against real D1.

## Added 21 October 2026 — PDF reading in the app, plain-language declarations

- **The document flow is now reachable.** Previously `/v1/extract` existed with no client. There is a consent screen that names the reader, states that the whole document including the account number and every transaction is sent, and requires an explicit tick plus an account before a file picker opens. The button only appears when both `API_BASE` and `READER_NAME` are set — consent is meaningless if the recipient cannot be named — and only on a plan that includes it.
- Transcribed rows go through **the same gate as a CSV**: fingerprints, duplicate detection against everything already imported, and the running-balance check. Six tests cover it: a misread figure caught by the balance and set aside; unreadable rows reported rather than repaired; a re-read document still caught as a duplicate; a document with no balance column imported but flagged unverified; and an absurd row count refused. The preview warns explicitly when there is no balance column to check against.
- Each import batch now records whether its rows came from a `csv` or a `document`, and which reader, so a Filing Pack can show which figures a machine transcribed. Added with a schema default rather than a migration, so workspaces saved earlier still load.
- **The tax declarations were rewritten.** Eleven items of legal wording that a freelancer could not honestly answer are now plain questions grouped under You / Export work / Local work / Sales tax, each with the statutory basis underneath rather than instead of it. The underlying fields and every gate are unchanged — verified in the browser by ticking "I also have a salary, property, shares or other income" and confirming the combined-assessment gate still fires and still blocks a final figure.

### Not verified for this change

- **The document flow has never been run end to end**, because no service is deployed and no reader is configured. The consent screen, the account picker and the error paths were exercised by reading the code and the types, not by sending a file. `handleDocumentFile` has never executed against a real response.
- No real PDF has been transcribed, so the rate at which the balance chain catches a reader's mistakes is still unknown. That number decides whether the feature is worth offering.
- The plain-language declarations are clearer, but no actual freelancer has been asked whether they can now answer them honestly. That was the original problem and it remains unmeasured.

## Added 21 October 2026 — the interface rebuilt around four destinations

- **Nine destinations became four.** Today, Money, Tax, Filing Pack, plus Settings and the Privacy notice. Income, Money out, Invoices and Statements are tabs inside Money with counts on the tabs. Old route names still resolve through a route table, so every existing button and link keeps working — verified in the browser: a legacy `Reports` link lands on Filing Pack, and a legacy `Invoices` link lands on Money with the Invoices tab already active.
- **One Add sheet** replaces navigate-then-act, reachable from any page and from the middle of the phone bar. All five choices verified to open their form: I got paid, I spent money on work, Send an invoice, Import a bank statement, Add an account.
- **The three main tables now stack into labelled cards on a phone.** Income, expenses and invoices previously scrolled sideways. Verified at 375 px: no horizontal overflow anywhere, and the income table no longer scrolls within itself.
- Each Money tab verified to render its content: 8 income rows, 2 expenses, 2 invoices, 2 reconciliation cards and the review queue.
- **A regression caught and fixed during this work:** collapsing the navigation left the Privacy notice with no entry point, so it was unreachable. It now has a footer link on every page, the sidebar trust card points at it, and Settings has a row for it.

### Not verified for this change

- The structure is a judgement about how people think about their money, not a measured result. Nobody has been watched using either version, so "easier" remains an argument rather than a finding.
- The phone layout was checked at 375 x 812 in a desktop engine, not on a real device.
- No accessibility pass has been done on the new tabs or the Add sheet — keyboard order and screen-reader labelling of the tab bar are unexamined.

## Added 22 October 2026 — a new palette, light and dark

- **The stylesheet was tokenised mechanically, not by hand.** 257 hard-coded colours across 181 distinct values were classified by hue, lightness and saturation into semantic tokens, and the mapping was reviewed before it was applied. Rules belonging to the printed sheet were excluded by selector so an invoice stays ink on paper in both themes — confirmed in dark mode: the paper is `rgb(255,255,255)` on `rgb(23,23,23)` text.
- **Two themes.** Light is the default; dark follows `prefers-color-scheme` and either can be forced from Settings. Verified in the browser: system-dark gives `--bg:#0e1512`, forcing light gives `#f7f6f3`, the choice persists in `localStorage`, and choosing "Match my device" clears it.
- **Contrast was audited programmatically rather than by eye.** A script walked every rendered text node on all six pages in both themes, resolved each element's effective background through its ancestors, and reported anything under a 3:1 ratio. Two real failures were found and fixed: the Filing Pack warning box had been excluded from tokenisation by an over-broad print guard and was dark-on-dark at **1.04:1** — effectively invisible — and the breadcrumb separator was at 1.61:1. After the fixes the only remaining item below 3:1 in either theme is the breadcrumb slash, which is decorative.
- **Brand and alarm were separated.** "Needs a decision" chips, waiting counts and navigation badges had inherited the brand colour, which made a pending decision read as success. They now use the warning tokens.
- 101 app tests and 28 server tests still pass; `tsc` clean.

### Not verified for this change

- The automated classifier assigned roles from colour values, not from how each colour was used. It was reviewed and spot-checked, and the contrast audit would catch an inversion that made text unreadable — but a colour that is merely *wrong* rather than illegible could have survived. The quiet corners of the app (drawers mid-edit, error states, the FX calculator) were not individually inspected in both themes.
- No colour-blind simulation was run. Green/amber/red carry meaning in several places, and while each is paired with a word or an icon, that pairing has not been checked systematically.
- Nobody has been asked whether the new palette reads as more trustworthy. That was the goal, and it remains an assertion.

## Added 22 October 2026 — white-first interface

- The palette moved to white-first with a soft indigo brand, taking the card, spacing and chart patterns from dashboard references the founder supplied. Surfaces are white separated by hairlines and a faint lift; corners are rounded through `--radius` tokens rather than per-rule pixel values.
- **The monthly chart was rewritten.** It had carried its own hard-coded palette in inline SVG attributes — orange bars and dark gridlines that the stylesheet tokenisation never touched, and which would have been wrong on any light theme. It is now a smooth area chart drawing every colour from CSS variables, with take-home filled and what clients paid as a dashed line above it, so the gap between them is the visible thing.
- Contrast re-audited by script across all six pages in both themes at a stricter 3.5:1 threshold. Nothing fails except the decorative breadcrumb slash.
- 101 app tests and 28 server tests pass; `tsc` clean in both projects.

### Not verified for this change

- The references were used for layout and colour relationships only; no artwork, illustration or component was copied from them.
- Still no colour-blind simulation, and still nobody has been asked whether this reads better than what it replaced.

## Limits

The five-minute lock is implemented and reviewed; a full timed idle soak is not recorded. Receipt upload uses file MIME/signature/size validation, but all file types have not been exercised in the browser. Downloaded backups are verified in Node crypto tests and browser restoration; arbitrary malformed backup fuzzing is not exhaustive. Live FX depends on provider/network availability and is not a price guarantee. No real bank transfer, FBR submission, email, subscription payment or government registry verification was performed.

Independent accountant review, province-specific tax coverage, accessibility audit, penetration testing, live HTTP-header enforcement and production commercial readiness remain outstanding. Do not describe this release as covering every Pakistani tax or as a certified filing system. Browser checks were performed through the provided computer-use interface; the repository does not claim an automated full-browser regression suite.
