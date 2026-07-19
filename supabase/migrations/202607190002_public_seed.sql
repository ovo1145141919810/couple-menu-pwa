-- Generic starter content only. No private couple data belongs in source control.
insert into public.categories(name, position) values
  ('主食', 10),
  ('荤菜', 20),
  ('素菜', 30),
  ('汤羹', 40),
  ('甜品饮品', 50);

insert into public.interaction_options(name, emoji, color, is_system, creator_id) values
  ('亲亲', '💋', '#F7A7B4', true, null),
  ('抱抱', '🫂', '#E9A6CF', true, null),
  ('和好', '🤝', '#E7B37B', true, null),
  ('打你', '👊', '#A9B8E8', true, null);
