create or replace function public.handle_new_user_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.subscriptions (
    user_id,
    plan,
    status,
    trades_this_month,
    trades_month_reset,
    created_at,
    updated_at
  )
  values (
    new.id,
    'free',
    'active',
    0,
    timezone('utc', now()),
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_subscription on auth.users;

create trigger on_auth_user_created_subscription
  after insert on auth.users
  for each row
  execute function public.handle_new_user_subscription();
