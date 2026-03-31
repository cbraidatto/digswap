-- Phase 17 Plan 03: Desktop runtime authority, heartbeat, and receipt reconciliation
-- Implements ADR-002 D-06 and the 17-03 runtime authority layer

create table if not exists public.trade_runtime_sessions (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trade_requests(id) on delete cascade,
  user_id uuid not null,
  device_id text not null,
  client_kind text not null default 'desktop',
  desktop_version integer not null default 1,
  trade_protocol_version integer not null default 1,
  last_ice_candidate_type varchar(16),
  acquired_at timestamptz not null default timezone('utc', now()),
  heartbeat_at timestamptz not null default timezone('utc', now()),
  released_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint trade_runtime_sessions_ice_type_check
    check (last_ice_candidate_type is null or last_ice_candidate_type in ('host', 'srflx', 'relay'))
);

create unique index if not exists trade_runtime_sessions_active_user_idx
  on public.trade_runtime_sessions (trade_id, user_id)
  where released_at is null;

create table if not exists public.trade_transfer_receipts (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trade_requests(id) on delete cascade,
  user_id uuid not null,
  device_id text not null,
  file_name varchar(255) not null,
  file_size_bytes integer not null,
  file_hash_sha256 varchar(64) not null,
  ice_candidate_type varchar(16) not null,
  trade_protocol_version integer not null default 1,
  completed_at timestamptz not null,
  reconciled_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint trade_transfer_receipts_ice_type_check
    check (ice_candidate_type in ('host', 'srflx', 'relay'))
);

create unique index if not exists trade_transfer_receipts_idempotency_idx
  on public.trade_transfer_receipts (trade_id, user_id, device_id, file_hash_sha256);

alter table public.trade_runtime_sessions enable row level security;
alter table public.trade_transfer_receipts enable row level security;

drop policy if exists trade_runtime_sessions_no_direct_select on public.trade_runtime_sessions;
drop policy if exists trade_runtime_sessions_no_direct_insert on public.trade_runtime_sessions;
drop policy if exists trade_runtime_sessions_no_direct_update on public.trade_runtime_sessions;
drop policy if exists trade_runtime_sessions_no_direct_delete on public.trade_runtime_sessions;

create policy trade_runtime_sessions_no_direct_select
  on public.trade_runtime_sessions
  for select
  to authenticated
  using (false);

create policy trade_runtime_sessions_no_direct_insert
  on public.trade_runtime_sessions
  for insert
  to authenticated
  with check (false);

create policy trade_runtime_sessions_no_direct_update
  on public.trade_runtime_sessions
  for update
  to authenticated
  using (false)
  with check (false);

create policy trade_runtime_sessions_no_direct_delete
  on public.trade_runtime_sessions
  for delete
  to authenticated
  using (false);

drop policy if exists trade_transfer_receipts_no_direct_select on public.trade_transfer_receipts;
drop policy if exists trade_transfer_receipts_no_direct_insert on public.trade_transfer_receipts;
drop policy if exists trade_transfer_receipts_no_direct_update on public.trade_transfer_receipts;
drop policy if exists trade_transfer_receipts_no_direct_delete on public.trade_transfer_receipts;

create policy trade_transfer_receipts_no_direct_select
  on public.trade_transfer_receipts
  for select
  to authenticated
  using (false);

create policy trade_transfer_receipts_no_direct_insert
  on public.trade_transfer_receipts
  for insert
  to authenticated
  with check (false);

create policy trade_transfer_receipts_no_direct_update
  on public.trade_transfer_receipts
  for update
  to authenticated
  using (false)
  with check (false);

create policy trade_transfer_receipts_no_direct_delete
  on public.trade_transfer_receipts
  for delete
  to authenticated
  using (false);

