create schema if not exists hisaab_private;
revoke all on schema hisaab_private from public,anon,authenticated;
grant usage on schema hisaab_private to service_role;
create table hisaab_private.push_config(singleton boolean primary key default true check(singleton),public_key text not null,private_key text not null,dispatch_token text not null);
alter table hisaab_private.push_config enable row level security;
revoke all on hisaab_private.push_config from public,anon,authenticated;
grant select on hisaab_private.push_config to service_role;
create policy push_config_service_read on hisaab_private.push_config for select to service_role using(true);
create function public.get_push_config() returns jsonb language sql stable security invoker set search_path='' as $$ select to_jsonb(c)-'singleton' from hisaab_private.push_config c where singleton=true $$;
revoke all on function public.get_push_config() from public,anon,authenticated;
grant execute on function public.get_push_config() to service_role;
grant select,update,delete on public.push_subscriptions to service_role;
create policy ai_server_only on public.ai_rate_limits for all to service_role using(true) with check(true);
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select cron.schedule('hisaab-reminder-check-in','0 4 * * *',$cron$
 select net.http_post(url:='https://smdyzfqhborabxqslkye.supabase.co/functions/v1/send-reminders',headers:=jsonb_build_object('Content-Type','application/json','X-Hisaab-Dispatch',(select dispatch_token from hisaab_private.push_config where singleton=true)),body:='{}'::jsonb);
$cron$);
