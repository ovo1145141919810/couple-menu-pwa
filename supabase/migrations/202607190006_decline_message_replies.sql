-- Let the original interaction sender reply once to a written decline message.

alter table public.wishlist_items
  add column sender_reply_text text
  check (sender_reply_text is null or char_length(sender_reply_text) <= 120);

create or replace function public.reply_to_decline(p_item_id uuid, p_reply_text text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item record;
  v_reply_text text := nullif(btrim(p_reply_text), '');
begin
  select wi.*, w.sender_id as actual_sender_id
    into v_item
    from public.wishlist_items wi
    join public.wishlists w on w.id = wi.wishlist_id
    where wi.id = p_item_id
    for update of wi;

  if not found then raise exception 'Wish item not found'; end if;
  if v_item.actual_sender_id <> auth.uid() then raise exception 'Only the sender may reply'; end if;
  if v_item.kind <> 'interaction' or v_item.status <> 'declined' or v_item.response_text is null then
    raise exception 'Only a written decline may receive this reply';
  end if;
  if v_item.sender_reply_text is not null then raise exception 'This decline already has a reply'; end if;
  if v_reply_text is null then raise exception 'Reply cannot be empty'; end if;
  if char_length(v_reply_text) > 120 then raise exception 'Reply is too long'; end if;

  update public.wishlist_items
    set sender_reply_text = v_reply_text
    where id = p_item_id;
end;
$$;

revoke all on function public.reply_to_decline(uuid, text) from public, anon;
grant execute on function public.reply_to_decline(uuid, text) to authenticated;
