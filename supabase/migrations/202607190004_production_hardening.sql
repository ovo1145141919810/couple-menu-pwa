-- Production hardening: least-privilege API grants and server-side input hygiene.
-- RLS remains the source of row authorization; these grants limit which operations
-- the browser role can attempt before policies are evaluated.

alter table public.profiles
  add constraint profiles_display_name_trimmed
  check (display_name = btrim(display_name) and char_length(display_name) between 1 and 30);

alter table public.categories
  add constraint categories_name_trimmed
  check (name = btrim(name) and char_length(name) between 1 and 30);

alter table public.dishes
  add constraint dishes_name_trimmed
  check (name = btrim(name) and char_length(name) between 1 and 40);

alter table public.interaction_options
  add constraint interactions_name_trimmed
  check (name = btrim(name) and char_length(name) between 1 and 40),
  add constraint interactions_emoji_trimmed
  check (emoji = btrim(emoji) and char_length(emoji) between 1 and 16);

revoke all privileges on table
  public.profiles,
  public.categories,
  public.dishes,
  public.interaction_options,
  public.wishlists,
  public.wishlist_items,
  public.reviews
from anon, authenticated;

grant select on table
  public.profiles,
  public.categories,
  public.dishes,
  public.interaction_options,
  public.wishlists,
  public.wishlist_items,
  public.reviews
to authenticated;

grant insert (name) on public.categories to authenticated;
grant update (name) on public.categories to authenticated;

grant insert (category_id, name, photo_path) on public.dishes to authenticated;
grant update (category_id, name, photo_path, archived_at) on public.dishes to authenticated;

grant insert (name, emoji, color, is_system, creator_id, icon_path)
  on public.interaction_options to authenticated;
grant update (name, emoji, color, icon_path, archived_at)
  on public.interaction_options to authenticated;

-- Trigger helpers are internal implementation details, not browser-callable RPCs.
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.assign_category_position() from public, anon, authenticated;
revoke execute on function public.assign_dish_position() from public, anon, authenticated;
revoke execute on function public.snapshot_interaction_icon() from public, anon, authenticated;
