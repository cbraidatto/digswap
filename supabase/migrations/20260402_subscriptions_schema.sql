create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status varchar(50) not null default 'active',
  plan varchar(50) not null default 'free',
  current_period_start timestamptz,
  current_period_end timestamptz,
  trades_this_month integer not null default 0,
  trades_month_reset timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint subscriptions_plan_check
    check (plan in ('free', 'premium_monthly', 'premium_annual')),
  constraint subscriptions_trade_count_check
    check (trades_this_month >= 0)
);

alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_select_own on public.subscriptions;
drop policy if exists subscriptions_insert_service on public.subscriptions;
drop policy if exists subscriptions_update_service on public.subscriptions;

create policy subscriptions_select_own
  on public.subscriptions
  for select
  to authenticated
  using (user_id = auth.uid());

create policy subscriptions_insert_service
  on public.subscriptions
  for insert
  to service_role
  with check (true);

create policy subscriptions_update_service
  on public.subscriptions
  for update
  to service_role
  using (true)
  with check (true);
