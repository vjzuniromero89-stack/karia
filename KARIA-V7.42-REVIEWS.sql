-- KARIA V7.42 — customer reviews with stars
-- One review per customer and product. Published right away; an admin can hide or delete it.
create table if not exists public.product_reviews(
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  author_name text not null check (char_length(author_name) between 1 and 60),
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 3 and 2000),
  approved boolean not null default true,
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);
create index if not exists idx_product_reviews_product on public.product_reviews(product_id, created_at desc);
alter table public.product_reviews enable row level security;

do $$ begin create policy "read published reviews" on public.product_reviews for select using (approved or user_id = auth.uid() or public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "customers write their own review" on public.product_reviews for insert to authenticated with check (user_id = auth.uid() and approved); exception when duplicate_object then null; end $$;
-- a customer can rewrite their own review but cannot re-publish one an admin hid
do $$ begin create policy "customers edit their own review" on public.product_reviews for update to authenticated using (user_id = auth.uid() and approved) with check (user_id = auth.uid() and approved); exception when duplicate_object then null; end $$;
do $$ begin create policy "admin manage reviews" on public.product_reviews for all using (public.is_admin()) with check (public.is_admin()); exception when duplicate_object then null; end $$;
