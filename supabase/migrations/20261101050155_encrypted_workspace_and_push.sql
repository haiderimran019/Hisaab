-- Only encrypted vault envelopes belong here. No plaintext ledger or chat columns.
create table public.encrypted_workspaces (
 user_id uuid primary key references auth.users(id) on delete cascade,
 envelope jsonb not null check (octet_length(envelope::text) <= 8000000),
 revision bigint not null check (revision > 0),
 updated_at timestamptz not null default now(),
 constraint encrypted_envelope check (envelope->>'format' = 'hisaab-aesgcm-v2' and jsonb_typeof(envelope->'ciphertext')='string' and jsonb_typeof(envelope->'unlockers')='array')
);
alter table public.encrypted_workspaces enable row level security;
revoke all on public.encrypted_workspaces from anon, authenticated;
grant select,insert,update on public.encrypted_workspaces to authenticated;
create policy workspace_read on public.encrypted_workspaces for select to authenticated using ((select auth.uid())=user_id);
create policy workspace_create on public.encrypted_workspaces for insert to authenticated with check ((select auth.uid())=user_id);
create policy workspace_update on public.encrypted_workspaces for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

create function public.save_encrypted_workspace(payload jsonb, expected_revision bigint)
returns bigint language plpgsql security invoker set search_path='' as $$
declare next_revision bigint;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if expected_revision < 0 then raise exception 'Invalid revision'; end if;
 if expected_revision=0 then
  insert into public.encrypted_workspaces(user_id,envelope,revision) values(auth.uid(),payload,1)
  on conflict(user_id) do nothing returning revision into next_revision;
 else
  update public.encrypted_workspaces set envelope=payload,revision=revision+1,updated_at=now()
  where user_id=auth.uid() and revision=expected_revision returning revision into next_revision;
 end if;
 if next_revision is null then raise exception using errcode='40001',message='Cloud workspace changed. Download and review before syncing.'; end if;
 return next_revision;
end; $$;
revoke all on function public.save_encrypted_workspace(jsonb,bigint) from public,anon;
grant execute on function public.save_encrypted_workspace(jsonb,bigint) to authenticated;

create table public.push_subscriptions (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null check (length(endpoint)<2048 and endpoint like 'https://%'),
 p256dh text not null check (length(p256dh)<200),auth text not null check (length(auth)<100),
 monthly_statement boolean not null default true,filing_reminders boolean not null default false,
 tax_year integer not null default 2027 check(tax_year in(2026,2027)),
 created_at timestamptz not null default now(),last_sent_date date,
 unique(user_id,endpoint)
);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon,authenticated;
grant select,insert,update,delete on public.push_subscriptions to authenticated;
create policy push_read on public.push_subscriptions for select to authenticated using ((select auth.uid())=user_id);
create policy push_insert on public.push_subscriptions for insert to authenticated with check ((select auth.uid())=user_id);
create policy push_update on public.push_subscriptions for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy push_delete on public.push_subscriptions for delete to authenticated using ((select auth.uid())=user_id);
create index push_subscriptions_user_idx on public.push_subscriptions(user_id);

-- A rolling rate window is server-owned; neither anon nor authenticated can read it.
create table public.ai_rate_limits(user_id uuid primary key references auth.users(id) on delete cascade,window_start timestamptz not null default now(),requests integer not null default 0);
alter table public.ai_rate_limits enable row level security;
revoke all on public.ai_rate_limits from public,anon,authenticated;
create function public.consume_ai_quota(account_id uuid) returns boolean language plpgsql security invoker set search_path='' as $$
declare count_now integer;
begin
 insert into public.ai_rate_limits(user_id,window_start,requests) values(account_id,now(),1)
 on conflict(user_id) do update set
 requests=case when public.ai_rate_limits.window_start<now()-interval '1 hour' then 1 else public.ai_rate_limits.requests+1 end,
 window_start=case when public.ai_rate_limits.window_start<now()-interval '1 hour' then now() else public.ai_rate_limits.window_start end
 returning requests into count_now;
 return count_now<=20;
end; $$;
revoke all on function public.consume_ai_quota(uuid) from public,anon,authenticated;
grant execute on function public.consume_ai_quota(uuid) to service_role;
grant select,insert,update,delete on public.ai_rate_limits to service_role;
