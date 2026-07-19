-- Our Private Menu: complete schema, authorization and atomic workflows.
-- Real names, email addresses and user UUIDs are intentionally absent from this migration.

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null unique check (role in ('girlfriend', 'boyfriend')),
  display_name text not null check (char_length(display_name) between 1 and 30),
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 30),
  position integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dishes (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id),
  name text not null check (char_length(name) between 1 and 40),
  photo_path text,
  position integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.interaction_options (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  emoji text not null check (char_length(emoji) between 1 and 16),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  is_system boolean not null default false,
  creator_id uuid references public.profiles(id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint system_interaction_has_no_creator check (
    (is_system and creator_id is null) or (not is_system and creator_id is not null)
  )
);

create table public.wishlists (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id),
  receiver_id uuid not null references public.profiles(id),
  note text check (note is null or char_length(note) <= 160),
  created_at timestamptz not null default now(),
  constraint wishlist_between_two_people check (sender_id <> receiver_id)
);

create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references public.wishlists(id) on delete restrict,
  kind text not null check (kind in ('dish', 'interaction')),
  dish_id uuid references public.dishes(id),
  interaction_option_id uuid references public.interaction_options(id),
  name_snapshot text not null,
  emoji_snapshot text,
  quantity integer not null default 1 check (quantity between 1 and 9),
  status text not null default 'pending' check (
    status in ('pending', 'cooking', 'served', 'accepted', 'fulfilled', 'declined', 'cancelled')
  ),
  response_text text check (response_text is null or char_length(response_text) <= 120),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  constraint wishlist_item_reference_matches_kind check (
    (kind = 'dish' and dish_id is not null and interaction_option_id is null and emoji_snapshot is null)
    or
    (kind = 'interaction' and dish_id is null and interaction_option_id is not null and quantity = 1)
  ),
  constraint wishlist_item_status_matches_kind check (
    (kind = 'dish' and status in ('pending', 'cooking', 'served', 'cancelled'))
    or
    (kind = 'interaction' and status in ('pending', 'accepted', 'fulfilled', 'declined', 'cancelled'))
  )
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null unique references public.wishlist_items(id) on delete restrict,
  reviewer_id uuid not null references public.profiles(id),
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index wishlist_sender_idx on public.wishlists(sender_id, created_at desc);
create index wishlist_receiver_idx on public.wishlists(receiver_id, created_at desc);
create index wishlist_items_wishlist_idx on public.wishlist_items(wishlist_id, created_at);
create index active_dishes_idx on public.dishes(category_id, position) where archived_at is null;
create index active_interactions_idx on public.interaction_options(created_at) where archived_at is null;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger categories_touch before update on public.categories for each row execute function public.touch_updated_at();
create trigger dishes_touch before update on public.dishes for each row execute function public.touch_updated_at();
create trigger interactions_touch before update on public.interaction_options for each row execute function public.touch_updated_at();
create trigger reviews_touch before update on public.reviews for each row execute function public.touch_updated_at();

create or replace function public.assign_category_position()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.position = 0 then
    select coalesce(max(position), 0) + 10 into new.position from public.categories;
  end if;
  return new;
end;
$$;

create trigger categories_position before insert on public.categories for each row execute function public.assign_category_position();

create or replace function public.assign_dish_position()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.position = 0 then
    select coalesce(max(position), 0) + 10 into new.position
      from public.dishes where category_id = new.category_id;
  end if;
  return new;
end;
$$;

create trigger dishes_position before insert on public.dishes for each row execute function public.assign_dish_position();

-- Authorization helpers use a fixed search_path and never accept caller-controlled identifiers.
create or replace function public.is_couple_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

create or replace function public.current_couple_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

revoke all on function public.is_couple_user() from public;
revoke all on function public.current_couple_role() from public;
grant execute on function public.is_couple_user() to authenticated;
grant execute on function public.current_couple_role() to authenticated;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.dishes enable row level security;
alter table public.interaction_options enable row level security;
alter table public.wishlists enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.reviews enable row level security;

