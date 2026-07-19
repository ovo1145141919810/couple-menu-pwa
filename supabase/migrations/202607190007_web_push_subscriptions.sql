-- Private browser push subscriptions. Clients write only through owner-bound RPCs.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) between 20 and 2048),
  p256dh text not null check (char_length(p256dh) between 20 and 512),
  auth text not null check (char_length(auth) between 8 and 256),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions(user_id);

create trigger push_subscriptions_touch
before update on public.push_subscriptions
for each row execute function public.touch_updated_at();

alter table public.push_subscriptions enable row level security;
revoke all privileges on table public.push_subscriptions from anon, authenticated;

create or replace function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_subscription_id uuid;
begin
  if not public.is_couple_user() then raise exception 'Only configured couple accounts may subscribe'; end if;
  if p_endpoint !~ '^https://' or char_length(p_endpoint) not between 20 and 2048 then
    raise exception 'Invalid push endpoint';
  end if;
  if char_length(p_p256dh) not between 20 and 512 or char_length(p_auth) not between 8 and 256 then
    raise exception 'Invalid push encryption keys';
  end if;

  insert into public.push_subscriptions(user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth, updated_at = now()
  returning id into v_subscription_id;
  return v_subscription_id;
end;
$$;

create or replace function public.remove_push_subscription(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.push_subscriptions
    where endpoint = p_endpoint and user_id = auth.uid();
end;
$$;

revoke all on function public.save_push_subscription(text, text, text) from public, anon;
revoke all on function public.remove_push_subscription(text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;
grant execute on function public.remove_push_subscription(text) to authenticated;
