-- Optional private image icons for custom interactions.
-- Paths are snapshotted onto wishlist items so later edits do not rewrite memories.

alter table public.interaction_options
  add column icon_path text;

alter table public.wishlist_items
  add column icon_path_snapshot text;

create or replace function public.snapshot_interaction_icon()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.kind = 'interaction' and new.interaction_option_id is not null then
    select icon_path into new.icon_path_snapshot
      from public.interaction_options
      where id = new.interaction_option_id;
  end if;
  return new;
end;
$$;

create trigger wishlist_item_interaction_icon_snapshot
before insert on public.wishlist_items
for each row execute function public.snapshot_interaction_icon();

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('interaction-icons', 'interaction-icons', false, 12582912, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false;

create policy "couple can read private interaction icons" on storage.objects for select to authenticated
  using (bucket_id = 'interaction-icons' and public.is_couple_user());

create policy "couple can upload own interaction icons" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'interaction-icons'
    and public.is_couple_user()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "couple can update own interaction icons" on storage.objects for update to authenticated
  using (
    bucket_id = 'interaction-icons'
    and public.is_couple_user()
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'interaction-icons'
    and public.is_couple_user()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "couple can delete own interaction icons" on storage.objects for delete to authenticated
  using (
    bucket_id = 'interaction-icons'
    and public.is_couple_user()
    and (storage.foldername(name))[1] = auth.uid()::text
  );
