# Hisaab service

A deliberately small backend. It does two things and refuses a third.

**It does:** hold email addresses people actively gave us, with double opt-in and
one-click unsubscribe, so licence keys and occasional updates can be sent. And
count how many times the app is opened.

**It refuses:** anything financial. There is no endpoint, no accepted field and no
column for an amount, a client name, a statement row, a tax figure or a device
identifier. That is enforced in code — every endpoint declares the exact fields it
accepts and rejects a body carrying anything else — and a test fires real-looking
payloads (`income`, `client`, `receipts`, `taxDue`, `lines`, `installId`) at it and
asserts each is refused with a 400. If someone later changes the client carelessly,
these tests fail rather than data leaking.

## Why usage counts are "opens, not people"

The ping carries a date, a build string and a plan word. **No identifier at all.**
The client only sends one per local day, so an install contributes roughly one
open a day — but one person on two browsers counts twice, and anyone who turns the
ping off counts zero. `/v1/stats` says so in its own response, so the number is
never quoted as a headcount by mistake. That undercount is the price of not
putting a tracking id on a privacy-first product, and it is the right trade.

## Endpoints

| | |
|---|---|
| `GET /v1/health` | liveness |
| `POST /v1/usage` | `{day, appVersion, plan}` — nothing else is accepted |
| `GET /v1/stats` | public aggregates: last 30 days, by plan, confirmed subscribers |
| `POST /v1/subscribe` | `{email, consent: true, source?}` — pending until confirmed |
| `GET /v1/confirm?token=` | double opt-in |
| `GET /v1/unsubscribe?token=` | one click, no login |
| `GET /v1/admin/subscribers` | bearer `ADMIN_TOKEN` |
| `POST /v1/admin/purge` | clears yesterday's rate-limit rows |

Browser callers must come from `ALLOWED_ORIGIN`. IP addresses are never stored:
rate limiting uses a truncated SHA-256 of the IP with a salt that rotates daily,
and those rows are purged with the day.

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

**Without `RESEND_KEY` and `MAIL_FROM`, confirmation emails are silently skipped**
— addresses sit as `pending` and never reach the list. Set them before announcing
the sign-up, or you will collect nothing. Sending mail from your own domain also
needs SPF/DKIM records at the registrar; a provider's dashboard walks through it.

## Running the tests

```bash
cd server && npm test        # 15 tests, no network, no wrangler needed
```

The handlers take a `Store` interface, so the suite runs against an in-memory
double. The same code runs against D1 in production.

## What is still missing before this is a real service

- **Backups.** D1 has time-travel restore; prove you can actually use it before relying on it.
- **A deletion path.** Unsubscribe marks a row; a person asking to be erased entirely needs a real delete, and the privacy notice should say which happens.
- **Monitoring.** Nothing alerts you if this falls over. `GET /v1/health` is there for whatever you point at it.
- **Terms and the privacy notice** must be updated the moment this is live, because the app stops being "nothing leaves your device" and becomes "nothing *financial* leaves your device". That distinction has to be honest and visible, not buried.
