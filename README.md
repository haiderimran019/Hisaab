# Hisaab

**Your work. Your worth.** Finance for independent workers in Pakistan.

Invoices, multi-currency income, actual PKR settlement after fees, expense evidence and source-linked Pakistani tax estimates, in a private encrypted workspace. Built with TypeScript, Vite, Decimal.js, Zod and WebCrypto. Poppins typography and a charcoal/orange interface.

![Hisaab desktop demo](docs/screenshots/desktop.jpg)

## Use it

```bash
npm ci
npm run dev
```

Open the URL printed by Vite. Explore the labelled demo, or create an empty private workspace with a passphrase of at least 12 characters. No API keys or environment variables are required. Run over HTTPS in production (localhost is supported by WebCrypto).

```bash
npm test        # monetary, tax, schema, injection and encryption tests
npm run build   # TypeScript check and production assets in dist/
npm run preview
```

## What works

- **Income:** create/edit/delete/search/filter receipts in USD, GBP, EUR, AED or PKR; record actual FX, original-currency processor fees, PKR bank fees, tax withheld, realization evidence and a separate tax base.
- **Invoices:** create/edit/status tracking, due dates, quantity × unit price, client details and printable/PDF-ready invoices. Invoice status never silently creates income. Sharing is manual; no email or payment is sent.
- **Expenses:** actual FX, business-use allocation, evidence reference, optional PNG/JPEG/PDF receipt encrypted with your book, and explicit domestic-deduction claim.
- **FX:** transparent settlement calculator plus opt-in, dated ExchangeRate-API reference quotes. Provider fees are entered, never invented. Reference FX is not historical FX or an executable bank offer.
- **Pakistan tax center:** TY2026/TY2027, 154A export scenarios (PSEB IT/ITeS and other services), domestic individual-business slabs and surcharge, separate withholding credits, statutory eligibility gates, provincial/special-regime review flags and official FBR source links.
- **Reports:** income/expense CSVs, source-linked tax worksheet JSON, printable worksheet, monthly reconciliation and filing checklist. Exports are for accountant review, not an IRIS import or submission.
- **Privacy:** AES-256-GCM encrypted local storage, PBKDF2, non-extractable in-memory key, inactivity/page-hide lock, encrypted backup/restore and explicit local deletion.
- **Responsive UI:** desktop side navigation, mobile bottom navigation, keyboard focus, reduced-motion support and labelled controls. Fonts are self-hosted.

## Pakistan rules, honestly scoped

Rules were checked against official FBR publications on **21 October 2026**. The estimate shows its inputs, rule version, legal references and conditions. Unsupported years fail closed. Final liability is blocked when facts, classification or evidence require review. The app never treats a foreign payment-provider label as proof of tax eligibility.

Read the [tax rule register](docs/TAX-RULES.md) for formulas, legal sources, year applicability and exclusions. Provincial/ICT sales-tax computation, salary/mixed-income assessment, overseas retained balances, foreign credits/treaties, super/minimum tax, personal credits, depreciation, wealth reconciliation and actual return submission require separate review. Social-media receipts are flagged for section 154B review, not misclassified as IT exports. This is an estimate, never tax advice. It has not been reviewed by a licensed Pakistani tax practitioner.

## Data and security

There is no customer-data backend, analytics, bank synchronization or government login. Your browser stores only authenticated ciphertext; the demo stays in memory. Private hosting access and local-vault encryption are separate protections. An optional FX request exposes network metadata to the provider, never your records. CSV/worksheet exports are plaintext; encrypted backups are protected by your passphrase. Keep a backup: browser clearing or a lost passphrase can permanently lose access.

See [SECURITY.md](SECURITY.md) for implemented controls, threat model, limitations and deployment headers. `public/_headers` is provided for supporting hosts; enforce and verify equivalent headers on other platforms. This is not an independently audited financial service.

## Architecture and variables

| Module | Responsibility |
| --- | --- |
| `src/core.ts` | Strict schemas, decimal arithmetic, tax-year selection, deterministic Pakistan calculations, CSV/HTML escaping |
| `src/vault.ts` | Encryption, key derivation, size-bounded authenticated restore |
| `src/main.ts` | Local application state, forms, reports, print, optional public FX request |
| `src/demo.ts` | Clearly labelled synthetic sample data |
| `src/style.css` | Responsive design and print styles |

Inputs and units are documented in the [feature/algorithm plan](docs/PLAN.md). Money uses decimal arithmetic with half-up rounding to two PKR decimals; per-unit FX supports six decimals. The selected tax year controls July–June receipt and expense reporting. Tax-profile confirmations are year-specific. Foreign amounts, tax bases and withholding remain distinct.

## Release status

This is a functional **local-first MVP**, not an 8–10 week commercially certified service compressed into one session. Account sync, bank OAuth/import APIs, subscription billing and professional tax/security approval are not implemented. The [plan](docs/PLAN.md) contains the commercial roadmap. See [verification evidence](docs/VERIFICATION.md) for checks actually run and remaining validation limits.

Third-party licenses remain with their authors. Lucide uses ISC; Poppins uses SIL OFL; Decimal.js and Zod use MIT. Live quotes are attributed to [ExchangeRate-API](https://www.exchangerate-api.com/). The supplied screenshot inspired the palette and composition; none of its shipping imagery was copied.
