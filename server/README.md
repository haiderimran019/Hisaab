# Hisaab service

A deliberately small backend. It does five things and refuses a sixth.

**It does:** hold email addresses people actively gave us, with double opt-in and
one-click unsubscribe. Count how many times the app is opened. Sell and re-deliver
licence keys. Broker a paid review by a named practitioner. And read a statement
document on request.

**It refuses:** anything financial. There is no endpoint, no accepted field and no
column for an amount, a client name, a statement row, a tax figure or a device
identifier. `licences.amount_minor` is the one money column in the schema and it
is *our* sale price, not the customer's income.

That refusal is structural, not a habit. Every route declares the exact fields it
accepts and rejects a body carrying anything else, and the test
`no route in the service accepts financial data` walks the route table itself —
not a hand-written list — firing `income`, `client`, `taxDue`, `receipts`,
`lines`, `ntn` and `installId` at every POST route with whatever credentials that
route needs, and asserting each is refused with a 400 that names the offending
fields and echoes none of their values. **Add a route that quietly accepts an
unknown field and that test fails without anybody remembering to update it.**
Four routes read no JSON body at all; they are named in the test, with the reason,
rather than skipped silently.

## The two halves, and why they never meet

| | the vault | this service |
|---|---|---|
| holds | the books: income, clients, statements, tax figures | name, email, licence key, renewal date |
| lives | on the device, AES-GCM encrypted | Cloudflare D1 |
| unlocked by | a passkey or a passphrase, on the device | — |
| signed in with | nothing. There is no account | Google, or a single-use email link |

A portal session authenticates a **buyer**, never a vault. It cannot open, read
or sync a workspace, because there is no server-side workspace to open. If every
table here leaked tomorrow, the worst anyone would learn is who bought the
software. No Google script runs in the app itself.

## Why usage counts are "opens, not people"

The ping carries a date, a build string and a plan word. **No identifier at all.**
The client only sends one per local day, so an install contributes roughly one
open a day — but one person on two browsers counts twice, and anyone who turns the
ping off counts zero. `/v1/stats` says so in its own response, so the number is
never quoted as a headcount by mistake. That undercount is the price of not
putting a tracking id on a privacy-first product, and it is the right trade.

## Endpoints

Adding one means adding an entry to `ROUTES` in `src/index.ts`. The table carries
the method, the path, whether a session or an admin token is needed, and the
rate-limit bucket — so the checks are part of the table rather than part of each
handler, which is what stops the twentieth route being the one that forgot.

### Open

| | |
|---|---|
| `GET /v1/health` | liveness |
| `POST /v1/usage` | `{day, appVersion, plan}` — nothing else is accepted |
| `GET /v1/stats` | public aggregates: last 30 days, by plan, confirmed subscribers |
| `POST /v1/subscribe` | `{email, consent: true, source?}` — pending until confirmed |
| `GET /v1/confirm?token=` | double opt-in |
| `GET /v1/unsubscribe?token=` | one click, no login |
| `POST /v1/unsubscribe?token=` | RFC 8058 one-click, for mail clients |
| `GET /v1/reviewers` | the practitioners currently taking work |
| `POST /v1/extract` | a PDF or photo of a statement, read into proposed rows |
| `POST /v1/extract/quota` | `{licence}` — how much of the annual allowance is left |

### Portal (a signed-in buyer)

| | |
|---|---|
| `POST /v1/portal/signin` | `{email}` for a single-use link, or `{idToken}` for Google |
| `POST /v1/portal/session` | `{token}` → a 30-day session. Works once |
| `GET /v1/portal/licences` | which keys this address bought |
| `POST /v1/portal/resend` | email the active keys again |
| `POST /v1/portal/erase` | `{scope, confirm: true}` — a real delete |
| `POST /v1/portal/signout` | ends this session |

### Review broker (a signed-in buyer, or a listed practitioner)

| | |
|---|---|
| `POST /v1/review/request` | `{reviewerId, fingerprint, taxYear}` |
| `GET /v1/review/jobs` | the customer's own requests |
| `GET /v1/review/queue` | a practitioner's queue |
| `POST /v1/review/update` | accept, decline, or return a signed review |

### Admin (bearer `ADMIN_TOKEN`, compared in constant time)

| | |
|---|---|
| `GET /v1/admin/subscribers` | the list, with counts |
| `POST /v1/admin/purge` | clears expired tokens, sessions and rate-limit rows |
| `POST /v1/admin/licence` | record a sale and email the key. Idempotent on `keyId` |
| `GET /v1/admin/licence?email=` | the ledger rows for one address |
| `POST /v1/admin/licence/status` | mark a key active, refunded or replaced |
| `POST /v1/admin/reviewer` | add a practitioner. Created `pending` |
| `POST /v1/admin/reviewer/status` | publish or suspend one |
| `GET /v1/admin/reviewers` | all three states |

Browser callers must come from `ALLOWED_ORIGIN`. IP addresses are never stored:
rate limiting uses a truncated SHA-256 of the IP with a salt that rotates daily,
and those rows are purged with the day.

## Selling keys

The private signing key is **not on this server and must never be.** Keys are
minted offline by `tools/make-license.mjs`; `POST /v1/admin/licence` records a
sale that already happened and emails the finished key. That is what keeps the
whole licence system verifiable offline — and it is also the honest limit of it:

**A refund marks the ledger. It does not revoke the key.** Keys are verified on
the device against an embedded public key, so nothing here can reach an install.
The 14-day refund promise in `src/pricing.ts` is kept by returning money, not by
breaking software someone already has. `/v1/admin/licence/status` says so in its
own response, so it cannot be misread as a kill switch.

## The review broker

