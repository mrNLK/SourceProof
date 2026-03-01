-- Persist webset references per user (previously stored in localStorage)
create table if not exists public.webset_refs (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  query text not null,
  count integer not null default 10,
  status text not null default 'running',
  created_at timestamptz not null default now(),
  primary key (id, user_id)
);

-- RLS
alter table public.webset_refs enable row level security;

create policy "Users can manage their own webset refs"
  on public.webset_refs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
