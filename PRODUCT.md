# Hisaab — freelancer money, made clear

## Platform
Web application. Single-user, local-first encrypted workspace. Static deployment, no customer data server.

## Product truth
Pakistani independent workers need to reconcile foreign invoices, processor fees, actual bank settlement and FBR estimates. The first release must complete invoice → receipt → PKR reconciliation → tax worksheet → accountant export. All figures retain their inputs and rate provenance. Estimates never constitute advice or an IRIS submission.

## Audience and tasks
Pakistan resident individual freelancers. Desktop for bookkeeping, mobile for recording receipts. Track USD, GBP, EUR, AED and PKR; compare actual settlement with dated reference FX. Create printable invoices, record income/fees/withholding and expenses, filter/search, tax-year reporting and encrypted backup/restore. Demonstration data must be separate from the user's vault.

## Fixed visual commitments
Use the latest exact Muse messaging specification in docs/UX-REDESIGN.md:
self-hosted Figtree throughout, the #141515 dark ground, blue #2563EB primary
actions, rounded message/approval cards and the Urdu ح avatar badge. Light derives
from the same roles. Follow the device theme, use 44px targets and cut redundant
copy. DESIGN.md owns the token contract. The old dashboard, palettes, Poppins and
serif face are superseded. Implement only the currently approved slice.

## Security and boundaries
AES-GCM encrypted browser storage with PBKDF2-derived key, explicit passphrase setup, idle lock, export and delete controls, validated imports, escaped rendering, restrictive CSP and no analytics. Live FX makes an optional external request containing currency only, never ledger data. No bank passwords, CNIC, API keys or IRIS credentials collected. No claims of professional review or exhaustive legal coverage.

## Tax coverage
Pakistan only, versioned TY2026 and TY2027. Verify official FBR Ordinance and rate cards. Explicit eligibility for 154A IT/ITeS and other service exports. Domestic sole-proprietor business estimate; salary/mixed income, social media, provincial sales tax, foreign income complexities and high income require explicit review flags. Unsupported dates and classifications must fail closed. Show statute, calculation, assumptions and missing evidence for each estimate. No imported foreign tax logic.

## Delivery
Plan and algorithms before implementation; working, tested application; source and security documentation; GitHub repository and matching profile-template section. Production commercial roadmap 8–10 weeks; subscription billing and provider OAuth require separate deployment credentials and operational readiness.

## Public free preview, 31 October 2026

Current implementation: chat and direct record previews; multilingual guided routing; confirmed record proposals and conflict-checked undo; deterministic analysis/saving estimates; local report document cards; encrypted history/profile/IRIS memory; calendar-file reminders; optional device Qwen3-1.7B and a user-triggered offline shell cache. No payment window. User memory is private context, not shared training.

The public build does not yet provide Google sign-in, cross-device sync, Gmail access, hosted model compute or background notifications. Those require provider setup and authenticated deployment. Do not describe them as live, and do not claim all current FBR rules or verified IRIS codes.
