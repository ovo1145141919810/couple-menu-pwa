-- Let a signed-in device verify whether its local browser subscription is still
-- registered on the server. No endpoint, key, user id, or other private row data
-- is returned. If the push sender removed a rejected endpoint after a 404/410,
-- the device can safely rotate it the next time the app opens.

create or replace function public.is_push_subscription_registered(p_endpoint text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_couple_user() then
    raise exception 'Only configured couple accounts may inspect subscriptions';
  end if;

  return exists (
    select 1
    from public.push_subscriptions
    where endpoint = p_endpoint
      and user_id = auth.uid()
  );
end;
$$;

revoke all on function public.is_push_subscription_registered(text) from public, anon;
grant execute on function public.is_push_subscription_registered(text) to authenticated;
