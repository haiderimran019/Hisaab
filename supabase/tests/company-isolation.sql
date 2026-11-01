-- Run inside a transaction on the new hosted project. All synthetic fixtures roll back.
begin;
insert into auth.users(id,aud,role,email) values
('11111111-1111-4111-8111-111111111111','authenticated','authenticated','owner-a@example.invalid'),
('22222222-2222-4222-8222-222222222222','authenticated','authenticated','owner-b@example.invalid'),
('33333333-3333-4333-8333-333333333333','authenticated','authenticated','viewer@example.invalid'),
('44444444-4444-4444-8444-444444444444','authenticated','authenticated','editor@example.invalid');
insert into public.companies(id,name,created_by) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic company A','11111111-1111-4111-8111-111111111111'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Synthetic company B','22222222-2222-4222-8222-222222222222');
insert into public.company_memberships(company_id,user_id,role) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','owner'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','owner'),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333','viewer'),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','44444444-4444-4444-8444-444444444444','editor');
-- Structurally encrypted, synthetic transport fixture; no real customer content.
select set_config('hisaab.test_envelope','{"format":"hisaab-aesgcm-v2","iv":"AAAAAAAAAAAAAAAA","ciphertext":"AAAAAAAAAAAAAAAAAAAAAA==","unlockers":[{"kind":"passphrase","salt":"AAAAAAAAAAAAAAAAAAAAAAAA","iterations":600000,"iv":"AAAAAAAAAAAAAAAA","wrapped":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}]}',true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $$ begin
 if (select count(*) from public.companies)<>1 then raise exception 'Cross-company metadata leak'; end if;
 if public.save_encrypted_workspace('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',current_setting('hisaab.test_envelope')::jsonb,0)<>1 then raise exception 'Owner create failed'; end if;
 begin perform public.save_encrypted_workspace('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',current_setting('hisaab.test_envelope')::jsonb,0);raise exception 'Unexpected cross-company write';exception when raise_exception then if sqlerrm<>'Company editor access required' then raise;end if;end;
 begin insert into public.company_memberships(company_id,user_id,role) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',auth.uid(),'owner');raise exception 'Self escalation accepted';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","user_metadata":{"company_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"owner"}}',true);
do $$ begin if (select count(*) from public.encrypted_workspaces)<>0 then raise exception 'Cross-company ciphertext leak';end if; end $$;
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}',true);
do $$ begin if public.save_encrypted_workspace('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',current_setting('hisaab.test_envelope')::jsonb,1)<>2 then raise exception 'Editor update failed'; end if;end $$;
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',true);
do $$ begin
 if (select count(*) from public.encrypted_workspaces)<>1 then raise exception 'Viewer read failed';end if;
 begin perform public.save_encrypted_workspace('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',current_setting('hisaab.test_envelope')::jsonb,2);raise exception 'Viewer write accepted';exception when raise_exception then if sqlerrm<>'Company editor access required' then raise;end if;end;
 begin perform public.get_push_config();raise exception 'Push secrets exposed';exception when insufficient_privilege then null;end;
 begin perform public.consume_ai_quota(auth.uid(),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');raise exception 'Quota bypass accepted';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $$ begin
 begin perform public.save_encrypted_workspace('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',current_setting('hisaab.test_envelope')::jsonb,1);raise exception 'Stale overwrite accepted';exception when sqlstate 'PT409' then null;end;
end $$;
reset role;
insert into public.company_memberships(company_id,user_id,role) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','editor');
set local role authenticated;
do $$ begin
 begin update public.encrypted_workspaces set company_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' where company_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';raise exception 'Company reassignment accepted';exception when raise_exception then if sqlerrm<>'Company scope cannot be reassigned' then raise;end if;end;
end $$;
reset role;
delete from public.company_memberships where company_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and user_id='11111111-1111-4111-8111-111111111111';
set local role authenticated;
do $$ begin if exists(select 1 from public.encrypted_workspaces where company_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') then raise exception 'Revoked membership still reads company';end if;end $$;
reset role;
rollback;
select 'PASS: owner/editor/viewer access, cross-company isolation, immutable scope, private secrets, quota authorization and revision conflicts' as result;
