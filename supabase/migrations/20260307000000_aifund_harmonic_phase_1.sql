-- Harmonic Phase 1: Add Harmonic enrichment columns, company cache, and saved-search state

-- 1. Add Harmonic columns to aifund_people
alter table aifund_people
  add column if not exists harmonic_person_id text,
  add column if not exists harmonic_enriched_at timestamptz;

create index if not exists idx_aifund_people_harmonic_person
  on aifund_people(harmonic_person_id)
  where harmonic_person_id is not null;

-- 2. Harmonic company cache table
create table if not exists aifund_harmonic_companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  harmonic_company_id text not null,
  name text not null,
  domain text,
  linkedin_url text,
  website_url text,
  location text,
  funding_stage text,
  funding_total numeric,
  last_funding_date timestamptz,
  last_funding_total numeric,
  headcount integer,
  headcount_growth_30d numeric,
  headcount_growth_90d numeric,
  tags text[] not null default '{}',
  founders jsonb not null default '[]'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_aifund_harmonic_companies_hid
  on aifund_harmonic_companies(user_id, harmonic_company_id);

-- 3. Harmonic saved-search state table
create table if not exists aifund_harmonic_saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  concept_id uuid not null references aifund_concepts(id) on delete cascade,
  harmonic_saved_search_id text,
  query_text text not null,
  query_hash text not null,
  status text not null default 'draft',
  last_synced_at timestamptz,
  last_run_id uuid references aifund_intelligence_runs(id) on delete set null,
  result_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_aifund_harmonic_ss_concept
  on aifund_harmonic_saved_searches(user_id, concept_id, harmonic_saved_search_id)
  where harmonic_saved_search_id is not null;

create unique index if not exists idx_aifund_harmonic_ss_query
  on aifund_harmonic_saved_searches(user_id, concept_id, query_hash)
  where harmonic_saved_search_id is null;

-- 4. Add unique constraint on aifund_external_profiles for upsert support
create unique index if not exists idx_aifund_external_profiles_person_provider_url
  on aifund_external_profiles(person_id, provider, url);

-- 5. Add 'harmonic' to aifund_intelligence_runs provider check and expand status/action constraints
-- Drop old constraints and re-create with expanded values
alter table aifund_intelligence_runs
  drop constraint if exists aifund_intelligence_runs_provider_check;
alter table aifund_intelligence_runs
  add constraint aifund_intelligence_runs_provider_check
  check (provider in ('exa', 'parallel', 'github', 'internal', 'referral', 'harmonic'));

alter table aifund_intelligence_runs
  drop constraint if exists aifund_intelligence_runs_status_check;
alter table aifund_intelligence_runs
  add constraint aifund_intelligence_runs_status_check
  check (status in ('ready', 'running', 'needs_keys', 'error', 'pending', 'completed', 'failed'));

alter table aifund_intelligence_runs
  drop constraint if exists aifund_intelligence_runs_action_check;
alter table aifund_intelligence_runs
  add constraint aifund_intelligence_runs_action_check
  check (action in ('research', 'discovery', 'monitor', 'mapping', 'status_check', 'harmonic_search'));

-- Add missing columns to aifund_intelligence_runs for Harmonic
alter table aifund_intelligence_runs
  add column if not exists user_id uuid,
  add column if not exists query_params jsonb not null default '{}'::jsonb,
  add column if not exists results_count integer not null default 0,
  add column if not exists results_summary jsonb,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz;

-- 6. Add 'harmonic' to aifund_external_profiles provider check
alter table aifund_external_profiles
  drop constraint if exists aifund_external_profiles_provider_check;
alter table aifund_external_profiles
  add constraint aifund_external_profiles_provider_check
  check (provider in ('exa', 'parallel', 'github', 'internal', 'referral', 'harmonic'));

-- 7. RLS on new tables
alter table aifund_harmonic_companies enable row level security;
alter table aifund_harmonic_saved_searches enable row level security;

-- Harmonic companies: authenticated users read own rows, service-role writes
drop policy if exists aifund_harmonic_companies_auth_read on aifund_harmonic_companies;
create policy aifund_harmonic_companies_auth_read on aifund_harmonic_companies
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists aifund_harmonic_companies_service_write on aifund_harmonic_companies;
create policy aifund_harmonic_companies_service_write on aifund_harmonic_companies
  for all to service_role
  using (true) with check (true);

-- Harmonic saved searches: user_id scoped read/write
drop policy if exists aifund_harmonic_saved_searches_auth_all on aifund_harmonic_saved_searches;
create policy aifund_harmonic_saved_searches_auth_all on aifund_harmonic_saved_searches
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists aifund_harmonic_saved_searches_service on aifund_harmonic_saved_searches;
create policy aifund_harmonic_saved_searches_service on aifund_harmonic_saved_searches
  for all to service_role
  using (true) with check (true);

-- 8. Auto-update timestamps
create trigger trg_aifund_harmonic_companies_updated
  before update on aifund_harmonic_companies
  for each row execute function aifund_update_timestamp();

create trigger trg_aifund_harmonic_saved_searches_updated
  before update on aifund_harmonic_saved_searches
  for each row execute function aifund_update_timestamp();
