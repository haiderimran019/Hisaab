# What a Hisaab subscription actually gets you

Written 21 October 2026. Everything marked **Built** works today and is covered by
tests and a browser check. Everything marked **Not built** is not in the product,
however reasonable it sounds. Nothing here is a plan to claim something we do not
have.

---

## The three plans

| | Free · PKR 0 | **Pro · PKR 2,400 / year** | Accountant · PKR 14,400 / year |
|---|---|---|---|
| Bank / wallet accounts | 1 | 10 | 40 |
| Statement imports | 1 a month, 60 rows | Unlimited, whole statements | Unlimited |
| Duplicate + own-transfer detection | — | ✔ | ✔ |
| Balance reconciliation | — | ✔ | ✔ |
| Filing Pack | — | ✔ | ✔ |
| Workspace per client | — | — | ✔ |
| Records, tax estimate, CSV exports, encrypted backups | ✔ | ✔ | ✔ |
| Two-factor, offline mode, all privacy controls | ✔ | ✔ | ✔ |

Launch price: **PKR 1,500 for the first year** (first 200 keys), then PKR 2,400.

Three things are never gated, including after a key expires: **your records, your
exports, your backups.** Only the paid steps stop. Privacy and security features
are free for everyone — charging for those would be indefensible.

---

## Built: the paid workflow

**1 · Statement import**
- CSV from bank portals, Payoneer and Wise. Read entirely in your browser.
- Finds the header row under a bank's title block and blank lines.
- Handles signed-amount columns, separate debit/credit columns, and amount-plus-Dr/Cr layouts.
- Reads Pakistani money formats: `1,234.56`, `2,00,000`, `(1,234.56)`, `750.00 Dr`, `PKR 5,000`.
- Reads day-first and month-first dates, named months, and refuses dates that do not exist.
- **Any row it cannot read is listed with its row number and original text.** Never dropped, never guessed.
- Every line keeps its file, SHA-256 file fingerprint, row number and original description.

**2 · Catching the things that cost people money**
- Duplicate detection within a file and across every previous import, as a reversible flag.
- Transfers between your own accounts detected from equal-and-opposite movements, so moving your own money never becomes income.
- A row with both a debit and a credit is flagged, not netted away.

**3 · Deciding what each line is**
- Income, business cost, own transfer, or not business — one tap each, all reversible.
- Classifying as income opens a prefilled form that carries the statement reference across.
- A warning when prefilling from a settlement amount, because that is net of the processor's cut and an export tax base must be the gross.

**4 · Reconciliation**
- Opening balance, money in, money out, computed closing, and the closing printed on your statement.
- **The unexplained difference stays on screen.** There is no code path that closes a gap by inventing an entry.
- Duplicates excluded from the arithmetic.

**5 · The Filing Pack**
- Unresolved items on the front page, not buried.
- Accounts and reconciliation; income by classification; payment-by-payment detail citing statement rows; expenses; withholding; the tax scenario with its rule version and FBR sources; a document checklist; your declarations; and a plain statement of what the pack is not.
- Prints to PDF, or exports as JSON for a reviewer.
- Carries a SHA-256 fingerprint of the figures, so a practitioner can sign exactly these numbers.

**6 · Practitioner review tick**
- A reviewer returns a signed certificate; you paste it in; the pack prints a verified tick with their name, registration and date.
- **Change any figure afterwards and the tick turns amber by itself** — it cannot cover numbers nobody checked.
- Today: no reviewing practitioner is published, so no tick can be shown, not even by us. A tick the publisher can mint for itself is worth nothing.

## Built: the tax work

- Tax years **TY2026 and TY2027**, July–June, each confirmed separately.
- **Section 154A export scenarios**: PSEB-certified IT/ITeS at 0.25%, other covered service exports at 1%, on the gross realized tax base.
- **Domestic individual business**: full slab table, surcharge above PKR 10m, expenses with business-use allocation.
- Withholding recorded by regime and kept separate — never auto-treated as a refundable credit.
- **Eligibility gates that refuse to produce a liability** when facts are missing: realization through an authorized dealer, returns and statements filed, no foreign tax credit, no opt-out, mixed regimes, non-resident profiles, high turnover needing super tax or minimum tax, AJK/GB.
- Every rate shows its rule version (`PK-2026-10-21.1`) and links to the Ordinance and FBR rate cards.
- Unsupported tax years fail closed rather than assuming last year's rates.

