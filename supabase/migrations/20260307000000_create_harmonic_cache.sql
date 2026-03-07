-- Cache for Harmonic API responses (company + person enrichment data).
-- Avoids redundant API calls; data is re-fetched after CACHE_TTL_DAYS (7 days).

create table if not exists public.harmonic_cache (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,           -- 'company' or 'person'
  lookup_key text not null,            -- domain, linkedin URL, or other identifier used to fetch
  entity_urn text,                     -- harmonic URN (e.g. urn:harmonic:company:123456)
  data jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint harmonic_cache_unique unique (entity_type, lookup_key)
);

-- Index for fast lookups
create index if not exists idx_harmonic_cache_lookup
  on public.harmonic_cache (entity_type, lookup_key);

-- RLS: service role only (edge functions use service role key)
alter table public.harmonic_cache enable row level security;

-- Allow service role full access (edge functions)
create policy "Service role full access on harmonic_cache"
  on public.harmonic_cache
  for all
  using (true)
  with check (true);
