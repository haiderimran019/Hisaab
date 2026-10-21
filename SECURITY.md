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

## Statement import, licence keys and the Filing Pack

- Statement CSVs are parsed entirely in the browser. No file, row or amount is uploaded anywhere, and no OCR or AI service is contacted. A PDF or spreadsheet is refused with an explanation rather than parsed as text.
- Import files are capped at 4 MB and 8,000 rows; a workspace holds at most 8,000 statement lines, 40 accounts and 400 import batches, inside the existing 3 MB plaintext workspace cap.
- Imported text is validated by strict Zod schemas and escaped before templating on every surface, including the printed Filing Pack. A pack-level test asserts that statement text cannot inject markup or script.
- A row that cannot be read is listed with its row number and original text; it is never dropped silently, netted, or given a guessed date, sign or amount. A row carrying both a debit and a credit is reported rather than reconciled away.
- Duplicate detection is a reversible flag, not a deletion. Duplicate lines are excluded from reconciliation arithmetic and shown as such.
- Reconciliation reports the unexplained difference. The application has no code path that closes a difference by creating a balancing entry.
- Licence keys are ECDSA P-256 signatures over a plain payload, verified with WebCrypto against a public key compiled into the bundle. The key is stored inside the encrypted workspace and is never transmitted. Verification is offline and anonymous.
- **Licence enforcement is client-side and is not a security control.** The gate can be removed by anyone willing to edit the published bundle, and the app states this in Settings. The signing private key is held outside the repository; see `docs/LICENSING.md` for its handling and leak recovery.
- An absent, invalid or expired key never blocks reading, editing, exporting or backing up a customer's own records.

## Two-factor codes, recovery and privacy switches

- Two-factor uses RFC 6238 TOTP (SHA-1, 6 digits, 30-second step, one step of drift either side), computed in the browser with WebCrypto and verified against the RFC's published test vectors. Any standard authenticator app works. No phone number, email address or network request is involved at any point.
- **The second factor is a lock-screen control, not added encryption strength, and the app says so where it is set up.** The shared secret lives inside the encrypted workspace, so it can only be checked after the passphrase has already decrypted it. It stops someone who has watched or guessed the passphrase from opening the workspace in this browser; it does not stop someone holding both a backup file and the passphrase. The passphrase remains the only thing protecting the data at rest.
- While a second factor is outstanding the decrypted workspace is held out of the UI entirely: nothing is rendered and no record is reachable until a code or recovery code is accepted. Locking, or pressing "start again", discards it.
- Recovery codes are 8 random base32 codes shown exactly once. Only salted SHA-256 hashes are stored. A used code is removed and the workspace re-sealed **before** it opens, so an interrupted unlock cannot leave a code reusable. Comparison is case- and separator-insensitive so a code can be typed as it was written down.
- Turning two-factor off clears the secret and every recovery hash.
- **Never touch the network** blocks the reference exchange-rate request, which is the only outbound request the application can make, and clears any cached quote. With it on, nothing leaves the browser.
- **Hide amounts** blurs figures on Home. It is a shoulder-surfing convenience, not a security control: the values are present in the DOM.
- Auto-lock is configurable at 1, 5, 15 or 30 minutes and is stored inside the encrypted workspace. Page-hide and other-tab locking are unchanged.

## The practitioner review tick

- A certificate is an ECDSA P-256 signature over a payload naming the reviewer, their registration, the tax year, the review date and a SHA-256 fingerprint of the pack's figures.
- Verification requires the reviewer's public key to be compiled into the release. `REVIEWERS` is empty in this build, so no tick can be displayed by anyone, including the publisher. A tick the publisher can mint for itself carries no information.
- The fingerprint covers every receipt, expense, account, statement line and profile declaration in scope for the year, sorted by id so array order cannot change it, plus the name on the pack. Any change to a figure or declaration moves the pack to "review out of date" automatically.
- A tick means the holder of that reviewing key signed off those figures. It is not an FBR approval, and Hisaab does not itself verify that the reviewer's registration is genuine — that check belongs to whoever onboards the reviewer. Reviewing private keys belong to the reviewer and are generated outside the repository; see `docs/LICENSING.md` and `tools/make-review.mjs`.

## Limits and operational requirements

A compromised browser, same-origin injected script, malicious extension or unlocked computer can read decrypted data. Browser clearing removes the vault, and storage is not synchronized across devices. Losing the passphrase loses access. Backups must be kept by the user; financial CSV and worksheet exports are plaintext. A private hosted Site protects page access but is not a substitute for vault encryption. This code has not undergone an independent penetration test or professional tax review.

Concurrent tabs are not a supported editing workflow; another-tab writes trigger a lock. Do not assume atomic multi-tab transactions. Receipt-heavy books should export and archive evidence before reaching browser quota. No bank tokens, CNIC, government login or private credentials should be entered into free-text fields.

For public commercial use: commission a Pakistani accountant's review of tax branches and a security audit; verify deployed HTTP headers; define support/incident handling; obtain legal review of terms/privacy and processor relationships. Cloud accounts, shared workspaces and billing are not implemented.

Report vulnerabilities privately through the repository owner's GitHub contact. Do not open public issues containing passphrases, real receipts or financial data.
