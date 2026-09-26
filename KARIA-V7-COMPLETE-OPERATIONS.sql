-- KARIA V7 COMPLETE OPERATIONS
-- Safe additive migration. Run after all previous KARIA migrations.

create extension if not exists pgcrypto;

alter table if exists public.products add column if not exists category text;
alter table if exists public.products add column if not exists published_at timestamptz;
alter table if exists public.products add column if not exists compare_at_price numeric(12,2);
alter table if exists public.products add column if not exists seo_title text;
alter table if exists public.products add column if not exists seo_description text;

alter table if exists public.brands add column if not exists logo_url text;
alter table if exists public.brands add column if not exists cover_url text;
alter table if exists public.brands add column if not exists active boolean not null default true;

alter table if exists public.materials add column if not exists sku text;
alter table if exists public.materials add column if not exists supplier text;
alter table if exists public.materials add column if not exists low_stock_threshold numeric(12,3) default 0;
alter table if exists public.materials add column if not exists active boolean not null default true;

create table if not exists public.material_movements (
  id uuid primary key default gen_random_uuid(),
  material_id uuid references public.materials(id) on delete restrict,
  movement_type text not null check (movement_type in ('OPENING','IN','OUT','PRODUCTION','RETURN','ADJUSTMENT')),
  quantity numeric(12,3) not null,
  unit_cost numeric(12,4),
  note text,
  reference_type text,
  reference_id uuid,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.product_materials (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  material_id uuid references public.materials(id) on delete restrict,
  quantity_per_unit numeric(12,3) not null default 1,
  unique(product_id, material_id)
);

alter table if exists public.production_orders add column if not exists completed_qty integer default 0;
alter table if exists public.production_orders add column if not exists started_at timestamptz;
alter table if exists public.production_orders add column if not exists completed_at timestamptz;
alter table if exists public.production_orders add column if not exists notes text;

alter table if exists public.orders add column if not exists tracking_number text;
alter table if exists public.orders add column if not exists carrier text;
alter table if exists public.orders add column if not exists shipped_at timestamptz;
alter table if exists public.orders add column if not exists delivered_at timestamptz;
alter table if exists public.orders add column if not exists coupon_code text;
alter table if exists public.orders add column if not exists discount_total numeric(12,2) not null default 0;
alter table if exists public.orders add column if not exists shipping_total numeric(12,2) not null default 0;

create table if not exists public.store_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  countries text[] not null default '{}',
  flat_rate numeric(12,2) not null default 0,
  free_over numeric(12,2),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_material_movements_material on public.material_movements(material_id,created_at);
create index if not exists idx_product_materials_product on public.product_materials(product_id);
create index if not exists idx_orders_status_created on public.orders(status,created_at);

insert into public.store_settings(key,value)
values
 ('store', '{"name":"KARIA","currency":"USD","email":""}'::jsonb),
 ('shipping', '{"enabled":true,"free_shipping_threshold":null}'::jsonb),
 ('returns', '{"days":30}'::jsonb)
on conflict (key) do nothing;

alter table public.material_movements enable row level security;
alter table public.product_materials enable row level security;
alter table public.store_settings enable row level security;
alter table public.notifications enable row level security;
alter table public.shipping_zones enable row level security;

drop policy if exists "admin material movements" on public.material_movements;
create policy "admin material movements" on public.material_movements for all to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('staff','admin','super_admin')))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('staff','admin','super_admin')));

drop policy if exists "admin product materials" on public.product_materials;
create policy "admin product materials" on public.product_materials for all to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('staff','admin','super_admin')))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('staff','admin','super_admin')));

drop policy if exists "read store settings" on public.store_settings;
create policy "read store settings" on public.store_settings for select using (true);
drop policy if exists "admin store settings" on public.store_settings;
create policy "admin store settings" on public.store_settings for all to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','super_admin')))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','super_admin')));

drop policy if exists "own notifications" on public.notifications;
create policy "own notifications" on public.notifications for select to authenticated using (user_id=auth.uid());
drop policy if exists "public shipping zones" on public.shipping_zones;
create policy "public shipping zones" on public.shipping_zones for select using (active=true);
drop policy if exists "admin shipping zones" on public.shipping_zones;
create policy "admin shipping zones" on public.shipping_zones for all to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','super_admin')))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','super_admin')));
