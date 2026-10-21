# Security policy and data boundaries

Hisaab 1.0 is a local-first, single-person application. It has no financial-data API, account database, telemetry, analytics, server passwords or bank/IRIS integrations. Optional live reference FX calls `https://open.er-api.com/v6/latest/USD` with credentials omitted and no ledger fields. The provider necessarily receives network metadata such as the visitor's IP. Fonts and icons are bundled locally.

## Implemented controls

- Only encrypted envelopes are stored under `hisaab.encrypted.v1` in browser localStorage. Unencrypted demo data is held in memory, never copied into a newly created vault.
- AES-256-GCM encryption and authenticated decryption through WebCrypto; fresh random 12-byte IV on every write, random 16-byte salt per vault, PBKDF2-SHA256 with 600,000 iterations, non-extractable in-memory key. Passphrase length 12–256 characters, explicit confirmation on creation, no recovery service.
- Five-minute inactivity lock and page-hide lock. Lock clears UI, print previews, workspace references, attachment references and key references. JavaScript garbage collection is not a guarantee of cryptographic memory erasure. Other-tab storage changes lock the active workspace.
- Strict Zod schemas and bounded inputs for dates, positive FX, amounts, categories, record counts, imported encrypted envelopes and decrypted workspaces. 8 MB import cap; 3 MB plaintext workspace cap; receipt upload limited to 1 MB PNG/JPEG/PDF, MIME and signature checked. Attachments are encrypted with the workspace and downloaded as files, never executed or embedded as active PDF content.
- All stored user text is escaped before HTML templating. No user HTML rendering. CSV cells are quoted and leading formula characters are neutralized. Generated financial downloads are explicitly user initiated.
- No external scripts. Restrictive CSP in HTML; optional security headers in `public/_headers`. Header support is host dependent and must be verified on the actual host. The HTML CSP cannot enforce `frame-ancestors`; the HTTP header is required for it.
- Confirmation for workspace replacement and record deletion; typed DELETE for local workspace erasure. Only the app's own storage key is removed. No global `localStorage.clear()`.
- Lockfile, reproducible builds and CI with least privilege. No credentials or financial fixtures in the repository.
- Tax years, legal references and explicit unsupported-case gates reduce the risk of misrepresenting a scenario as a complete liability.

## Limits and operational requirements

A compromised browser, same-origin injected script, malicious extension or unlocked computer can read decrypted data. Browser clearing removes the vault, and storage is not synchronized across devices. Losing the passphrase loses access. Backups must be kept by the user; financial CSV and worksheet exports are plaintext. A private hosted Site protects page access but is not a substitute for vault encryption. This code has not undergone an independent penetration test or professional tax review.

Concurrent tabs are not a supported editing workflow; another-tab writes trigger a lock. Do not assume atomic multi-tab transactions. Receipt-heavy books should export and archive evidence before reaching browser quota. No bank tokens, CNIC, government login or private credentials should be entered into free-text fields.

For public commercial use: commission a Pakistani accountant's review of tax branches and a security audit; verify deployed HTTP headers; define support/incident handling; obtain legal review of terms/privacy and processor relationships. Cloud accounts, shared workspaces and billing are not implemented.

Report vulnerabilities privately through the repository owner's GitHub contact. Do not open public issues containing passphrases, real receipts or financial data.
