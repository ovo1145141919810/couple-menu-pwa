-- Save all active dish positions and category assignments in one transaction.

create function public.save_dish_layout(p_items jsonb)
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
  if public.current_couple_role() <> 'boyfriend' then raise exception 'Only the boyfriend may arrange dishes'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'Dish layout must be an array'; end if;
  select count(*) into v_active_count from public.dishes where archived_at is null;
  if jsonb_array_length(p_items) <> v_active_count then raise exception 'Dish list changed; refresh and retry'; end if;

  perform id from public.dishes where archived_at is null order by id for update;
  for v_entry in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_id := (v_entry->>'id')::uuid;
      v_category_id := (v_entry->>'category_id')::uuid;
    exception when others then
      raise exception 'Invalid dish layout entry';
    end;
    if v_id = any(v_seen) then raise exception 'Dish layout contains duplicates'; end if;
    if not exists (select 1 from public.dishes where id = v_id and archived_at is null) then
      raise exception 'Dish list changed; refresh and retry';
    end if;
    if not exists (select 1 from public.categories where id = v_category_id and archived_at is null) then
      raise exception 'Dish category is unavailable';
    end if;
    v_seen := array_append(v_seen, v_id);
    v_position := coalesce((v_category_positions->>v_category_id::text)::integer, 0) + 10;
    v_category_positions := jsonb_set(v_category_positions, array[v_category_id::text], to_jsonb(v_position), true);
    update public.dishes set category_id = v_category_id, position = v_position where id = v_id;
  end loop;
end;
$$;

revoke all on function public.save_dish_layout(jsonb) from public, anon;
grant execute on function public.save_dish_layout(jsonb) to authenticated;
