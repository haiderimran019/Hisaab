# Security policy and data boundaries

Hisaab 1.2 is a local-first, single-person application. The public build has no configured Hisaab service, account sign-in, telemetry or bank/IRIS integrations. The optional Worker code can hold buyer and subscriber records, but has no API or database for customer financial records. Optional live reference FX calls `https://open.er-api.com/v6/latest/USD` with credentials omitted and no ledger fields. The provider necessarily receives network metadata such as the visitor's IP. Fonts and icons are bundled locally.

## Implemented controls

- Only encrypted envelopes are stored under `hisaab.encrypted.v1` in browser localStorage. Unencrypted demo data is held in memory, never copied into a newly created vault.
- AES-256-GCM encryption and authenticated decryption through WebCrypto. A random 256-bit data key encrypts the workspace with a fresh IV on every write. PBKDF2-SHA256 at 600,000 iterations derives a wrapping key from the passphrase and a random salt. The data key is held as raw bytes in memory while unlocked so it can be wrapped for another unlock method; it is cleared from application references on lock, but JavaScript cannot guarantee memory erasure. Passphrase length is 12–256 characters; there is no server recovery service. Older encrypted workspaces migrate on unlock, and the passphrase unlock method is always retained.
- Five-minute inactivity lock and page-hide lock. Lock clears UI, print previews, workspace references, attachment references and key references. JavaScript garbage collection is not a guarantee of cryptographic memory erasure. Other-tab storage changes lock the active workspace.
- Strict Zod schemas and bounded inputs for dates, positive FX, amounts, categories, record counts, imported encrypted envelopes and decrypted workspaces. 8 MB import cap; 3 MB plaintext workspace cap; receipt upload limited to 1 MB PNG/JPEG/PDF, MIME and signature checked. Attachments are encrypted with the workspace and downloaded as files, never executed or embedded as active PDF content.
- All stored user text is escaped before HTML templating. No user HTML rendering. CSV cells are quoted and leading formula characters are neutralized. Generated financial downloads are explicitly user initiated.
- No external scripts. Restrictive CSP in HTML; optional security headers in `public/_headers`. Header support is host dependent and must be verified on the actual host. The HTML CSP cannot enforce `frame-ancestors`; the HTTP header is required for it.
- Confirmation for workspace replacement and record deletion; typed DELETE for local workspace erasure. Only the app's own storage key is removed. No global `localStorage.clear()`.
- Lockfile, reproducible builds and CI with least privilege. No credentials or financial fixtures in the repository.
- Tax years, legal references and explicit unsupported-case gates reduce the risk of misrepresenting a scenario as a complete liability.

## Statement import, licence keys and the Filing Pack

- Statement CSVs are parsed entirely in the browser. The optional document-reading path can send a PDF or photo to a named reader only after explicit consent, a configured service, and licence verification. It is disabled in the public build. A spreadsheet is refused rather than parsed as text.
- Import files are capped at 4 MB and 8,000 rows; a workspace holds at most 8,000 statement lines, 40 accounts and 400 import batches, inside the existing 3 MB plaintext workspace cap.
- Imported text is validated by strict Zod schemas and escaped before templating on every surface, including the printed Filing Pack. A pack-level test asserts that statement text cannot inject markup or script.
- A row that cannot be read is listed with its row number and original text; it is never dropped silently, netted, or given a guessed date, sign or amount. A row carrying both a debit and a credit is reported rather than reconciled away.
- Duplicate detection is a reversible flag, not a deletion. Duplicate lines are excluded from reconciliation arithmetic and shown as such.
- Reconciliation reports the unexplained difference. The application has no code path that closes a difference by creating a balancing entry.
- Licence keys are ECDSA P-256 signatures over a plain payload, verified with WebCrypto against a public key compiled into the bundle. Normal app use verifies a key offline. The optional document-reading request sends the key to the Worker so it can verify the paid entitlement and enforce a per-licence quota; that path is disabled in the public build.
- **Licence enforcement is client-side and is not a security control.** The gate can be removed by anyone willing to edit the published bundle, and the app states this in Settings. The signing private key is held outside the repository; see `docs/LICENSING.md` for its handling and leak recovery.
- An absent, invalid or expired key never blocks reading, editing, exporting or backing up a customer's own records.

