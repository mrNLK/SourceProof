-- Create the user_subscriptions table for Stripe-based subscription gating.
-- This table was managed by Lovable and never had a migration file.

create table if not exists user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  plan text not null default 'trial',
  searches_used integer not null default 0,
  search_limit integer default 10,
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS: service role can do everything, authenticated users can read their own row
alter table user_subscriptions enable row level security;

create policy "Users can read own subscription"
  on user_subscriptions for select
  using (auth.uid() = user_id);

create policy "Service role full access"
  on user_subscriptions for all
  using (auth.role() = 'service_role');

-- Index for Stripe webhook lookups by customer ID
create index if not exists idx_user_subscriptions_stripe_customer
  on user_subscriptions(stripe_customer_id);

-- Auto-create subscription row when a new user signs up
create or replace function handle_new_user_subscription()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.user_subscriptions (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Trigger on auth.users insert
create trigger on_auth_user_created_subscription
  after insert on auth.users
  for each row
  execute function handle_new_user_subscription();