create policy "couple can read profiles" on public.profiles for select to authenticated using (public.is_couple_user());
create policy "couple can read categories" on public.categories for select to authenticated using (public.is_couple_user());
create policy "boyfriend can create categories" on public.categories for insert to authenticated with check (public.current_couple_role() = 'boyfriend');
create policy "boyfriend can update categories" on public.categories for update to authenticated using (public.current_couple_role() = 'boyfriend') with check (public.current_couple_role() = 'boyfriend');
create policy "couple can read dishes" on public.dishes for select to authenticated using (public.is_couple_user());
create policy "boyfriend can create dishes" on public.dishes for insert to authenticated with check (public.current_couple_role() = 'boyfriend');
create policy "boyfriend can update dishes" on public.dishes for update to authenticated using (public.current_couple_role() = 'boyfriend') with check (public.current_couple_role() = 'boyfriend');
create policy "couple can read interactions" on public.interaction_options for select to authenticated using (public.is_couple_user());
create policy "couple can create custom interactions" on public.interaction_options for insert to authenticated
  with check (public.is_couple_user() and not is_system and creator_id = auth.uid());
create policy "creator can update custom interaction" on public.interaction_options for update to authenticated
  using (not is_system and creator_id = auth.uid()) with check (not is_system and creator_id = auth.uid());
create policy "couple can read wishlists" on public.wishlists for select to authenticated
  using (public.is_couple_user() and auth.uid() in (sender_id, receiver_id));
create policy "couple can read wishlist items" on public.wishlist_items for select to authenticated
  using (exists (
    select 1 from public.wishlists w
    where w.id = wishlist_id and auth.uid() in (w.sender_id, w.receiver_id)
  ));
create policy "couple can read reviews" on public.reviews for select to authenticated
  using (public.is_couple_user());

