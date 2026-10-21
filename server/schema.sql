-- Hisaab service schema.
--
-- Note what is absent and must stay absent: no table holds an amount, a client
-- name, a statement row, a tax figure or any identifier for a device or person
-- beyond an email address that was actively given to us.

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
