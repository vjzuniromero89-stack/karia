-- KARIA V3 cumulative migration: media + materials/coupons/admin operations.
-- Safe to run after KARIA COMPLETE V2.
alter table public.materials enable row level security;
alter table public.coupons enable row level security;
alter table public.production_materials enable row level security;
alter table public.shipping_zones enable row level security;
alter table public.notifications enable row level security;

do $$ begin create policy "admin materials all" on public.materials for all using(public.is_admin()) with check(public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "admin coupons all" on public.coupons for all using(public.is_admin()) with check(public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "public active coupons read" on public.coupons for select using(active=true or public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "admin production materials all" on public.production_materials for all using(public.is_admin()) with check(public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "admin shipping zones all" on public.shipping_zones for all using(public.is_admin()) with check(public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "user notifications read" on public.notifications for select using(user_id=auth.uid() or public.is_admin()); exception when duplicate_object then null; end $$;

-- Admins need to update order fulfillment/status fields.
do $$ begin create policy "admin update orders" on public.orders for update using(public.is_admin()) with check(public.is_admin()); exception when duplicate_object then null; end $$;

-- Media bucket already exists from V2. Keep it public for storefront product images.
insert into storage.buckets(id,name,public) values ('product-media','product-media',true) on conflict(id) do update set public=true;
