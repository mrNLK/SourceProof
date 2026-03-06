-- AI Fund Internal Sourcing Tool: Database Schema
-- Creates tables for concepts, people, assignments, engagements, residencies, decisions, evidence, and intelligence runs

-- 1. Concepts (venture ideas from LPs, builders, or Andrew's team)
create table if not exists aifund_concepts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source text not null check (source in ('lp', 'builder', 'andrew_team')),
  lp_sponsor text,
  first_customer boolean not null default false,
  domain_expert text,
  brief text not null default '',
  problem_statement text not null default '',
  target_role text not null check (target_role in ('fir', 've', 'both')) default 'both',
  market_theme text not null default '',
  builder_validation text[] not null default '{}',
  stage text not null check (stage in ('stage_1', 'stage_2', 'stage_3', 'residency', 'decision', 'newco', 'archived')) default 'stage_1',
  confidentiality text not null check (confidentiality in ('standard', 'restricted', 'lp_confidential')) default 'standard',
  first_customer_notes text,
  decision_status text not null check (decision_status in ('pending', 'approved', 'declined')) default 'pending',
  owner text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. People (candidates: FIR and VE prospects)
create table if not exists aifund_people (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  headline text not null default '',
  location text not null default '',
  availability_note text not null default '',
  process_stage text not null check (process_stage in (
    'sourced', 'reviewed', 'outreach_pending', 'engaged', 'interview',
    'selected', 'in_residency', 'investment_review', 'approved', 'declined', 'archived'
  )) default 'sourced',
  providers text[] not null default '{}',
  archetypes text[] not null default '{}',
  top_signals text[] not null default '{}',
  summary text not null default '',
  role_fit text not null check (role_fit in ('fir', 've', 'both')) default 'both',
  current_company text,
  github_username text,
  linkedin_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Evaluation scores (one per person, weighted scoring rubric)
create table if not exists aifund_evaluation_scores (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references aifund_people(id) on delete cascade,
  ai_excellence numeric not null default 0 check (ai_excellence between 0 and 10),
  technical_ability numeric not null default 0 check (technical_ability between 0 and 10),
  product_instinct numeric not null default 0 check (product_instinct between 0 and 10),
  leadership_potential numeric not null default 0 check (leadership_potential between 0 and 10),
  override_delta numeric not null default 0,
  override_reason text,
  generated_summary text not null default '',
  generated_at timestamptz not null default now(),
  unique (person_id)
);

-- 4. External profiles (GitHub, LinkedIn, web, referral links per person)
create table if not exists aifund_external_profiles (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references aifund_people(id) on delete cascade,
  provider text not null check (provider in ('exa', 'parallel', 'github', 'internal', 'referral')),
  profile_type text not null check (profile_type in ('github', 'linkedin', 'web', 'referral')),
  handle text not null default '',
  url text not null default '',
  raw_payload jsonb
);

-- 5. Evidence artifacts (repos, papers, talks, products linked to a person)
create table if not exists aifund_evidence (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references aifund_people(id) on delete cascade,
  type text not null check (type in ('repo', 'paper', 'talk', 'startup', 'product', 'competition', 'reference', 'profile', 'internal_note')),
  title text not null default '',
  summary text not null default '',
  source_url text not null default '',
  provider text not null check (provider in ('exa', 'parallel', 'github', 'internal', 'referral')),
  verified boolean not null default false,
  citations jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- 6. Concept assignments (person matched to concept with fit rationale)
create table if not exists aifund_assignments (
  id uuid primary key default gen_random_uuid(),
  concept_id uuid not null references aifund_concepts(id) on delete cascade,
  person_id uuid not null references aifund_people(id) on delete cascade,
  role_intent text not null check (role_intent in ('fir', 've')),
  fit_rationale text not null default '',
  owner text not null default '',
  priority text not null check (priority in ('high', 'medium', 'low')) default 'medium',
  confidence text not null check (confidence in ('high', 'medium', 'low')) default 'medium',
  status text not null check (status in ('to_review', 'priority', 'engaged', 'in_residency', 'closed')) default 'to_review',
  created_at timestamptz not null default now()
);

-- 7. Engagements (outreach, meetings, notes per person-concept pair)
create table if not exists aifund_engagements (
  id uuid primary key default gen_random_uuid(),
  concept_id uuid not null references aifund_concepts(id) on delete cascade,
  person_id uuid not null references aifund_people(id) on delete cascade,
  kind text not null check (kind in ('email', 'warm_intro', 'meeting', 'note')),
  subject text not null default '',
  status text not null check (status in ('draft', 'sent', 'waiting', 'replied', 'scheduled', 'closed')) default 'draft',
  owner text not null default '',
  counterparty text,
  next_step text not null default '',
  due_at timestamptz,
  last_touch_at timestamptz not null default now(),
  notes text not null default ''
);

-- 8. Residencies (active 12-week residency tracking)
create table if not exists aifund_residencies (
  id uuid primary key default gen_random_uuid(),
  concept_id uuid not null references aifund_concepts(id) on delete cascade,
  person_id uuid not null references aifund_people(id) on delete cascade,
  role_intent text not null check (role_intent in ('fir', 've')),
  start_date date not null,
  end_date date not null,
  stipend_monthly_usd numeric not null default 10000,
  builder_partners text[] not null default '{}',
  domain_partners text[] not null default '{}',
  status text not null check (status in ('planned', 'active', 'review', 'complete')) default 'planned',
  weekly_updates jsonb not null default '[]'
);

-- 9. Decision memos (investment recommendation per person-concept)
create table if not exists aifund_decision_memos (
  id uuid primary key default gen_random_uuid(),
  concept_id uuid not null references aifund_concepts(id) on delete cascade,
  person_id uuid not null references aifund_people(id) on delete cascade,
  recommendation text not null check (recommendation in ('pending', 'approved', 'declined')) default 'pending',
  summary text not null default '',
  key_risks text[] not null default '{}',
  catalysts text[] not null default '{}',
  author text not null default '',
  created_at timestamptz not null default now()
);

-- 10. Activity events (audit log)
create table if not exists aifund_activity_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('concept', 'person', 'assignment', 'engagement', 'residency', 'decision')),
  entity_id uuid not null,
  action text not null default '',
  actor text not null default '',
  created_at timestamptz not null default now(),
  metadata jsonb
);

-- 11. Intelligence runs (Exa/Parallel/GitHub pipeline execution log)
create table if not exists aifund_intelligence_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('exa', 'parallel', 'github', 'internal', 'referral')),
  action text not null check (action in ('research', 'discovery', 'monitor', 'mapping', 'status_check')),
  status text not null check (status in ('ready', 'running', 'needs_keys', 'error')) default 'ready',
  summary text not null default '',
  created_at timestamptz not null default now()
);

