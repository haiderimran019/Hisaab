# Implementation contract

## Release features
- Dashboard with selected Pakistan tax year, actual net PKR, reference versus settlement FX, monthly receipts and source-labelled demo.
- Income ledger: date, client, service category, currency, gross, processor fee, actual PKR per currency unit, fixed PKR bank fee, tax withheld, evidence reference and banking-channel confirmation. Add, edit, delete, search and CSV export.
- Invoices: client and issuer, description, currency, quantity/unit price, due date, draft/sent/paid states, print/PDF through browser. Invoices do not count as received income; explicit receipt entry avoids double counting.
- Expenses: date, vendor, category, amount/currency/rate, business-use percentage and receipt reference. Expense totals do not silently reduce final-tax export proceeds.
- FX: optional live reference quote, provider and timestamp; actual bank rate remains the ledger source. Manual rates work offline. No fabricated historical FX.
- Pakistani tax workspace: resident individual, supported tax year, PSEB/IT service classification, 154A conditions, domestic business calculation, recorded withholding, missing-evidence checklist, source register, filing worksheet. Provincial sales tax and special regimes are flagged, not guessed.
- Accountant package: CSV ledger and expenses plus JSON/printable tax worksheet with inputs, amounts, legal references and limitations. Never an IRIS import format.
- Settings/privacy: encrypted workspace creation/unlock, five-minute idle lock, encrypted backup, validated replacement restore, workspace deletion, local data inventory.

## Algorithms
Amounts are decimal strings converted to integer paisa using decimal.js and half-up rounding; rates are positive decimal strings. Gross PKR = gross foreign × actual rate. Fee PKR = foreign fee × rate + bank fee. Settlement = gross PKR − fees − recorded PKR withholding. Reference FX is a comparison only. Annual groups use receipt dates from July 1 through June 30, not invoice dates or calendar years. Expenses use business portion; final-tax export base is the entered gross realized proceeds before fees, pending bank certificate reconciliation.

154A uses category and PSEB certification to select a versioned rate. Provisional withholding is kept separate from final liability; the latter is blocked unless every statutory condition is confirmed and no unsupported income exists. Domestic business uses verified marginal slabs on allowable business profit, plus applicable surcharge, only for a resident individual with a simple business-only profile. Mixed regimes are exported separately, never silently aggregated into a final liability. Non-ATL treatment follows the Ordinance, not an assumed blanket doubling. Tax paid is only an entered, supported credit in the same tax year. No automatic refund claim.

## Security design
Threats: lost browser/device, malicious imports, injection through client fields, tampered backup, CSV formula injection, dependency compromise, stale legal rules and misleading FX. Controls: WebCrypto AES-256-GCM with random 96-bit IV for every save; PBKDF2-SHA256 600,000 iterations/random salt; key nonextractable/in memory only; ciphertext only in localStorage; no plaintext browser persistence; passphrase minimum 12 characters; idle lock; bounded strict-schema backup validation; explicit replace/delete confirmation; text escaping and no user HTML; CSV formula neutralization; no external scripts/fonts; CSP; lockfile; source and rule version in exports. Encryption cannot protect a compromised browser or an unlocked device. Lost passphrases cannot be recovered.

## Eight–ten week commercial roadmap
Weeks 1–2: accountant review of every tax branch, province/service mapping and receipt classification. Weeks 3–4: private pilots and accessibility/usability fixes. Weeks 5–6: approved bank/processor imports, duplicate detection and reconciliation. Weeks 7–8: independently reviewed security, legally reviewed terms, operational backups and incident response. Weeks 9–10: optional account sync, payment integration and annual pricing validation. Never advertise future integrations as live.

## Validation
Unit tests for monetary rounding, fee limits, tax year boundaries, slabs, withholding segregation, eligibility gates, unsupported year, backup authentication/schema limits and CSV injection. Browser tests for demo navigation, create/edit/delete, invoice print, vault setup/lock/unlock, backup and responsive layout. Production build and dependency audit. Document exact outcomes and residual limitations before publication.
