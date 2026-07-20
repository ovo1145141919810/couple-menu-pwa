-- Optional private photos attached to dish reviews.

alter table public.reviews
  add column photo_path text
  check (
    photo_path is null
    or (
      char_length(photo_path) between 40 and 500
      and photo_path !~ '(^|/)\.\.(/|$)'
    )
  );

drop function public.save_review(uuid, integer, text);

create function public.save_review(
  p_item_id uuid,
  p_rating integer,
  p_comment text default null,
  p_photo_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_review_id uuid;
  v_photo_path text := nullif(btrim(p_photo_path), '');
begin
  if public.current_couple_role() <> 'girlfriend' then raise exception 'Only the girlfriend may review dishes'; end if;
  if p_rating not between 1 and 5 then raise exception 'Rating must be between 1 and 5'; end if;
  if p_comment is not null and char_length(p_comment) > 180 then raise exception 'Review is too long'; end if;
  if v_photo_path is not null and (
    char_length(v_photo_path) > 500
    or v_photo_path not like auth.uid()::text || '/%'
    or v_photo_path ~ '(^|/)\.\.(/|$)'
  ) then raise exception 'Invalid review photo path'; end if;
  if not exists (
    select 1 from public.wishlist_items wi join public.wishlists w on w.id = wi.wishlist_id
    where wi.id = p_item_id and wi.kind = 'dish' and wi.status = 'served' and w.sender_id = auth.uid()
  ) then raise exception 'This dish cannot be reviewed'; end if;

  insert into public.reviews(item_id, reviewer_id, rating, comment, photo_path)
  values (p_item_id, auth.uid(), p_rating, nullif(btrim(p_comment), ''), v_photo_path)
  on conflict (item_id) do update
    set rating = excluded.rating,
        comment = excluded.comment,
        photo_path = coalesce(excluded.photo_path, reviews.photo_path),
        updated_at = now()
  returning id into v_review_id;
  return v_review_id;
end;
$$;

revoke all on function public.save_review(uuid, integer, text, text) from public, anon;
grant execute on function public.save_review(uuid, integer, text, text) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('review-images', 'review-images', false, 12582912, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false;

create policy "couple can read private review photos" on storage.objects for select to authenticated
  using (bucket_id = 'review-images' and public.is_couple_user());

create policy "girlfriend can upload own review photos" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'review-images'
    and public.current_couple_role() = 'girlfriend'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "girlfriend can update own review photos" on storage.objects for update to authenticated
  using (
    bucket_id = 'review-images'
    and public.current_couple_role() = 'girlfriend'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'review-images'
    and public.current_couple_role() = 'girlfriend'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "girlfriend can delete own review photos" on storage.objects for delete to authenticated
  using (
    bucket_id = 'review-images'
    and public.current_couple_role() = 'girlfriend'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