`COMMERCIAL.md` §7 puts a qualified Pakistani practitioner's written review as the
largest outstanding risk in the product, and `src/review.ts` already builds the
hard half — a signed review that goes stale the moment a figure changes. What was
missing was a way to reach a practitioner.

The design constraint is absolute: **a Filing Pack never touches this service.**
The customer sends their pack to the practitioner directly, however the two of
them agree. All this holds is the job — who asked whom, for which tax year, and
the pack's **fingerprint**, a SHA-256 hash that cannot be turned back into
figures. `readReviewRequest` enforces 64 hex characters, so there is no field a
pack could be smuggled through even by a caller who wanted to. The signature comes
back through here and the app verifies it against the practitioner's published key.

A practitioner is created `pending` on purpose: being in the table is not being
published. Check the registration number with their own body first. A reviewer
sees only their own queue, and "no such job" and "not your job" give the identical
answer so one practitioner cannot probe for another's work.

## Reading documents (`/v1/extract`)

For customers whose bank only gives PDFs. Six rules hold it together:

1. **Nothing is stored.** The file lives in memory for one request, is forwarded, and is dropped. No table, no log line, no copy. An upstream error body is never relayed back, because it can echo the document.
2. **Nothing is trusted.** The model's reply is parsed strictly — a row without an ISO date and a numeric amount is discarded, never repaired. Rows come back as *proposals*.
3. **Arithmetic decides, then a person.** The client runs the returned rows through the running-balance check (`verifyBalances` in `src/statements.ts`). A misread digit breaks the chain at exactly that row and it is set aside. The model never writes into a ledger.
4. **Paid, and checked here.** The licence signature is verified in the Worker, not taken on trust from the browser. A key carrying no identifier is refused rather than let through uncounted, because it could not be metered.
5. **Capped per licence, not just per IP.** `EXTRACT_ANNUAL_CAP` documents per licence per **tax year** — July to June, so a filing season gets a whole allowance. The default is 40. The per-IP cap stops a flood; this stops one paying customer costing more than they pay.
6. **Named, or off.** The route refuses to read anything unless `READER_NAME` is set. Consent is meaningless if the recipient cannot be named.

It is **off** unless `MODEL_PROVIDER`, `MODEL_NAME`, `MODEL_KEY` and `READER_NAME`
are all set — a service without them returns 501 and reads nothing.

```bash
npx wrangler secret put MODEL_KEY
# then in wrangler.toml [vars]:
#   MODEL_PROVIDER = "gemini"      (or "anthropic")
#   MODEL_NAME     = "<model id>"
#   READER_NAME    = "<who reads it, shown on the consent screen>"
#   LICENCE_PUBLIC_KEY = '<the JWK from src/license.ts>'
```

Before switching it on, satisfy yourself about the provider's current retention
and training terms for the **paid** tier — they differ from the free tier, and
that difference is the whole argument for whether sending a customer's statement
is acceptable. Read the terms yourself; do not take anyone's summary, including
this file's.

### The country gate

This is the **only** route that sends a customer's financial document out of the
country. Pakistan has no enacted data protection act today, but the pending bill
would restrict exactly this, and its "critical" and "sensitive" categories are
loosely drawn.

```
EXTRACT_BLOCKED_COUNTRIES = "PK"
```

Callers from a listed country get **451** and a pointer to the CSV import, which
never leaves the device. It is a `[vars]` entry, so it takes effect the day the
law does — no rebuild, no redeploy of the app, nothing else in the product
affected, because nothing else in the product leaves the device. Do not claim
compliance with a law that has not been enacted; this is a switch, not a claim.

## Deploying it

```bash
cd server
npm install
npx wrangler login
npx wrangler d1 create hisaab          # paste the id into wrangler.toml
npm run db:init                        # creates the tables
npx wrangler secret put RATE_SECRET    # any long random string
npx wrangler secret put ADMIN_TOKEN    # keep this one safe
npx wrangler secret put RESEND_KEY     # optional — without it, no mail is sent
npm run deploy
```

Free tier is ample: 100,000 requests a day and 5 GB of D1 cover far more than this
product will see for a long time.

**Without `RESEND_KEY` and `MAIL_FROM`, no mail is sent at all** — addresses sit
as `pending` and never reach the list, and a buyer never receives their key. The
sale is still recorded and `/v1/portal/resend` will deliver it once mail works,
but set them before announcing the sign-up or taking a payment. Sending mail from
your own domain also needs SPF/DKIM records at the registrar; a provider's
dashboard walks through it.

Google sign-in needs `GOOGLE_CLIENT_ID` and nothing else — the ID token is
verified here against Google's published keys (signature, issuer, audience,
expiry, `email_verified`), never taken on the browser's word. Without it, that
route returns 501 and the email link still works.

## Running the tests

```bash
cd server && npm test        # 58 tests, no network, no wrangler needed
```

The handlers take a `Store` interface, so the suite runs against an in-memory
double; the same code runs against D1 in production. Google's keys are injected
with `primeGoogleKeys`, so token verification is genuinely exercised without a
network call. Nothing in the suite talks to the internet.

## What is still missing before this is a real service

- **Backups.** D1 has time-travel restore; prove you can actually use it before relying on it.
- **Monitoring.** Nothing alerts you if this falls over. `GET /v1/health` is there for whatever you point at it.
- **Terms and the privacy notice** must be updated the moment this is live, because the app stops being "nothing leaves your device" and becomes "nothing *financial* leaves your device". That distinction has to be honest and visible, not buried — and it is now wider than it was: this service holds a sales ledger, portal sessions and review jobs.

Two items that were on this list are done, and are worth knowing where to find:
a real **deletion path** (`POST /v1/portal/erase`, which deletes rather than
flags and records the fact as a hash, so "did you honour my request" can be
answered without keeping the address we were asked to forget), and the
**per-licence annual cap** on document reading.