## Two-factor codes, recovery and privacy switches

- Two-factor uses RFC 6238 TOTP (SHA-1, 6 digits, 30-second step, one step of drift either side), computed in the browser with WebCrypto and verified against the RFC's published test vectors. Any standard authenticator app works. No phone number, email address or network request is involved at any point.
- **The second factor is a lock-screen control, not added encryption strength, and the app says so where it is set up.** The shared secret lives inside the encrypted workspace, so it can only be checked after the passphrase has already decrypted it. It stops someone who has watched or guessed the passphrase from opening the workspace in this browser; it does not stop someone holding both a backup file and the passphrase. The passphrase protects the data key at rest; a registered passkey would provide another way to unwrap that same key, but its browser UI is not yet available.
- While a second factor is outstanding the decrypted workspace is held out of the UI entirely: nothing is rendered and no record is reachable until a code or recovery code is accepted. Locking, or pressing "start again", discards it.
- Recovery codes are 8 random base32 codes shown exactly once. Only salted SHA-256 hashes are stored. A used code is removed and the workspace re-sealed **before** it opens, so an interrupted unlock cannot leave a code reusable. Comparison is case- and separator-insensitive so a code can be typed as it was written down.
- Turning two-factor off clears the secret and every recovery hash.
- In the public build, **Never touch the network** blocks optional reference exchange-rate requests, model downloads and localhost routing, and clears any cached quote. Already-loaded on-device inference is local. If a Hisaab service is configured in a future build, each service request needs its own consent and offline-control review before release.
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

## Local Qwen3-1.7B development prototype (31 October 2026)

The local development build can send the current question and up to six bounded
recent messages to a localhost-only Qwen gateway. Ollama cloud features are
disabled. No hosted model endpoint is configured in production builds; the separate public on-device option is described below. The gateway
checks host, browser origin, content type, request size and concurrent requests;
it is not an authenticated multi-user hosting service and must not be exposed
through a public tunnel. It logs no message content. Model output is limited to
validated routing/definition identifiers; free prose, numbers, IRIS codes and
write actions are not accepted as authoritative output. The original financial
functions calculate every figure. Never touch the network skips the model call.

Lock and new-chat cancel pending model requests. Recent/all chat history and
user-confirmed memory reuse the encrypted workspace. Memories are editable and
deletable, record their user source and date, and do not override tax declarations
or verified law. History is bounded by the existing vault size, 200 archives and
120 messages per chat; overflow is refused rather than silently truncating chats.
No shared model training, Google sign-in, remote sync, Gmail access or new
notification delivery has been enabled. These need a separately reviewed account
and consent boundary before those features can be publicly enabled.

XLSX is generated locally by a pinned, lazy-loaded writer. Text cells cannot
become formulas; CSV formula escaping is retained. Exported files are plaintext
and remain outside the vault after the user downloads or shares them.

## Public chat release (31 October 2026)

Financial chat changes are snapshots validated by the original receipt, expense and invoice schemas. Confirmation checks the existing record against the proposed preimage; undo checks the postimage and refuses intervening changes or deletion of a statement-linked record. Proposals, activity, file snapshots, history and memories are encrypted by the existing vault, not held in a separate plaintext chat store.

Optional browser Qwen3-1.7B runs in a Web Worker. Only an enumerated intent/definition is accepted; free-form model prose, model arithmetic and model-generated IRIS codes are discarded. The runtime is lazy-loaded after explicit download consent. Hugging Face and GitHub supply public model/runtime assets. No customer request is sent to them. Locking terminates the worker. No hosted inference, Google sign-in, sync or Gmail connection is configured.

Offline app caches contain public code and fonts, not records. Never touch the network blocks optional app requests and model downloads. Loading/updating the website itself is a browser navigation and is not a network-isolation mechanism. Exported PDF/Excel/CSV/JSON files intentionally contain private financial data; download and native sharing remain explicit user actions.
