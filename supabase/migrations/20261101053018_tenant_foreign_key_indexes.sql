create index ai_rate_limits_company_idx on public.ai_rate_limits(company_id);
create index companies_created_by_idx on public.companies(created_by);
create index encrypted_workspaces_updated_by_idx on public.encrypted_workspaces(updated_by);
