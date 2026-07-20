-- Shared interaction categories and a touch-friendly custom layout for both couple accounts.

create table public.interaction_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint interaction_categories_name_trimmed
    check (name = btrim(name) and char_length(name) between 1 and 30)
);

create trigger interaction_categories_touch
before update on public.interaction_categories
for each row execute function public.touch_updated_at();

insert into public.interaction_categories(name, position) values
  ('日常贴贴', 10),
  ('陪伴时光', 20),
  ('小情绪', 30);

alter table public.interaction_options
  add column category_id uuid references public.interaction_categories(id),
  add column position integer;

update public.interaction_options
set category_id = case
  when name in ('亲亲', '抱抱') then (select id from public.interaction_categories where name = '日常贴贴')
  when name in ('和好', '打你') then (select id from public.interaction_categories where name = '小情绪')
  else (select id from public.interaction_categories where name = '陪伴时光')
end;

with ranked as (
  select id, row_number() over (partition by category_id order by created_at, id) * 10 as new_position
  from public.interaction_options
)
update public.interaction_options target
set position = ranked.new_position
from ranked
where target.id = ranked.id;

alter table public.interaction_options
  alter column category_id set not null,
  alter column position set default 0,
  alter column position set not null;

drop index if exists public.active_interactions_idx;
create index active_interactions_idx
  on public.interaction_options(category_id, position)
  where archived_at is null;

create or replace function public.assign_interaction_position()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.position = 0 then
    select coalesce(max(position), 0) + 10 into new.position
      from public.interaction_options
      where category_id = new.category_id;
  end if;
  return new;
end;
$$;

create trigger interaction_options_position
before insert on public.interaction_options
for each row execute function public.assign_interaction_position();

alter table public.interaction_categories enable row level security;
create policy "couple can read interaction categories"
  on public.interaction_categories for select to authenticated
  using (public.is_couple_user());

revoke all privileges on table public.interaction_categories from anon, authenticated;
grant select on table public.interaction_categories to authenticated;
grant insert (category_id, name, emoji, color, is_system, creator_id, icon_path)
  on public.interaction_options to authenticated;
grant update (category_id, name, emoji, color, icon_path, archived_at)
  on public.interaction_options to authenticated;
revoke execute on function public.assign_interaction_position() from public, anon, authenticated;

create or replace function public.create_interaction_category(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := nullif(btrim(p_name), '');
  v_id uuid;
  v_position integer;
begin
  if not public.is_couple_user() then raise exception 'Only configured couple accounts may manage interaction categories'; end if;
  if v_name is null or char_length(v_name) > 30 then raise exception 'Interaction category name is invalid'; end if;
  select coalesce(max(position), 0) + 10 into v_position from public.interaction_categories where archived_at is null;
  insert into public.interaction_categories(name, position) values (v_name, v_position) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.rename_interaction_category(p_category_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_name text := nullif(btrim(p_name), '');
begin
  if not public.is_couple_user() then raise exception 'Only configured couple accounts may manage interaction categories'; end if;
  if v_name is null or char_length(v_name) > 30 then raise exception 'Interaction category name is invalid'; end if;
  update public.interaction_categories set name = v_name where id = p_category_id and archived_at is null;
  if not found then raise exception 'Interaction category not found'; end if;
end;
$$;

create or replace function public.move_interaction_category(p_category_id uuid, p_direction integer)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current public.interaction_categories%rowtype;
  v_other public.interaction_categories%rowtype;
begin
  if not public.is_couple_user() then raise exception 'Only configured couple accounts may manage interaction categories'; end if;
  if p_direction not in (-1, 1) then raise exception 'Direction must be -1 or 1'; end if;
  select * into v_current from public.interaction_categories where id = p_category_id and archived_at is null for update;
  if not found then raise exception 'Interaction category not found'; end if;
  if p_direction = -1 then
    select * into v_other from public.interaction_categories where archived_at is null and position < v_current.position order by position desc limit 1 for update;
  else
    select * into v_other from public.interaction_categories where archived_at is null and position > v_current.position order by position limit 1 for update;
  end if;
  if found then
    update public.interaction_categories
      set position = case when id = v_current.id then v_other.position else v_current.position end
      where id in (v_current.id, v_other.id);
  end if;
end;
$$;

create or replace function public.archive_interaction_category(p_category_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_couple_user() then raise exception 'Only configured couple accounts may manage interaction categories'; end if;
  if (select count(*) from public.interaction_categories where archived_at is null) <= 1 then
    raise exception 'At least one interaction category is required';
  end if;
  if exists (select 1 from public.interaction_options where category_id = p_category_id and archived_at is null) then
    raise exception 'Move active interactions before archiving this category';
  end if;
  update public.interaction_categories set archived_at = now() where id = p_category_id and archived_at is null;
  if not found then raise exception 'Interaction category not found'; end if;
end;
$$;

create or replace function public.save_interaction_layout(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_entry jsonb;
  v_id uuid;
  v_category_id uuid;
  v_seen uuid[] := array[]::uuid[];
  v_category_positions jsonb := '{}'::jsonb;
  v_position integer;
  v_active_count integer;
begin
  if not public.is_couple_user() then raise exception 'Only configured couple accounts may arrange interactions'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'Interaction layout must be an array'; end if;
  select count(*) into v_active_count from public.interaction_options where archived_at is null;
  if jsonb_array_length(p_items) <> v_active_count then raise exception 'Interaction list changed; refresh and retry'; end if;

  perform id from public.interaction_options where archived_at is null order by id for update;
  for v_entry in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_id := (v_entry->>'id')::uuid;
      v_category_id := (v_entry->>'category_id')::uuid;
    exception when others then
      raise exception 'Invalid interaction layout entry';
    end;
    if v_id = any(v_seen) then raise exception 'Interaction layout contains duplicates'; end if;
    if not exists (select 1 from public.interaction_options where id = v_id and archived_at is null) then
      raise exception 'Interaction list changed; refresh and retry';
    end if;
    if not exists (select 1 from public.interaction_categories where id = v_category_id and archived_at is null) then
      raise exception 'Interaction category is unavailable';
    end if;
    v_seen := array_append(v_seen, v_id);
    v_position := coalesce((v_category_positions->>v_category_id::text)::integer, 0) + 10;
    v_category_positions := jsonb_set(v_category_positions, array[v_category_id::text], to_jsonb(v_position), true);
    update public.interaction_options set category_id = v_category_id, position = v_position where id = v_id;
  end loop;
end;
$$;

revoke all on function public.create_interaction_category(text) from public, anon;
revoke all on function public.rename_interaction_category(uuid, text) from public, anon;
revoke all on function public.move_interaction_category(uuid, integer) from public, anon;
revoke all on function public.archive_interaction_category(uuid) from public, anon;
revoke all on function public.save_interaction_layout(jsonb) from public, anon;
grant execute on function public.create_interaction_category(text) to authenticated;
grant execute on function public.rename_interaction_category(uuid, text) to authenticated;
grant execute on function public.move_interaction_category(uuid, integer) to authenticated;
grant execute on function public.archive_interaction_category(uuid) to authenticated;
grant execute on function public.save_interaction_layout(jsonb) to authenticated;

alter publication supabase_realtime add table public.interaction_categories;
