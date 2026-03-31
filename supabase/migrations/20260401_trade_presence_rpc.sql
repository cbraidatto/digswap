-- Phase 15 Plan 03: read-only trade presence for web surfaces
-- Presence is derived from desktop heartbeat rows in trade_runtime_sessions.

create or replace function public.get_trade_presence(p_trade_id uuid)
returns table (
  user_id uuid,
  last_heartbeat_at timestamptz,
  is_active boolean
)
language sql
security definer
set search_path = public
as $$
  with trade_participants as (
    select
      tr.requester_id,
      tr.provider_id
    from public.trade_requests tr
    where tr.id = p_trade_id
      and auth.uid() is not null
      and (tr.requester_id = auth.uid() or tr.provider_id = auth.uid())
  ),
  participants as (
    select requester_id as user_id from trade_participants
    union all
    select provider_id as user_id from trade_participants
  ),
  session_rollup as (
    select
      trs.user_id,
      max(trs.heartbeat_at) as last_heartbeat_at,
      bool_or(
        trs.released_at is null
        and trs.heartbeat_at > (timezone('utc', now()) - interval '2 minutes')
      ) as is_active
    from public.trade_runtime_sessions trs
    where trs.trade_id = p_trade_id
    group by trs.user_id
  )
  select
    participants.user_id,
    session_rollup.last_heartbeat_at,
    coalesce(session_rollup.is_active, false) as is_active
  from participants
  left join session_rollup
    on session_rollup.user_id = participants.user_id;
$$;

revoke all on function public.get_trade_presence(uuid) from public;
grant execute on function public.get_trade_presence(uuid) to authenticated;
