# Verification — 21 October 2026

## Completed

- `npm test`: 63 passing tests (27 original, 36 added with the paid workflow) covering precise settlement, decimal rounding, fees exceeding proceeds, PKR rate validation, invalid dates and July–June boundaries, every business-slab boundary, surcharge threshold, unsupported years, 154A rates/conditions including the PSEB sales-return exception, separate tax bases, withholding segregation, unsupported profiles, expense allocation, strict schemas, CSV formula injection, HTML escaping, zero confirmed export bases, unsafe aggregate precision, AJK/GB review gate and authenticated encrypted-backup round trips/tampering/wrong passphrases.
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

## Limits

The five-minute lock is implemented and reviewed; a full timed idle soak is not recorded. Receipt upload uses file MIME/signature/size validation, but all file types have not been exercised in the browser. Downloaded backups are verified in Node crypto tests and browser restoration; arbitrary malformed backup fuzzing is not exhaustive. Live FX depends on provider/network availability and is not a price guarantee. No real bank transfer, FBR submission, email, subscription payment or government registry verification was performed.

Independent accountant review, province-specific tax coverage, accessibility audit, penetration testing, live HTTP-header enforcement and production commercial readiness remain outstanding. Do not describe this release as covering every Pakistani tax or as a certified filing system. Browser checks were performed through the provided computer-use interface; the repository does not claim an automated full-browser regression suite.
