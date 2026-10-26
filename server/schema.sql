-- Hisaab service schema.
--
-- The invariant, stated precisely so it stays checkable as this file grows:
-- **no table holds a customer's own financial data** — not an income figure, a
-- client name, a statement row, an invoice, a tax figure, or any identifier for
-- a device. Those live encrypted on the customer's device and there is no
-- endpoint that accepts them (see src/validate.ts, and the test that fires
-- real-looking payloads at every route).
--
-- `licences.amount` is the one money column and it is *our* sale price — what a
-- customer paid us — not anything about what they earn. A sales ledger needs it
-- to honour renewals and refunds, and the privacy notice says so plainly.

create table if not exists subscribers (
  email        text primary key,
  status       text not null check (status in ('pending','confirmed','unsubscribed')),
  token        text not null unique,
  source       text not null default 'app',
  created_at   text not null,
  confirmed_at text
);
create index if not exists subscribers_status on subscribers (status);

-- Aggregate counts only. A row says "on this day, this many opens of this build
-- reported this plan". There is deliberately no device id, so these are opens,
-- not people — an honest undercount beats a tracking identifier.
create table if not exists usage (
  day         text not null,
  plan        text not null,
  app_version text not null,
  opens       integer not null default 0,
  primary key (day, plan, app_version)
);

-- Abuse control only. `key` is a truncated hash of an IP with a salt that rotates
-- daily; rows are purged with the day and cannot be turned back into an address.
create table if not exists rate_limit (
  key   text primary key,
  day   text not null,
  count integer not null default 0
);

-- ---------------------------------------------------------------------------
-- The sales ledger.
--
-- COMMERCIAL.md §7 requires this before taking money: every key recorded with
-- id, name, plan, amount, date and expiry. `key_id` is the uuid inside the
-- signed licence, so a support request can be traced to a sale without us
-- holding the signed key itself. `amount_minor` is in the smallest unit of
-- `currency` (paisa for PKR, cents for USD) so no float ever touches money.
-- `licence_key` is the signed key itself, so a customer can fetch it again from
-- the portal instead of emailing support. The **private signing key is not here
-- and must never be** — keys are minted offline by tools/make-license.mjs and
-- only the finished, already-public key is recorded. A leak of this table would
-- let someone reuse a key, which COMMERCIAL.md §5 already accepts as the price
-- of client-side enforcement; it would not let anyone mint a new one.
create table if not exists licences (
  key_id       text primary key,
  licence_key  text not null default '',
  email        text not null,
  name         text not null,
  plan         text not null check (plan in ('pro','accountant')),
  amount_minor integer not null,
  currency     text not null check (currency in ('PKR','USD')),
  payment_ref  text not null default '',
  issued_at    text not null,
  expires_at   text not null,
  status       text not null check (status in ('active','refunded','replaced')) default 'active',
  note         text not null default ''
);
create index if not exists licences_email on licences (email);
create index if not exists licences_expiry on licences (expires_at);

-- ---------------------------------------------------------------------------
-- Portal sign-in. This is for buying and retrieving a key — never for the
-- vault, which has no account and no server. Two ways in: a single-use emailed
-- link, or a Google ID token verified against Google's own keys. Either way all
-- we end up holding is a verified email address.
create table if not exists auth_tokens (
  token      text primary key,
  email      text not null,
  created_at text not null,
  expires_at text not null,
  used_at    text
);
create index if not exists auth_tokens_email on auth_tokens (email);

create table if not exists sessions (
  token      text primary key,
  email      text not null,
  method     text not null check (method in ('link','google')),
  created_at text not null,
  expires_at text not null
);
create index if not exists sessions_email on sessions (email);

-- ---------------------------------------------------------------------------
-- Per-licence document-reading quota.
--
-- server/README.md warns that uncapped extraction eats the margin at this price.
-- The per-IP cap stops flooding; this stops one paying customer costing more
-- than they pay. Counted per licence per tax year, never per document contents.
create table if not exists extract_quota (
  key_id text not null,
  year   text not null,
  used   integer not null default 0,
  primary key (key_id, year)
);

-- ---------------------------------------------------------------------------
-- The practitioner review broker.
--
-- Note what is absent: the Filing Pack itself. A pack travels from the customer
-- to the practitioner directly — email, download, however they agree — and the
-- service only ever sees its fingerprint, which is a hash and cannot be turned
-- back into figures. That is what lets a paid review exist without this service
-- ever holding anyone's books.
create table if not exists reviewers (
  id            text primary key,
  name          text not null,
  firm          text not null default '',
  registration  text not null default '',   -- e.g. an ICAP/ACCA/ITP number, shown to customers
  public_key    text not null,              -- JWK; the app verifies signed reviews against this
  contact_email text not null,
  status        text not null check (status in ('pending','active','suspended')) default 'pending',
  created_at    text not null
);
create index if not exists reviewers_status on reviewers (status);

create table if not exists review_jobs (
  id             text primary key,
  reviewer_id    text not null,
  customer_email text not null,
  fingerprint    text not null,             -- hash of the pack. Not the pack.
  tax_year       text not null,
  status         text not null check (status in ('requested','accepted','signed','declined','withdrawn')) default 'requested',
  signature      text not null default '',  -- the practitioner's signed review, returned to the customer
  created_at     text not null,
  updated_at     text not null
);
create index if not exists review_jobs_reviewer on review_jobs (reviewer_id, status);
create index if not exists review_jobs_customer on review_jobs (customer_email);

-- ---------------------------------------------------------------------------
-- Erasure audit.
--
-- server/README.md names the gap: unsubscribe only marks a row, and a person
-- asking to be erased entirely needs a real delete. The rows go; this records
-- that it happened, keyed by a hash of the address so we can answer "did you
-- honour my request" without keeping the address we were asked to forget.
create table if not exists erasures (
  email_hash text primary key,
  erased_at  text not null,
  scope      text not null check (scope in ('subscriber','licence','all'))
);
