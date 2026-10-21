# Hisaab

**Your work. Your worth.** Finance for independent workers in Pakistan.

Invoices, multi-currency income, actual PKR settlement after fees, expense evidence and source-linked Pakistani tax estimates, in a private encrypted workspace. Built with TypeScript, Vite, Decimal.js, Zod and WebCrypto. Poppins typography and a charcoal/orange interface.

![Hisaab desktop demo](docs/screenshots/desktop.jpg)

## Use it

**[Open the public app](https://haiderimran019.github.io/Hisaab/)** — no GitHub or ChatGPT account required. Each visitor has a separate encrypted workspace in their own browser.

```bash
npm ci
npm run dev
```

Open the URL printed by Vite. Explore the labelled demo, or create an empty private workspace with a passphrase of at least 12 characters. No API keys or environment variables are required. Run over HTTPS in production (localhost is supported by WebCrypto).

```bash
npm test        # monetary, tax, schema, import, licensing, injection and encryption tests
npm run build   # TypeScript check and production assets in dist/
npm run preview
```

## How it feels to use

Home is a guide, not a dashboard. It tells you which of six steps you are on, in
one sentence, with one button: tell us about your work → add your accounts →
import statements → say what each payment was → make it balance → get your Filing
Pack. The three money figures are in words people say out loud — *what reached
you*, *lost to fees*, *keep aside for tax* — and you can blur them with one switch
when you are working in public.

It is built for a phone first. Wide tables become stacked cards, the bottom bar
carries the five screens people actually open with a badge for what is waiting,
and every control is thumb-sized.

## The paid workflow

```
Import a CSV statement
  → confirm which column is what
  → repeats and own-account transfers flagged
  → you decide what every remaining line is
  → balances reconcile, or the unexplained amount stays on screen
  → Filing Pack: one source-linked document for your accountant or for IRIS
```

Three rules this product will not break:

1. **Nothing becomes income until a person says so.** Imported lines wait to be classified.
2. **An unexplained difference is never hidden.** It is reported on the account card and printed on the front page of the Filing Pack. No code path closes a gap with a balancing entry.
3. **Every number is traceable** to a statement row, an attached document, or something you explicitly declared.

Sold as an annual licence key — Easypaisa, JazzCash, Raast and bank transfer are how people here actually pay, so nothing is held on a card and no customer-data backend exists. Keys are verified offline against a signature. **Free** keeps records and shows the estimate; **Pro, PKR 2,400 a year** adds unlimited imports, up to 10 accounts, reconciliation and the Filing Pack; **Accountant, PKR 14,400 a year** adds 40 accounts and a workspace per client. Licence enforcement is client-side and the app says so. An expired key never blocks your own records, exports or backups — only the paid steps stop. See [docs/COMMERCIAL.md](docs/COMMERCIAL.md) for the reasoning and [docs/LICENSING.md](docs/LICENSING.md) for how keys are issued.

## What works

- **Statement import:** CSV parsing in the browser with column mapping you confirm, detection of the header row under a bank's title block, debit/credit or signed-amount or Dr/Cr layouts, Pakistani money and date formats, duplicate detection within and across imports, own-transfer suggestions, and per-row provenance (file, fingerprint, row number). Rows it cannot read are listed with their row numbers, never dropped quietly. **PDF statements are not read.** The CSV formats of real Pakistani bank, Payoneer and Wise exports have not yet been tested against the live product — see [docs/VERIFICATION.md](docs/VERIFICATION.md).
- **Reconciliation:** per-account opening balance, movement, computed closing and the statement's closing, with the unexplained difference always shown and duplicates excluded from the arithmetic.
- **Filing Pack:** a printable, source-linked package — unresolved items first, accounts and reconciliation, income by classification, payment-by-payment detail citing statement rows, expenses, the tax scenario with its rule version, a document checklist, your declarations, and an explicit "not reviewed" stamp with a practitioner sign-off block.
- **Income:** create/edit/delete/search/filter receipts in USD, GBP, EUR, AED or PKR; record actual FX, original-currency processor fees, PKR bank fees, tax withheld, realization evidence and a separate tax base.
- **Invoices:** create/edit/status tracking, due dates, quantity × unit price, client details and printable/PDF-ready invoices. Invoice status never silently creates income. Sharing is manual; no email or payment is sent.
- **Expenses:** actual FX, business-use allocation, evidence reference, optional PNG/JPEG/PDF receipt encrypted with your book, and explicit domestic-deduction claim.
- **FX:** transparent settlement calculator plus opt-in, dated ExchangeRate-API reference quotes. Provider fees are entered, never invented. Reference FX is not historical FX or an executable bank offer.
- **Pakistan tax center:** TY2026/TY2027, 154A export scenarios (PSEB IT/ITeS and other services), domestic individual-business slabs and surcharge, separate withholding credits, statutory eligibility gates, provincial/special-regime review flags and official FBR source links.
- **Reports:** income/expense CSVs, source-linked tax worksheet JSON, printable worksheet, monthly reconciliation and filing checklist. Exports are for accountant review, not an IRIS import or submission.
- **Privacy and security:** AES-256-GCM encrypted local storage, PBKDF2 at 600,000 iterations, non-extractable in-memory key, encrypted backup/restore and explicit local deletion. **Two-factor codes on unlock** from any authenticator app (offline — no phone number, no email address), **8 single-use recovery codes** stored only as hashes, **Never touch the network** to switch off the one outside request the app can make, **hide amounts** for working in public, and auto-lock at 1/5/15/30 minutes plus lock on tab hide. A [privacy notice](docs/PRIVACY.md) written to be read, inside the app and in the repository from the same source.
- **Practitioner review tick:** a reviewer signs a certificate bound to your pack's fingerprint; the pack prints a verified tick with their name, registration and date. Change one figure and the tick turns amber by itself. No reviewer is published with this release, so no tick can be shown yet — not even by us.
- **Responsive UI:** desktop side navigation, mobile bottom navigation, keyboard focus, reduced-motion support and labelled controls. Fonts are self-hosted.

## The service (optional, and off by default)

`server/` is a small Cloudflare Worker that does exactly two things and refuses a
third.

**It does:** hold email addresses people actively gave us — double opt-in,
one-click unsubscribe — so licence keys and occasional updates can be sent; and
count how often the app is opened.

**It refuses:** anything financial. There is no endpoint, no accepted field and no
database column for an amount, a client name, a statement row, a tax figure, or
any identifier for a device or person. Every endpoint declares the exact fields it
accepts and **rejects a body carrying anything else**, so a careless change on the
client cannot start leaking records by accident. A test fires realistic payloads
(`income`, `client`, `receipts`, `taxDue`, `lines`, `installId`) at it and asserts
each one is refused.

Usage counting sends **no identifier at all** — a date, a build string and a plan
word — so the figures are *opens, not people*, and `/v1/stats` says so in its own
response. One person on two browsers counts twice; anyone who switches it off
counts zero. That undercount is the price of not putting a tracking id on a
privacy-first product.

`API_BASE` in [src/service.ts](src/service.ts) is empty by default, so **this build
contacts nothing and shows no sign-up form**. Setting it is a deliberate act, and
the privacy notice rewrites itself to describe whichever build ships. Deployment,
secrets and what is still missing before it is a real service: [server/README.md](server/README.md).

## Pakistan rules, honestly scoped

Rules were checked against official FBR publications on **21 October 2026**. The estimate shows its inputs, rule version, legal references and conditions. Unsupported years fail closed. Final liability is blocked when facts, classification or evidence require review. The app never treats a foreign payment-provider label as proof of tax eligibility.

Read the [tax rule register](docs/TAX-RULES.md) for formulas, legal sources, year applicability and exclusions. Provincial/ICT sales-tax computation, salary/mixed-income assessment, overseas retained balances, foreign credits/treaties, super/minimum tax, personal credits, depreciation, wealth reconciliation and actual return submission require separate review. Social-media receipts are flagged for section 154B review, not misclassified as IT exports. This is an estimate, never tax advice. It has not been reviewed by a licensed Pakistani tax practitioner.

## Data and security

There is no customer-data backend, analytics, bank synchronization or government login. Your browser stores only authenticated ciphertext; the demo stays in memory. Private hosting access and local-vault encryption are separate protections. An optional FX request exposes network metadata to the provider, never your records. CSV/worksheet exports are plaintext; encrypted backups are protected by your passphrase. Keep a backup: browser clearing or a lost passphrase can permanently lose access.

See [SECURITY.md](SECURITY.md) for implemented controls, threat model, limitations and deployment headers. `public/_headers` is provided for supporting hosts; enforce and verify equivalent headers on other platforms. This is not an independently audited financial service.

## Architecture and variables

| Module | Responsibility |
| --- | --- |
| `src/core.ts` | Strict schemas, decimal arithmetic, tax-year selection, deterministic Pakistan calculations, accounts and statement lines, reconciliation, readiness, schema migration, CSV/HTML escaping |
| `src/statements.ts` | CSV parsing, header detection, column mapping, money and date readers, duplicate fingerprints, own-transfer pairing |
| `src/pack.ts` | The Filing Pack: data, printable HTML and the review tick |
| `src/totp.ts` | Authenticator codes (RFC 6238) and single-use recovery codes |
| `src/review.ts` | Practitioner certificates and the pack fingerprint they sign |
| `src/ui-home.ts` | The six-step guide and the plain-language money cards |
| `src/ui-privacy.ts` | Privacy controls, two-factor setup, the review panel and the privacy notice |
| `src/license.ts` | Offline ECDSA licence verification, trial, plan limits |
| `src/pricing.ts` | Prices, plan copy, payment rails — the only place to change commercial terms |
| `src/vault.ts` | Encryption, key derivation, size-bounded authenticated restore (migrates older workspaces on unlock) |
| `src/main.ts` | Local application state, forms, reports, print, optional public FX request |
| `src/ui-statements.ts` | Views for statements, reconciliation, the plan panel and the pack gate |
| `src/format.ts` | Shared number, date and icon formatting |
| `src/service.ts` | The only code that may contact the service. An empty API base means it contacts nothing |
| `server/` | The Worker: email list, usage counts, and no way to accept financial data |
| `src/demo.ts` | Clearly labelled synthetic sample data, including a worked statement |
| `src/style.css` | Responsive design and print styles |
| `tools/make-license.mjs` | Publisher-side key generation, issuing and verification |
| `tools/make-review.mjs` | Reviewer onboarding and signing a customer's Filing Pack |

Inputs and units are documented in the [feature/algorithm plan](docs/PLAN.md). Money uses decimal arithmetic with half-up rounding to two PKR decimals; per-unit FX supports six decimals. The selected tax year controls July–June receipt and expense reporting. Tax-profile confirmations are year-specific. Foreign amounts, tax bases and withholding remain distinct.

## Public hosting

GitHub Pages serves the compiled `dist/` artifact through `.github/workflows/checks.yml`. Tests, build and the production dependency audit must pass before deployment. Pull requests only validate; pushes to `main` publish the verified build. Repository Pages settings must use **GitHub Actions**, not the raw source branch.

The public app has no shared financial-data backend and does not expose another visitor's records. Browser storage is specific to the site origin. GitHub Pages does not apply `public/_headers`; the HTML CSP remains active, while HTTP headers such as `frame-ancestors` require a supporting host or proxy.

## Release status

This is a functional **local-first product with a working paid mechanism**, not a commercially certified tax service. Statement import, reconciliation, the Filing Pack and offline licence keys are implemented and tested. Account sync, bank OAuth or statement APIs, PDF and OCR extraction, shared accountant workspaces, card subscriptions, and professional tax or security approval are **not** implemented.

Before money changes hands, four things that are not code must exist: a qualified Pakistani practitioner's written review of the tax rules and the Filing Pack's wording; published terms, privacy notice and refund policy; real payment details in `src/pricing.ts` (deliberately left empty) with a sales ledger; and a process for correcting and reissuing if a rule turns out to be wrong. [docs/COMMERCIAL.md](docs/COMMERCIAL.md) sets out the evidence plan and the thresholds at which this concept should be narrowed or dropped. The [plan](docs/PLAN.md) contains the commercial roadmap. See [verification evidence](docs/VERIFICATION.md) for checks actually run and remaining validation limits.

**Workspace format.** Encrypted workspaces are version 3. Version 1 and version 2 workspaces from earlier releases are migrated on unlock or restore, keeping every receipt, expense, invoice, account, statement line and declaration; tests assert no record is lost and that a migrated workspace is never silently given security settings it never had. An unknown or newer version is refused rather than guessed at.

**What a subscription gets you**, feature by feature, with an equally plain list of what is *not* built and what "whole tax help" would really take: [docs/FEATURES.md](docs/FEATURES.md).

Third-party licenses remain with their authors. Lucide uses ISC; Poppins uses SIL OFL; Decimal.js and Zod use MIT. Live quotes are attributed to [ExchangeRate-API](https://www.exchangerate-api.com/). The supplied screenshot inspired the palette and composition; none of its shipping imagery was copied.
