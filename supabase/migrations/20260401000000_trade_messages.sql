-- Phase 15 Plan 01: trade-scoped messaging data layer
-- Adds trade_messages plus per-participant read state embedded on trade_requests

create table if not exists public.trade_messages (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trade_requests(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  kind varchar(16) not null default 'user',
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint trade_messages_kind_check check (kind in ('user', 'system')),
  constraint trade_messages_body_length_check check (char_length(body) between 1 and 2000)
);

create index if not exists trade_messages_trade_id_created_at_idx
  on public.trade_messages (trade_id, created_at desc);

create index if not exists trade_messages_sender_trade_created_at_idx
  on public.trade_messages (sender_id, trade_id, created_at desc);

alter table public.trade_requests
  add column if not exists requester_last_read_at timestamptz,
  add column if not exists provider_last_read_at timestamptz;

alter table public.trade_messages enable row level security;

drop policy if exists trade_messages_select_participants on public.trade_messages;
drop policy if exists trade_messages_insert_participants on public.trade_messages;

create policy trade_messages_select_participants
  on public.trade_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.trade_requests tr
      where tr.id = trade_id
        and (tr.requester_id = auth.uid() or tr.provider_id = auth.uid())
    )
  );

create policy trade_messages_insert_participants
  on public.trade_messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and kind = 'user'
    and exists (
      select 1
      from public.trade_requests tr
      where tr.id = trade_id
        and (tr.requester_id = auth.uid() or tr.provider_id = auth.uid())
    )
  );
