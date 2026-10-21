# Hisaab — freelancer money, made clear

## Platform
Web application. Single-user, local-first encrypted workspace. Static deployment, no customer data server.

## Product truth
Pakistani independent workers need to reconcile foreign invoices, processor fees, actual bank settlement and FBR estimates. The first release must complete invoice → receipt → PKR reconciliation → tax worksheet → accountant export. All figures retain their inputs and rate provenance. Estimates never constitute advice or an IRIS submission.

## Audience and tasks
Pakistan resident individual freelancers. Desktop for bookkeeping, mobile for recording receipts. Track USD, GBP, EUR, AED and PKR; compare actual settlement with dated reference FX. Create printable invoices, record income/fees/withholding and expenses, filter/search, tax-year reporting and encrypted backup/restore. Demonstration data must be separate from the user's vault.

## Fixed visual commitments
User supplied a dark logistics-app reference: near-black background, charcoal surfaces, orange controls, restrained rounded panels, crisp white text. Poppins is mandatory and self-hosted. Translate the reference to a financial workspace with persistent navigation, a prominent cash-flow view, reconciliation and a tax reserve panel. No shipping images, no invented payment integrations.

## Security and boundaries
AES-GCM encrypted browser storage with PBKDF2-derived key, explicit passphrase setup, idle lock, export and delete controls, validated imports, escaped rendering, restrictive CSP and no analytics. Live FX makes an optional external request containing currency only, never ledger data. No bank passwords, CNIC, API keys or IRIS credentials collected. No claims of professional review or exhaustive legal coverage.

## Tax coverage
Pakistan only, versioned TY2026 and TY2027. Verify official FBR Ordinance and rate cards. Explicit eligibility for 154A IT/ITeS and other service exports. Domestic sole-proprietor business estimate; salary/mixed income, social media, provincial sales tax, foreign income complexities and high income require explicit review flags. Unsupported dates and classifications must fail closed. Show statute, calculation, assumptions and missing evidence for each estimate. No imported foreign tax logic.

## Delivery
Plan and algorithms before implementation; working, tested application; source and security documentation; GitHub repository and matching profile-template section. Production commercial roadmap 8–10 weeks; subscription billing and provider OAuth require separate deployment credentials and operational readiness.
