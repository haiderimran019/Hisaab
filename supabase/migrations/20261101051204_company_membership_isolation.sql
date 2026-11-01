-- Company membership is authoritative database state, never JWT user_metadata.
create table public.companies(id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 1 and 120),created_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now());
create table public.company_memberships(company_id uuid not null references public.companies(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,role text not null check(role in('owner','editor','viewer')),primary key(company_id,user_id));
create index company_memberships_user_idx on public.company_memberships(user_id);
alter table public.companies enable row level security;
alter table public.company_memberships enable row level security;
revoke all on public.companies,public.company_memberships from public,anon,authenticated;
grant select on public.companies,public.company_memberships to authenticated;
grant all on public.companies,public.company_memberships to service_role;

-- Private, narrowly scoped definer helpers avoid recursive membership policies.
-- Callers can inspect only their own role, and creation always makes a new ID.
create function hisaab_private.company_role(company uuid) returns text language sql stable security definer set search_path='' as $$ select m.role from public.company_memberships m where m.company_id=company and m.user_id=(select auth.uid()) and auth.uid() is not null $$;
revoke all on function hisaab_private.company_role(uuid) from public,anon;
grant usage on schema hisaab_private to authenticated;
grant execute on function hisaab_private.company_role(uuid) to authenticated;
create policy company_read on public.companies for select to authenticated using (hisaab_private.company_role(id) is not null);
create policy membership_read_self on public.company_memberships for select to authenticated using(user_id=(select auth.uid()));

create function hisaab_private.create_company(label text) returns uuid language plpgsql security definer set search_path='' as $$
declare company uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if length(trim(label))<1 or length(trim(label))>120 then raise exception 'Use a company name of 1 to 120 characters'; end if;
 if (select count(*) from public.company_memberships where user_id=auth.uid() and role='owner')>=10 then raise exception 'Company limit reached'; end if;
 insert into public.companies(name,created_by) values(trim(label),auth.uid()) returning id into company;
 insert into public.company_memberships(company_id,user_id,role) values(company,auth.uid(),'owner');return company;
end; $$;
revoke all on function hisaab_private.create_company(text) from public,anon;
grant execute on function hisaab_private.create_company(text) to authenticated;
create function public.create_hisaab_company(label text) returns uuid language sql security invoker set search_path='' as $$ select hisaab_private.create_company(label) $$;
revoke all on function public.create_hisaab_company(text) from public,anon;
grant execute on function public.create_hisaab_company(text) to authenticated;

-- This is a newly provisioned, empty service; no customer rows are rewritten.
alter table public.encrypted_workspaces drop constraint encrypted_workspaces_pkey;
alter table public.encrypted_workspaces drop constraint encrypted_workspaces_user_id_fkey;
alter table public.encrypted_workspaces rename column user_id to updated_by;
alter table public.encrypted_workspaces alter column updated_by drop not null;
alter table public.encrypted_workspaces add foreign key(updated_by) references auth.users(id) on delete set null;
alter table public.encrypted_workspaces add company_id uuid not null primary key references public.companies(id) on delete cascade;
alter table public.encrypted_workspaces add constraint envelope_fields_only check((envelope - array['format','iv','ciphertext','unlockers']::text[])='{}'::jsonb and envelope ?& array['format','iv','ciphertext','unlockers'] and length(envelope->>'iv')=16 and length(envelope->>'ciphertext')>=20 and jsonb_array_length(envelope->'unlockers')=1 and envelope->'unlockers'->0->>'kind'='passphrase');
drop policy workspace_read on public.encrypted_workspaces;
drop policy workspace_create on public.encrypted_workspaces;
drop policy workspace_update on public.encrypted_workspaces;
create policy workspace_company_read on public.encrypted_workspaces for select to authenticated using(hisaab_private.company_role(company_id) is not null);
create policy workspace_company_insert on public.encrypted_workspaces for insert to authenticated with check(hisaab_private.company_role(company_id) in('owner','editor') and updated_by=(select auth.uid()));
create policy workspace_company_update on public.encrypted_workspaces for update to authenticated using(hisaab_private.company_role(company_id) in('owner','editor')) with check(hisaab_private.company_role(company_id) in('owner','editor') and updated_by=(select auth.uid()));
drop function public.save_encrypted_workspace(jsonb,bigint);
create function public.save_encrypted_workspace(company uuid,payload jsonb,expected_revision bigint) returns bigint language plpgsql security invoker set search_path='' as $$
declare next_revision bigint;
begin
 if auth.uid() is null or hisaab_private.company_role(company) not in('owner','editor') or hisaab_private.company_role(company) is null then raise exception 'Company editor access required'; end if;
 if expected_revision<0 then raise exception 'Invalid revision'; end if;
 if expected_revision=0 then
  insert into public.encrypted_workspaces(company_id,updated_by,envelope,revision) values(company,auth.uid(),payload,1) on conflict(company_id) do nothing returning revision into next_revision;
 else
  update public.encrypted_workspaces set envelope=payload,revision=revision+1,updated_by=auth.uid(),updated_at=now() where company_id=company and revision=expected_revision returning revision into next_revision;
 end if;
 if next_revision is null then raise exception using errcode='40001',message='Cloud workspace changed. Download and review before syncing.'; end if;return next_revision;
end; $$;
revoke all on function public.save_encrypted_workspace(uuid,jsonb,bigint) from public,anon;
grant execute on function public.save_encrypted_workspace(uuid,jsonb,bigint) to authenticated;

alter table public.push_subscriptions add company_id uuid not null references public.companies(id) on delete cascade;
create index push_subscriptions_company_idx on public.push_subscriptions(company_id);
alter table public.push_subscriptions drop constraint push_subscriptions_user_id_endpoint_key;
alter table public.push_subscriptions add unique(company_id,user_id,endpoint);
drop policy push_read on public.push_subscriptions;
drop policy push_insert on public.push_subscriptions;
drop policy push_update on public.push_subscriptions;
drop policy push_delete on public.push_subscriptions;
create policy push_company_read on public.push_subscriptions for select to authenticated using(user_id=(select auth.uid()) and hisaab_private.company_role(company_id) is not null);
create policy push_company_insert on public.push_subscriptions for insert to authenticated with check(user_id=(select auth.uid()) and hisaab_private.company_role(company_id) is not null);
create policy push_company_update on public.push_subscriptions for update to authenticated using(user_id=(select auth.uid()) and hisaab_private.company_role(company_id) is not null) with check(user_id=(select auth.uid()) and hisaab_private.company_role(company_id) is not null);
create policy push_company_delete on public.push_subscriptions for delete to authenticated using(user_id=(select auth.uid()));

alter table public.ai_rate_limits add company_id uuid not null references public.companies(id) on delete cascade;
drop function public.consume_ai_quota(uuid);
create function public.consume_ai_quota(account_id uuid,company uuid) returns boolean language plpgsql security invoker set search_path='' as $$
declare count_now integer;
begin
 if not exists(select 1 from public.company_memberships where user_id=account_id and company_id=company) then return false; end if;
 insert into public.ai_rate_limits(user_id,company_id,window_start,requests) values(account_id,company,now(),1) on conflict(user_id) do update set company_id=company,requests=case when public.ai_rate_limits.window_start<now()-interval '1 hour' then 1 else public.ai_rate_limits.requests+1 end,window_start=case when public.ai_rate_limits.window_start<now()-interval '1 hour' then now() else public.ai_rate_limits.window_start end returning requests into count_now;
 return count_now<=20;
end; $$;
revoke all on function public.consume_ai_quota(uuid,uuid) from public,anon,authenticated;
grant execute on function public.consume_ai_quota(uuid,uuid) to service_role;

create function hisaab_private.immutable_company_scope() returns trigger language plpgsql security invoker set search_path='' as $$ begin if new.company_id is distinct from old.company_id then raise exception 'Company scope cannot be reassigned'; end if; return new; end; $$;
revoke all on function hisaab_private.immutable_company_scope() from public,anon;
create trigger immutable_workspace_company before update on public.encrypted_workspaces for each row execute function hisaab_private.immutable_company_scope();
create trigger immutable_push_company before update on public.push_subscriptions for each row execute function hisaab_private.immutable_company_scope();
