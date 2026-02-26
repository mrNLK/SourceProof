-- SourceKit Database Schema

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Candidates table
create table if not exists candidates (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  company text not null default '',
  role text default '',
  title text,
  location text,
  bio text,
  avatar_url text,
  profile_url text,
  github_handle text,
  source text not null default 'web' check (source in ('linkedin', 'github', 'web', 'exa')),
  enrichment_data jsonb,
  github_profile jsonb,
  stage text not null default 'sourced' check (stage in ('sourced', 'contacted', 'responded', 'screen', 'offer')),
  score integer not null default 0 check (score >= 0 and score <= 100),
  notes text default '',
  tags text[] default '{}',
  signals jsonb default '[]',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

-- Search history table
create table if not exists search_history (
  id uuid primary key default uuid_generate_v4(),
  query_params jsonb not null,
  result_count integer not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Settings table (key-value)
create table if not exists settings (
  id uuid primary key default uuid_generate_v4(),
  key text not null,
  value text,
  user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz default now(),
  unique(key, user_id)
);

-- Indexes
create index if not exists idx_candidates_stage on candidates(stage);
create index if not exists idx_candidates_score on candidates(score desc);
create index if not exists idx_candidates_created_by on candidates(created_by);
create index if not exists idx_candidates_github_handle on candidates(github_handle);
create index if not exists idx_candidates_name_company on candidates(lower(name), lower(company));
create index if not exists idx_search_history_created_by on search_history(created_by);
create index if not exists idx_settings_user_key on settings(user_id, key);

-- RLS Policies
alter table candidates enable row level security;
alter table search_history enable row level security;
alter table settings enable row level security;

-- Candidates policies
create policy "Users can view their own candidates"
  on candidates for select
  using (auth.uid() = created_by);

create policy "Users can insert their own candidates"
  on candidates for insert
  with check (auth.uid() = created_by);

create policy "Users can update their own candidates"
  on candidates for update
  using (auth.uid() = created_by);

create policy "Users can delete their own candidates"
  on candidates for delete
  using (auth.uid() = created_by);

-- Search history policies
create policy "Users can view their own search history"
  on search_history for select
  using (auth.uid() = created_by);

create policy "Users can insert their own search history"
  on search_history for insert
  with check (auth.uid() = created_by);

create policy "Users can delete their own search history"
  on search_history for delete
  using (auth.uid() = created_by);

-- Settings policies
create policy "Users can view their own settings"
  on settings for select
  using (auth.uid() = user_id);

create policy "Users can manage their own settings"
  on settings for all
  using (auth.uid() = user_id);

-- Updated_at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger candidates_updated_at
  before update on candidates
  for each row execute function update_updated_at();

create trigger settings_updated_at
  before update on settings
  for each row execute function update_updated_at();