create or replace function public.list_desktop_pending_trades()
returns table (
  trade_id uuid,
  counterparty_username varchar,
  counterparty_avatar_url text,
  status varchar,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    tr.id as trade_id,
    coalesce(counterparty.username, 'unknown') as counterparty_username,
    counterparty.avatar_url as counterparty_avatar_url,
    tr.status,
    tr.updated_at
  from public.trade_requests tr
  left join public.profiles counterparty
    on counterparty.id = case
      when tr.requester_id = auth.uid() then tr.provider_id
      else tr.requester_id
    end
  where auth.uid() is not null
    and (tr.requester_id = auth.uid() or tr.provider_id = auth.uid())
    and tr.status in (
      'pending',
      'lobby',
      'previewing',
      'accepted',
      'transferring',
      'completed',
      'declined',
      'cancelled',
      'expired'
    )
  order by tr.updated_at desc;
$$;

create or replace function public.acquire_trade_lease(
  p_trade_id uuid,
  p_device_id text,
  p_client_kind text default 'desktop',
  p_desktop_version integer default 1,
  p_trade_protocol_version integer default 1
)
returns table (
  id uuid,
  trade_id uuid,
  user_id uuid,
  device_id text,
  client_kind text,
  desktop_version integer,
  trade_protocol_version integer,
  last_ice_candidate_type varchar,
  acquired_at timestamptz,
  heartbeat_at timestamptz,
  released_at timestamptz,
  lease_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_user_id uuid := auth.uid();
  v_existing public.trade_runtime_sessions%rowtype;
  v_session public.trade_runtime_sessions%rowtype;
begin
  if v_user_id is null then
    raise exception using message = 'not_authenticated';
  end if;

  if p_device_id is null or length(trim(p_device_id)) = 0 then
    raise exception using message = 'device_id_required';
  end if;

  if not exists (
    select 1
    from public.trade_requests tr
    where tr.id = p_trade_id
      and (tr.requester_id = v_user_id or tr.provider_id = v_user_id)
  ) then
    raise exception using message = 'trade_not_found_or_forbidden';
  end if;

  select *
  into v_existing
  from public.trade_runtime_sessions trs
  where trs.trade_id = p_trade_id
    and trs.user_id = v_user_id
    and trs.released_at is null
  for update;

  if found then
    if v_existing.device_id = p_device_id then
      update public.trade_runtime_sessions
      set
        client_kind = p_client_kind,
        desktop_version = p_desktop_version,
        trade_protocol_version = p_trade_protocol_version,
        heartbeat_at = v_now,
        updated_at = v_now
      where public.trade_runtime_sessions.id = v_existing.id
      returning * into v_session;

      update public.trade_requests
      set
        last_joined_lobby_at = v_now,
        updated_at = v_now
      where public.trade_requests.id = p_trade_id;

      return query
      select
        v_session.id,
        v_session.trade_id,
        v_session.user_id,
        v_session.device_id,
        v_session.client_kind,
        v_session.desktop_version,
        v_session.trade_protocol_version,
        v_session.last_ice_candidate_type,
        v_session.acquired_at,
        v_session.heartbeat_at,
        v_session.released_at,
        v_session.heartbeat_at + interval '45 seconds';
      return;
    end if;

    if v_existing.heartbeat_at >= v_now - interval '45 seconds' then
      raise exception using
        message = 'lease_conflict',
        detail = 'Another device currently holds this trade lease.';
    end if;

    update public.trade_runtime_sessions
    set
      released_at = v_now,
      updated_at = v_now
    where public.trade_runtime_sessions.id = v_existing.id;
  end if;

  insert into public.trade_runtime_sessions (
    trade_id,
    user_id,
    device_id,
    client_kind,
    desktop_version,
    trade_protocol_version,
    acquired_at,
    heartbeat_at,
    created_at,
    updated_at
  )
  values (
    p_trade_id,
    v_user_id,
    p_device_id,
    p_client_kind,
    p_desktop_version,
    p_trade_protocol_version,
    v_now,
    v_now,
    v_now,
    v_now
  )
  returning * into v_session;

  update public.trade_requests
  set
    last_joined_lobby_at = v_now,
    updated_at = v_now
  where public.trade_requests.id = p_trade_id;

  return query
  select
    v_session.id,
    v_session.trade_id,
    v_session.user_id,
    v_session.device_id,
    v_session.client_kind,
    v_session.desktop_version,
    v_session.trade_protocol_version,
    v_session.last_ice_candidate_type,
    v_session.acquired_at,
    v_session.heartbeat_at,
    v_session.released_at,
    v_session.heartbeat_at + interval '45 seconds';
end;
$$;

create or replace function public.heartbeat_trade_lease(
  p_trade_id uuid,
  p_device_id text,
  p_desktop_version integer default 1,
  p_trade_protocol_version integer default 1,
  p_last_ice_candidate_type text default null
)
returns table (
  id uuid,
  trade_id uuid,
  user_id uuid,
  device_id text,
  client_kind text,
  desktop_version integer,
  trade_protocol_version integer,
  last_ice_candidate_type varchar,
  acquired_at timestamptz,
  heartbeat_at timestamptz,
  released_at timestamptz,
  lease_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_user_id uuid := auth.uid();
  v_session public.trade_runtime_sessions%rowtype;
begin
  if v_user_id is null then
    raise exception using message = 'not_authenticated';
  end if;

  update public.trade_runtime_sessions
  set
    heartbeat_at = v_now,
    desktop_version = p_desktop_version,
    trade_protocol_version = p_trade_protocol_version,
    last_ice_candidate_type = coalesce(p_last_ice_candidate_type, last_ice_candidate_type),
    updated_at = v_now
  where trade_id = p_trade_id
    and user_id = v_user_id
    and device_id = p_device_id
    and released_at is null
  returning * into v_session;

  if not found then
    raise exception using message = 'lease_not_found';
  end if;

  return query
  select
    v_session.id,
    v_session.trade_id,
    v_session.user_id,
    v_session.device_id,
    v_session.client_kind,
    v_session.desktop_version,
    v_session.trade_protocol_version,
    v_session.last_ice_candidate_type,
    v_session.acquired_at,
    v_session.heartbeat_at,
    v_session.released_at,
    v_session.heartbeat_at + interval '45 seconds';
end;
$$;

create or replace function public.release_trade_lease(
  p_trade_id uuid,
  p_device_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using message = 'not_authenticated';
  end if;

  update public.trade_runtime_sessions
  set
    released_at = v_now,
    updated_at = v_now
  where trade_id = p_trade_id
    and user_id = v_user_id
    and device_id = p_device_id
    and released_at is null;

  return found;
end;
$$;

create or replace function public.finalize_trade_transfer(
  p_trade_id uuid,
  p_device_id text,
  p_file_name text,
  p_file_size_bytes integer,
  p_file_hash_sha256 text,
  p_completed_at timestamptz,
  p_ice_candidate_type text,
  p_trade_protocol_version integer default 1
)
returns table (
  receipt_id uuid,
  trade_status varchar,
  reconciled_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_user_id uuid := auth.uid();
  v_receipt_id uuid;
  v_trade_status varchar;
begin
  if v_user_id is null then
    raise exception using message = 'not_authenticated';
  end if;

  if not exists (
    select 1
    from public.trade_requests tr
    where tr.id = p_trade_id
      and (tr.requester_id = v_user_id or tr.provider_id = v_user_id)
  ) then
    raise exception using message = 'trade_not_found_or_forbidden';
  end if;

  insert into public.trade_transfer_receipts (
    trade_id,
    user_id,
    device_id,
    file_name,
    file_size_bytes,
    file_hash_sha256,
    ice_candidate_type,
    trade_protocol_version,
    completed_at,
    reconciled_at,
    created_at,
    updated_at
  )
  values (
    p_trade_id,
    v_user_id,
    p_device_id,
    p_file_name,
    p_file_size_bytes,
    p_file_hash_sha256,
    p_ice_candidate_type,
    p_trade_protocol_version,
    p_completed_at,
    v_now,
    v_now,
    v_now
  )
  on conflict (trade_id, user_id, device_id, file_hash_sha256)
  do update
    set
      file_name = excluded.file_name,
      file_size_bytes = excluded.file_size_bytes,
      ice_candidate_type = excluded.ice_candidate_type,
      trade_protocol_version = excluded.trade_protocol_version,
      completed_at = excluded.completed_at,
      reconciled_at = v_now,
      updated_at = v_now
  returning public.trade_transfer_receipts.id into v_receipt_id;

  update public.trade_runtime_sessions
  set
    last_ice_candidate_type = p_ice_candidate_type,
    updated_at = v_now
  where trade_id = p_trade_id
    and user_id = v_user_id
    and device_id = p_device_id
    and released_at is null;

  update public.trade_requests
  set
    status = 'completed',
    updated_at = v_now
  where id = p_trade_id
    and status <> 'completed';

  select public.trade_requests.status
  into v_trade_status
  from public.trade_requests
  where public.trade_requests.id = p_trade_id;

  return query
  select v_receipt_id, v_trade_status, v_now;
end;
$$;

revoke all on function public.list_desktop_pending_trades() from public;
grant execute on function public.list_desktop_pending_trades() to authenticated;

revoke all on function public.acquire_trade_lease(uuid, text, text, integer, integer) from public;
grant execute on function public.acquire_trade_lease(uuid, text, text, integer, integer) to authenticated;

revoke all on function public.heartbeat_trade_lease(uuid, text, integer, integer, text) from public;
grant execute on function public.heartbeat_trade_lease(uuid, text, integer, integer, text) to authenticated;

revoke all on function public.release_trade_lease(uuid, text) from public;
grant execute on function public.release_trade_lease(uuid, text) to authenticated;

revoke all on function public.finalize_trade_transfer(uuid, text, text, integer, text, timestamptz, text, integer) from public;
grant execute on function public.finalize_trade_transfer(uuid, text, text, integer, text, timestamptz, text, integer) to authenticated;