## Built: everyday bookkeeping

- Income in USD, GBP, EUR, AED, PKR with the actual settlement rate, processor fee in the original currency, PKR bank fee, withholding and a separate confirmed tax base.
- Invoices with status tracking and printable output. Marking one paid never silently creates income.
- Expenses with business-use percentage and an encrypted receipt attachment (PNG/JPEG/PDF, 1 MB).
- Reference FX quotes, dated and attributed — never passed off as a bank rate or tax-conversion evidence.
- CSV exports, a source-linked worksheet, monthly reconciliation and a filing checklist.

## Built: privacy and security

- **Two-factor on unlock** via any authenticator app (RFC 6238, verified against the published test vectors). Offline — no phone number, no email address, nothing to collect.
- **8 single-use recovery codes**, shown once, stored only as SHA-256 hashes, burned before the workspace opens.
- **Never touch the network**: switches off the reference-rate lookup, the only outside request the app can make.
- **Hide amounts until I ask**: blurs figures for working in public.
- Auto-lock after 1, 5, 15 or 30 minutes; locks on tab hide and on changes from another tab; lock-now button.
- AES-256-GCM, PBKDF2-SHA256 at 600,000 iterations, non-extractable in-memory key, encrypted backup and restore.
- A privacy notice written to be read, in the app and in [PRIVACY.md](PRIVACY.md).
- No analytics, no trackers, no cookies, no third-party scripts, no account, no server holding your books.

---

## Not built — and what "whole tax help" would really take

You asked for every tax need a person could have. Here is the honest gap. Each of
these is a serious piece of work, and several carry real liability.

**Income types not covered.** Salary and salary-tax slabs, property and rental
income, capital gains, dividends and profit on debt, agricultural income,
partnerships and AOPs, companies, non-resident and treaty cases. The app refuses
to produce a liability for these rather than guessing — but refusing is not the
same as supporting them. A person with a salary *and* freelance income cannot
complete their return here today.

**Wealth statement.** Required with most returns. The app does not compute assets,
liabilities, personal expenses or the reconciliation of year-on-year change. This
is the single biggest gap for "whole tax help", and it is mostly a data-model and
UI job rather than a legal one.

**Sales tax.** Provincial (PRA, SRB, KPRA, BRA) and ICT service sales tax are
excluded entirely. Many freelancers have an obligation here.

**Filing itself.** No IRIS integration, no return submission, no PSID generation,
no payment. There is no public FBR API available to us, and having access to your
own IRIS account is not the same as having an integration. Filing stays manual.

**Government data.** No Maloomat or TaxRay import, no ATL status check, no NTN
verification, no withholding-certificate matching against FBR records.

**Documents.** No PDF statement reading and no receipt OCR. CSV only.

**Multi-device.** No sync, no cloud backup, no account recovery. That is the price
of having no server, and it is a real cost to some people.

**Email 2FA**, email receipts and email reminders all need a backend that does not
exist. Building one re-introduces exactly the data liability the product currently
avoids, so it should be a deliberate decision, not a feature bolt-on.

**The one that matters most:** no qualified Pakistani practitioner has reviewed the
tax rules, the formulas, or the Filing Pack's wording. Until that happens, charging
for reliance on these outputs is the largest risk in the business. See
[COMMERCIAL.md](COMMERCIAL.md) §7.

### If you want to close the gap, this is the order

1. **Practitioner review of what already exists.** Cheapest, highest value, and it removes the biggest risk. Do this before selling.
2. **Wealth statement.** Biggest "whole tax" win per unit of work, no new legal surface beyond the schedules themselves.
3. **Salary and mixed income.** Unlocks a far larger audience than freelancers alone.
4. **PDF statements and receipt OCR.** Removes the remaining typing — but decide first whether documents may leave the device, and say so loudly if they do.
5. **Provincial sales tax**, one province at a time, starting with wherever your customers actually are.
6. **Accountant multi-client workspace.** Best margin per support hour, and the natural second product.

Everything above 3 is worth more than any amount of interface polish.
