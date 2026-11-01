# Security policy and data boundaries

Hisaab is a local-first finance application with optional Supabase accounts, company-scoped encrypted sync, a hosted finance assistant and opt-in background reminders. Google credentials and the hosted model key must be configured by the owner before those routes are available. See the generated [privacy notice](docs/PRIVACY.md).

## Encryption and local controls

The existing WebCrypto implementation is unchanged: a random 256-bit data key encrypts the workspace with AES-256-GCM and a fresh IV; PBKDF2-SHA256 at 600,000 iterations derives a passphrase wrapping key with a random salt. Passphrases are 12–256 characters, never sent to a server, and have no publisher reset. The passphrase unlocker is always retained. Older workspaces migrate through the existing unlock path.

Records, attachments, chats, personal memory, proposals and file snapshots remain inside that encrypted workspace. Device passkeys wrap the same key; cloud envelopes retain only the passphrase slot, excluding device labels and credential IDs. A company member still needs the workspace passphrase to decrypt a downloaded copy. Automatic per-member key distribution is not implemented.

Page-hide, inactivity and other-tab writes lock the workspace. Locking clears application/key references, print previews, generated-file caches and on-device model workers, cancels hosted requests and pauses sync. JavaScript cannot guarantee cryptographic memory erasure. An unlocked or compromised browser, malicious extension or same-origin injected script can read decrypted information.

Optional TOTP is a lock-screen control, not additional encryption strength: its secret is inside the encrypted workspace. Recovery codes are single-use salted hashes and are consumed before opening. A backup plus its passphrase can be decrypted independently. Hide amounts is a shoulder-surfing convenience; values remain in the DOM.

## Company isolation and sync

Customer transport tables carry `company_id`: encrypted workspaces, memberships, push subscriptions and AI quota context. Companies and membership records control access. RLS never uses user-editable profile metadata to assign roles.

- Owners and Editors can save their company's envelope; Viewers have read-only access.
- Membership changes apply on the next database request, independently of token age.
- Membership writes are not granted to frontend users. The narrow private company-creation function checks `auth.uid()`, generates a fresh company ID and creates its owner membership atomically. It cannot grant access to an existing company.
- Private definer helpers exist only for company creation and self-role lookup, with fixed empty search paths and revoked public/anonymous execution. Their purpose is explicit bootstrap/recursion control, not a general permission bypass.
- Company IDs on existing workspace/subscription rows are immutable.
- Saves use an expected-revision RPC. Stale versions are rejected. The local encrypted save remains intact on a cloud conflict; the UI requires review before replacing it with the cloud copy.
- A sync binding is scoped to user, company, revision and a hash of the public wrapping metadata. Changing company pauses sync. This non-financial binding and account session live in tab session storage; decrypted chats/records do not.
- Sync transfers the existing encrypted workspace as one bounded envelope. It is not an incremental multi-editor CRDT. Large receipt-heavy workspaces consume bandwidth and need explicit limits. Conflicts do not merge automatically.

Shared service configuration is in an unexposed private schema. Push private keys and dispatcher tokens are readable only by the server role. AI rate counters cannot be read or changed by authenticated frontend users. Public keys are publishable; service-role, OAuth and AI secrets never belong in the client or Git.

The hosted SQL tests exercise real database RLS with rolled-back synthetic users: cross-company reads/writes, owner/editor/viewer behavior, self-escalation, forged user metadata, revoked membership, company reassignment, stale revisions and access to private configuration. They do not replace an independent security audit or full signed-in browser testing.

## AI boundary

Guided tools and the original deterministic functions produce financial amounts and tax estimates. Optional local Qwen routing accepts only enumerated intents/definitions. Optional hosted chat is authenticated using Auth.getUser, checks company membership through RLS, and has a server-owned rate counter.

The hosted route accepts a bounded current question and six short recent messages only after a privacy preview. Known clients/account references and identifiers are redacted; users must check for missed details. It does not receive a ledger snapshot, attachment, passphrase or confirmed memory. Company IDs and session tokens authenticate the gateway and are not forwarded to the model.

Hosted chat has no write tools. Financial changes require user-confirmed proposals through existing schemas. Confirmation compares the original record; undo compares the confirmed result and refuses intervening changes or deletion of statement-linked records. Model JSON is checked and numerical claims/private-reasoning markup are rejected. This does not make arbitrary model prose a verified financial source.

The gateway is restricted to free model variants with paid fallbacks disallowed and no-data-collection/zero-retention provider routing requested. If no eligible provider is available, the request fails closed. Capacity is limited by both Hisaab and the provider account. The code does not log prompt/reply bodies or train shared weights on private chats. Provider and hosting metadata processing remain subject to their policies.

IRIS codes, labels and paths are shown as verified only with exact tax-year provenance, source, checked date and reviewer. No real catalogue codes have been invented. User-supplied memory is separate and labelled From you, not verified. Tax scenarios retain their existing eligibility gates.

## Notifications

Web Push is opt-in and requires a signed-in company member. Subscription rows are user- and company-scoped. The sender requires a separate private dispatcher token, permits only known browser push-service hosts to prevent arbitrary URL fetching, and removes expired or non-member subscriptions. Scheduled notices contain generic check-ins, never balances or client names. Notification popup typography is controlled by the operating system.

Turning on Never touch the network first revokes the current device's reminder subscription when possible, then cancels/blocks optional app cloud requests. Other devices have separate preferences. Browser navigation, updates and browser-managed push infrastructure are not a network-isolation mechanism.

## Input, files and deployment

Strict schemas cap the decrypted workspace at 3 MB, encrypted imports at 8 MB, receipt uploads at 1 MB and statement imports at 4 MB/8,000 rows. Receipt MIME/signature checks, escaped user text, CSV formula escaping, typed Excel string cells and existing deterministic reconciliation are retained. Statement text is data, never instructions. Unexplained differences are never filled with balancing entries.

Plain PDF/Excel/CSV/JSON exports intentionally contain financial data and remain outside encryption once downloaded/shared. Offline caches contain public app assets only. The CSP permits the named Supabase service, optional rate provider and consented model downloads; host HTTP-header support must still be verified on the deployed host. No browser API secret is required.

This code has not undergone an independent penetration test or professional Pakistani tax review. Supabase free-tier limits and third-party AI quotas do not provide unlimited production capacity. Company member invitations, automated key distribution, Gmail imports and self-service cloud company deletion remain future workflows. No bank credentials, CNIC or IRIS password should be entered into chat.

Report vulnerabilities privately through the repository owner's GitHub contact; never post credentials or real financial records in public issues.
