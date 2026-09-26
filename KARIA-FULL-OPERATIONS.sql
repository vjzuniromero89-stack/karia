-- KARIA full operations extension. Run AFTER the original schema.
alter table public.profiles add column if not exists disabled boolean not null default false;
alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.products add column if not exists compare_at_price numeric(12,2);
alter table public.products add column if not exists seo_title text;
alter table public.products add column if not exists seo_description text;
alter table public.orders add column if not exists processor_fee numeric(12,2) default 0;
alter table public.orders add column if not exists tracking_number text;
alter table public.orders add column if not exists carrier text;
alter table public.orders add column if not exists notes text;

create table if not exists public.settings(
 key text primary key, value jsonb not null default '{}'::jsonb, updated_at timestamptz default now()
);
create table if not exists public.material_movements(
 id uuid primary key default gen_random_uuid(), material_id uuid references public.materials(id),
 qty numeric(12,3) not null, movement_type text not null, reference_type text, reference_id uuid,
 note text, actor_id uuid references auth.users(id), created_at timestamptz default now()
);
create table if not exists public.refunds(
 id uuid primary key default gen_random_uuid(), order_id uuid references public.orders(id),
 amount numeric(12,2) not null, reason text, stripe_refund_id text, created_at timestamptz default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role in ('staff','admin','super_admin') and disabled=false);
$$;
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='super_admin' and disabled=false);
$$;

-- Admin policies
do $$ begin
 create policy "admin read profiles" on public.profiles for select using(public.is_admin() or auth.uid()=id);
exception when duplicate_object then null; end $$;
do $$ begin
 create policy "admin products all" on public.products for all using(public.is_admin()) with check(public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
 create policy "admin brands all" on public.brands for all using(public.is_admin()) with check(public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
 create policy "admin inventory all" on public.inventory_movements for all using(public.is_admin()) with check(public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
 create policy "admin orders all" on public.orders for all using(public.is_admin()) with check(public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
 create policy "admin order items all" on public.order_items for all using(public.is_admin()) with check(public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
 create policy "admin production all" on public.production_orders for all using(public.is_admin()) with check(public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
 create policy "admin expenses all" on public.expenses for all using(public.is_admin()) with check(public.is_admin());
exception when duplicate_object then null; end $$;

alter table public.inventory_movements enable row level security;
alter table public.order_items enable row level security;
alter table public.production_orders enable row level security;
alter table public.expenses enable row level security;

-- Storage buckets
insert into storage.buckets(id,name,public) values
 ('product-media','product-media',true),('brand-logos','brand-logos',true),('receipts','receipts',false)
on conflict(id) do nothing;
do $$ begin
 create policy "public product media" on storage.objects for select using(bucket_id in ('product-media','brand-logos'));
exception when duplicate_object then null; end $$;
do $$ begin
 create policy "admin upload media" on storage.objects for insert with check(bucket_id in ('product-media','brand-logos','receipts') and public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
 create policy "admin update media" on storage.objects for update using(bucket_id in ('product-media','brand-logos','receipts') and public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
 create policy "admin delete media" on storage.objects for delete using(bucket_id in ('product-media','brand-logos','receipts') and public.is_admin());
exception when duplicate_object then null; end $$;
