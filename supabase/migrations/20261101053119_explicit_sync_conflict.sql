create or replace function public.save_encrypted_workspace(company uuid,payload jsonb,expected_revision bigint) returns bigint language plpgsql security invoker set search_path='' as $$
declare next_revision bigint;
begin
 if auth.uid() is null or hisaab_private.company_role(company) not in('owner','editor') or hisaab_private.company_role(company) is null then raise exception 'Company editor access required'; end if;
 if expected_revision<0 then raise exception 'Invalid revision'; end if;
 if expected_revision=0 then
  insert into public.encrypted_workspaces(company_id,updated_by,envelope,revision) values(company,auth.uid(),payload,1) on conflict(company_id) do nothing returning revision into next_revision;
 else
  update public.encrypted_workspaces set envelope=payload,revision=revision+1,updated_by=auth.uid(),updated_at=now() where company_id=company and revision=expected_revision returning revision into next_revision;
 end if;
 if next_revision is null then raise exception using errcode='PT409',message='Cloud workspace changed. Download and review before syncing.'; end if;return next_revision;
end; $$;