-- Create a complete wishlist in one transaction and snapshot names server-side.
create or replace function public.create_wishlist(p_items jsonb, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sender public.profiles%rowtype;
  v_receiver public.profiles%rowtype;
  v_wishlist_id uuid;
  v_entry jsonb;
  v_kind text;
  v_reference_id uuid;
  v_quantity integer;
  v_dish public.dishes%rowtype;
  v_interaction public.interaction_options%rowtype;
begin
  select * into v_sender from public.profiles where id = auth.uid();
  if not found then raise exception 'Only configured couple accounts may create wishes'; end if;
  select * into v_receiver from public.profiles where id <> v_sender.id and role <> v_sender.role limit 1;
  if not found then raise exception 'The other couple profile has not been configured'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 20 then
    raise exception 'A wishlist needs between 1 and 20 items';
  end if;
  if p_note is not null and char_length(p_note) > 160 then raise exception 'Note is too long'; end if;

  insert into public.wishlists(sender_id, receiver_id, note)
  values (v_sender.id, v_receiver.id, nullif(btrim(p_note), '')) returning id into v_wishlist_id;

  for v_entry in select value from jsonb_array_elements(p_items)
  loop
    v_kind := v_entry->>'kind';
    begin
      v_reference_id := (v_entry->>'reference_id')::uuid;
    exception when others then
      raise exception 'Invalid item reference';
    end;
    v_quantity := coalesce((v_entry->>'quantity')::integer, 1);

    if v_kind = 'dish' then
      if v_sender.role <> 'girlfriend' then raise exception 'Only the girlfriend can order dishes'; end if;
      if v_quantity not between 1 and 9 then raise exception 'Dish quantity must be between 1 and 9'; end if;
      select * into v_dish from public.dishes where id = v_reference_id and archived_at is null;
      if not found then raise exception 'Dish is unavailable'; end if;
      insert into public.wishlist_items(wishlist_id, kind, dish_id, name_snapshot, quantity)
      values (v_wishlist_id, 'dish', v_dish.id, v_dish.name, v_quantity);
    elsif v_kind = 'interaction' then
      select * into v_interaction from public.interaction_options where id = v_reference_id and archived_at is null;
      if not found then raise exception 'Interaction is unavailable'; end if;
      insert into public.wishlist_items(wishlist_id, kind, interaction_option_id, name_snapshot, emoji_snapshot, quantity)
      values (v_wishlist_id, 'interaction', v_interaction.id, v_interaction.name, v_interaction.emoji, 1);
    else
      raise exception 'Unsupported item kind';
    end if;
  end loop;
  return v_wishlist_id;
end;
$$;

create or replace function public.transition_item(p_item_id uuid, p_action text, p_response_text text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item record;
  v_role text;
begin
  select wi.*, w.receiver_id as actual_receiver_id into v_item
    from public.wishlist_items wi join public.wishlists w on w.id = wi.wishlist_id
    where wi.id = p_item_id for update of wi;
  if not found then raise exception 'Wish item not found'; end if;
  if v_item.actual_receiver_id <> auth.uid() then raise exception 'Only the receiver may respond'; end if;
  select role into v_role from public.profiles where id = auth.uid();
  if p_response_text is not null and char_length(p_response_text) > 120 then raise exception 'Response is too long'; end if;

  if p_action = 'start' and v_item.kind = 'dish' and v_item.status = 'pending' and v_role = 'boyfriend' then
    update public.wishlist_items set status = 'cooking', started_at = now() where id = p_item_id;
  elsif p_action = 'serve' and v_item.kind = 'dish' and v_item.status = 'cooking' and v_role = 'boyfriend' then
    update public.wishlist_items set status = 'served', completed_at = now() where id = p_item_id;
  elsif p_action = 'accept' and v_item.kind = 'interaction' and v_item.status = 'pending' then
    update public.wishlist_items set status = 'accepted', started_at = now() where id = p_item_id;
  elsif p_action = 'decline' and v_item.kind = 'interaction' and v_item.status = 'pending' then
    update public.wishlist_items set status = 'declined', response_text = nullif(btrim(p_response_text), ''), completed_at = now() where id = p_item_id;
  elsif p_action = 'fulfill' and v_item.kind = 'interaction' and v_item.status = 'accepted' then
    update public.wishlist_items set status = 'fulfilled', completed_at = now() where id = p_item_id;
  else
    raise exception 'This transition is no longer allowed';
  end if;
end;
$$;

create or replace function public.cancel_item(p_item_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.wishlist_items wi
    set status = 'cancelled', cancelled_at = now()
    from public.wishlists w
    where wi.id = p_item_id and w.id = wi.wishlist_id and w.sender_id = auth.uid() and wi.status = 'pending';
  if not found then raise exception 'Only a pending wish may be withdrawn by its sender'; end if;
end;
$$;

create or replace function public.save_review(p_item_id uuid, p_rating integer, p_comment text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_review_id uuid;
begin
  if public.current_couple_role() <> 'girlfriend' then raise exception 'Only the girlfriend may review dishes'; end if;
  if p_rating not between 1 and 5 then raise exception 'Rating must be between 1 and 5'; end if;
  if p_comment is not null and char_length(p_comment) > 180 then raise exception 'Review is too long'; end if;
  if not exists (
    select 1 from public.wishlist_items wi join public.wishlists w on w.id = wi.wishlist_id
    where wi.id = p_item_id and wi.kind = 'dish' and wi.status = 'served' and w.sender_id = auth.uid()
  ) then raise exception 'This dish cannot be reviewed'; end if;
  insert into public.reviews(item_id, reviewer_id, rating, comment)
  values (p_item_id, auth.uid(), p_rating, nullif(btrim(p_comment), ''))
  on conflict (item_id) do update set rating = excluded.rating, comment = excluded.comment, updated_at = now()
  returning id into v_review_id;
  return v_review_id;
end;
$$;

create or replace function public.archive_category(p_category_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if public.current_couple_role() <> 'boyfriend' then raise exception 'Only the boyfriend may manage categories'; end if;
  if exists (select 1 from public.dishes where category_id = p_category_id and archived_at is null) then
    raise exception 'Move or archive active dishes first';
  end if;
  update public.categories set archived_at = now() where id = p_category_id and archived_at is null;
end;
$$;

create or replace function public.move_category(p_category_id uuid, p_direction integer)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_current public.categories%rowtype; v_other public.categories%rowtype;
begin
  if public.current_couple_role() <> 'boyfriend' then raise exception 'Only the boyfriend may manage categories'; end if;
  if p_direction not in (-1, 1) then raise exception 'Direction must be -1 or 1'; end if;
  select * into v_current from public.categories where id = p_category_id and archived_at is null for update;
  if p_direction = -1 then
    select * into v_other from public.categories where archived_at is null and position < v_current.position order by position desc limit 1 for update;
  else
    select * into v_other from public.categories where archived_at is null and position > v_current.position order by position limit 1 for update;
  end if;
  if found then
    update public.categories set position = case when id = v_current.id then v_other.position else v_current.position end where id in (v_current.id, v_other.id);
  end if;
end;
$$;

create or replace function public.move_dish(p_dish_id uuid, p_direction integer)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_current public.dishes%rowtype; v_other public.dishes%rowtype;
begin
  if public.current_couple_role() <> 'boyfriend' then raise exception 'Only the boyfriend may manage dishes'; end if;
  if p_direction not in (-1, 1) then raise exception 'Direction must be -1 or 1'; end if;
  select * into v_current from public.dishes where id = p_dish_id and archived_at is null for update;
  if p_direction = -1 then
    select * into v_other from public.dishes where archived_at is null and category_id = v_current.category_id and position < v_current.position order by position desc limit 1 for update;
  else
    select * into v_other from public.dishes where archived_at is null and category_id = v_current.category_id and position > v_current.position order by position limit 1 for update;
  end if;
  if found then
    update public.dishes set position = case when id = v_current.id then v_other.position else v_current.position end where id in (v_current.id, v_other.id);
  end if;
end;
$$;

revoke all on function public.create_wishlist(jsonb, text) from public, anon;
revoke all on function public.transition_item(uuid, text, text) from public, anon;
revoke all on function public.cancel_item(uuid) from public, anon;
revoke all on function public.save_review(uuid, integer, text) from public, anon;
revoke all on function public.archive_category(uuid) from public, anon;
revoke all on function public.move_category(uuid, integer) from public, anon;
revoke all on function public.move_dish(uuid, integer) from public, anon;
grant execute on function public.create_wishlist(jsonb, text) to authenticated;
grant execute on function public.transition_item(uuid, text, text) to authenticated;
grant execute on function public.cancel_item(uuid) to authenticated;
grant execute on function public.save_review(uuid, integer, text) to authenticated;
grant execute on function public.archive_category(uuid) to authenticated;
grant execute on function public.move_category(uuid, integer) to authenticated;
grant execute on function public.move_dish(uuid, integer) to authenticated;

-- Private dish photos. Signed URLs are generated only after an authenticated read passes RLS.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('dish-images', 'dish-images', false, 12582912, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false;

create policy "couple can read private dish photos" on storage.objects for select to authenticated
  using (bucket_id = 'dish-images' and public.is_couple_user());
create policy "boyfriend can upload dish photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'dish-images' and public.current_couple_role() = 'boyfriend' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "boyfriend can update dish photos" on storage.objects for update to authenticated
  using (bucket_id = 'dish-images' and public.current_couple_role() = 'boyfriend')
  with check (bucket_id = 'dish-images' and public.current_couple_role() = 'boyfriend');
create policy "boyfriend can delete dish photos" on storage.objects for delete to authenticated
  using (bucket_id = 'dish-images' and public.current_couple_role() = 'boyfriend');

-- Realtime publication for foreground notifications and two-device synchronization.
alter publication supabase_realtime add table public.categories;
alter publication supabase_realtime add table public.dishes;
alter publication supabase_realtime add table public.interaction_options;
alter publication supabase_realtime add table public.wishlists;
alter publication supabase_realtime add table public.wishlist_items;
alter publication supabase_realtime add table public.reviews;
