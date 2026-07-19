-- Let the receiver answer a fulfilled interaction with text or a reciprocal interaction.
-- Reciprocal interactions are normal pending wishlist items, linked back to the fulfilled item.

alter table public.wishlist_items
  add column reply_to_item_id uuid references public.wishlist_items(id) on delete restrict;

alter table public.wishlist_items
  add constraint interaction_replies_only
  check (reply_to_item_id is null or kind = 'interaction');

create unique index one_interaction_reply_per_item_idx
  on public.wishlist_items(reply_to_item_id)
  where reply_to_item_id is not null;

create or replace function public.respond_to_interaction(
  p_item_id uuid,
  p_response_text text default null,
  p_reply_interaction_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item record;
  v_interaction public.interaction_options%rowtype;
  v_response_text text := nullif(btrim(p_response_text), '');
  v_wishlist_id uuid;
  v_reply_item_id uuid;
begin
  select wi.*, w.sender_id as actual_sender_id, w.receiver_id as actual_receiver_id
    into v_item
    from public.wishlist_items wi
    join public.wishlists w on w.id = wi.wishlist_id
    where wi.id = p_item_id
    for update of wi;

  if not found then raise exception 'Wish item not found'; end if;
  if v_item.actual_receiver_id <> auth.uid() then raise exception 'Only the receiver may respond'; end if;
  if v_item.kind <> 'interaction' or v_item.status <> 'fulfilled' then
    raise exception 'Only a fulfilled interaction may receive a reply';
  end if;
  if (v_response_text is null) = (p_reply_interaction_id is null) then
    raise exception 'Choose exactly one reply type';
  end if;
  if v_response_text is not null and char_length(v_response_text) > 120 then
    raise exception 'Response is too long';
  end if;
  if v_item.response_text is not null
    or exists (select 1 from public.wishlist_items where reply_to_item_id = p_item_id) then
    raise exception 'This interaction already has a reply';
  end if;

  if v_response_text is not null then
    update public.wishlist_items
      set response_text = v_response_text
      where id = p_item_id;
    return null;
  end if;

  select * into v_interaction
    from public.interaction_options
    where id = p_reply_interaction_id and archived_at is null;
  if not found then raise exception 'Interaction is unavailable'; end if;

  insert into public.wishlists(sender_id, receiver_id)
    values (auth.uid(), v_item.actual_sender_id)
    returning id into v_wishlist_id;

  insert into public.wishlist_items(
    wishlist_id,
    kind,
    interaction_option_id,
    name_snapshot,
    emoji_snapshot,
    quantity,
    reply_to_item_id
  ) values (
    v_wishlist_id,
    'interaction',
    v_interaction.id,
    v_interaction.name,
    v_interaction.emoji,
    1,
    p_item_id
  ) returning id into v_reply_item_id;

  return v_reply_item_id;
end;
$$;

revoke all on function public.respond_to_interaction(uuid, text, uuid) from public, anon;
grant execute on function public.respond_to_interaction(uuid, text, uuid) to authenticated;