-- Indexes for common queries
create index if not exists idx_aifund_concepts_stage on aifund_concepts(stage);
create index if not exists idx_aifund_people_process_stage on aifund_people(process_stage);
create index if not exists idx_aifund_assignments_concept on aifund_assignments(concept_id);
create index if not exists idx_aifund_assignments_person on aifund_assignments(person_id);
create index if not exists idx_aifund_engagements_person on aifund_engagements(person_id);
create index if not exists idx_aifund_engagements_concept on aifund_engagements(concept_id);
create index if not exists idx_aifund_residencies_status on aifund_residencies(status);
create index if not exists idx_aifund_evidence_person on aifund_evidence(person_id);
create index if not exists idx_aifund_activity_entity on aifund_activity_events(entity_type, entity_id);

-- Auto-update updated_at on concepts and people
create or replace function aifund_update_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_aifund_concepts_updated on aifund_concepts;
create trigger trg_aifund_concepts_updated
  before update on aifund_concepts
  for each row execute function aifund_update_timestamp();

drop trigger if exists trg_aifund_people_updated on aifund_people;
create trigger trg_aifund_people_updated
  before update on aifund_people
  for each row execute function aifund_update_timestamp();

-- Enable RLS on all tables
alter table aifund_concepts enable row level security;
alter table aifund_people enable row level security;
alter table aifund_evaluation_scores enable row level security;
alter table aifund_external_profiles enable row level security;
alter table aifund_evidence enable row level security;
alter table aifund_assignments enable row level security;
alter table aifund_engagements enable row level security;
alter table aifund_residencies enable row level security;
alter table aifund_decision_memos enable row level security;
alter table aifund_activity_events enable row level security;
alter table aifund_intelligence_runs enable row level security;

-- RLS policies: authenticated users can read/write all rows
-- (In production, scope to team membership)
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'aifund_concepts', 'aifund_people', 'aifund_evaluation_scores',
    'aifund_external_profiles', 'aifund_evidence', 'aifund_assignments',
    'aifund_engagements', 'aifund_residencies', 'aifund_decision_memos',
    'aifund_activity_events', 'aifund_intelligence_runs'
  ] loop
    execute format('
      drop policy if exists %I on %I;
      create policy %I on %I
        for all to authenticated using (true) with check (true);
    ', tbl || '_auth_all', tbl, tbl || '_auth_all', tbl);
  end loop;
end $$;
