-- KARIA COMPLETE — Supabase/Postgres foundation
create extension if not exists "pgcrypto";

create type app_role as enum ('customer','staff','admin','super_admin');
create type order_status as enum ('pending','paid','processing','shipped','delivered','cancelled','refunded');
create type inventory_kind as enum ('IN','OUT','RESERVE','RELEASE','RETURN','ADJUST','PRODUCTION_IN','MATERIAL_OUT');

create table profiles(
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text, phone text, role app_role not null default 'customer',
 created_at timestamptz default now()
);
create table brands(
 id uuid primary key default gen_random_uuid(), name text not null unique,
 slug text not null unique, logo_url text, story text, active boolean default true,
 created_at timestamptz default now()
);
create table categories(id uuid primary key default gen_random_uuid(), name text not null, slug text unique not null);
create table products(
 id uuid primary key default gen_random_uuid(), brand_id uuid references brands(id),
 category_id uuid references categories(id), name text not null, slug text unique not null,
 sku text unique not null, description text, materials text, dimensions text,
 price numeric(12,2) not null check(price>=0), unit_cost numeric(12,2) default 0 check(unit_cost>=0),
 active boolean default true, featured boolean default false, created_at timestamptz default now()
);
create table product_media(
 id uuid primary key default gen_random_uuid(), product_id uuid references products(id) on delete cascade,
 url text not null, media_type text default 'image', sort_order int default 0
);
create table product_variants(
 id uuid primary key default gen_random_uuid(), product_id uuid references products(id) on delete cascade,
 name text not null, sku text unique not null, color text, price_delta numeric(12,2) default 0
);
create table inventory_movements(
 id uuid primary key default gen_random_uuid(), product_id uuid references products(id),
 variant_id uuid references product_variants(id), qty integer not null, movement_type inventory_kind not null,
 reference_type text, reference_id uuid, note text, actor_id uuid references auth.users(id),
 created_at timestamptz default now()
);
create view product_stock as
 select p.id product_id, coalesce(sum(case
   when im.movement_type in ('IN','RETURN','ADJUST','PRODUCTION_IN','RELEASE') then im.qty
   when im.movement_type in ('OUT','RESERVE','MATERIAL_OUT') then -abs(im.qty)
   else 0 end),0)::int stock
 from products p left join inventory_movements im on im.product_id=p.id group by p.id;

create table addresses(
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade,
 label text, line1 text not null, line2 text, city text not null, state text, postal_code text, country text not null default 'US'
);
create table orders(
 id uuid primary key default gen_random_uuid(), order_number bigint generated always as identity,
 customer_id uuid references auth.users(id), email text not null, status order_status default 'pending',
 subtotal numeric(12,2) not null default 0, discount numeric(12,2) default 0,
 shipping numeric(12,2) default 0, tax numeric(12,2) default 0, total numeric(12,2) not null default 0,
 stripe_session_id text unique, stripe_payment_intent text, shipping_address jsonb,
 created_at timestamptz default now(), updated_at timestamptz default now()
);
create table order_items(
 id uuid primary key default gen_random_uuid(), order_id uuid references orders(id) on delete cascade,
 product_id uuid references products(id), variant_id uuid references product_variants(id),
 qty integer not null check(qty>0), unit_price numeric(12,2) not null, unit_cost numeric(12,2) not null default 0
);
create table coupons(
 id uuid primary key default gen_random_uuid(), code text unique not null, percent_off numeric(5,2),
 amount_off numeric(12,2), active boolean default true, starts_at timestamptz, ends_at timestamptz
);
create table materials(
 id uuid primary key default gen_random_uuid(), name text not null, sku text unique, unit text not null default 'unit',
 unit_cost numeric(12,4) default 0, stock numeric(12,3) default 0
);
create table production_orders(
 id uuid primary key default gen_random_uuid(), product_id uuid references products(id),
 qty integer not null, status text default 'pending', assigned_to uuid references auth.users(id),
 started_at timestamptz, completed_at timestamptz, created_at timestamptz default now()
);
create table production_materials(
 production_id uuid references production_orders(id) on delete cascade,
 material_id uuid references materials(id), qty numeric(12,3) not null,
 primary key(production_id,material_id)
);

create table partners(
 id uuid primary key default gen_random_uuid(), display_name text not null,
 ownership_percent numeric(5,2) not null check(ownership_percent between 0 and 100),
 active boolean default true, created_at timestamptz default now()
);
create table partner_capital_movements(
 id uuid primary key default gen_random_uuid(), partner_id uuid references partners(id),
 kind text not null check(kind in ('CONTRIBUTION','DISTRIBUTION')), amount numeric(12,2) not null,
 note text, created_at timestamptz default now()
);

create table ledger_accounts(
 id uuid primary key default gen_random_uuid(), code text unique not null, name text not null,
 account_type text not null check(account_type in ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE'))
);
create table journal_entries(
 id uuid primary key default gen_random_uuid(), entry_date date default current_date,
 reference_type text, reference_id uuid, memo text, posted boolean default true, created_at timestamptz default now()
);
create table journal_lines(
 id uuid primary key default gen_random_uuid(), entry_id uuid references journal_entries(id) on delete cascade,
 account_id uuid references ledger_accounts(id), debit numeric(12,2) default 0 check(debit>=0),
 credit numeric(12,2) default 0 check(credit>=0), check(not(debit>0 and credit>0))
);
create table expenses(
 id uuid primary key default gen_random_uuid(), expense_date date default current_date, vendor text,
 category text, description text, amount numeric(12,2) not null, brand_id uuid references brands(id),
 receipt_url text, created_by uuid references auth.users(id), created_at timestamptz default now()
);
create table payouts(
 id uuid primary key default gen_random_uuid(), provider text default 'stripe', provider_payout_id text unique,
 gross numeric(12,2), fees numeric(12,2), net numeric(12,2), status text, arrival_date date
);
create table audit_log(
 id bigint generated always as identity primary key, actor_id uuid references auth.users(id),
 action text not null, entity_type text, entity_id uuid, before_data jsonb, after_data jsonb,
 created_at timestamptz default now()
);

insert into ledger_accounts(code,name,account_type) values
('1000','Cash / Bank','ASSET'),('1010','Stripe Clearing','ASSET'),('1200','Inventory','ASSET'),
('2000','Sales Tax Payable','LIABILITY'),('3000','Owner Equity','EQUITY'),
('4000','Product Sales','REVENUE'),('4010','Shipping Income','REVENUE'),
('5000','Cost of Goods Sold','EXPENSE'),('5100','Payment Processing Fees','EXPENSE'),
('5200','Shipping Expense','EXPENSE') on conflict do nothing;

-- RLS
alter table profiles enable row level security;
alter table addresses enable row level security;
alter table orders enable row level security;
alter table products enable row level security;
alter table brands enable row level security;
create policy "public active products" on products for select using(active=true);
create policy "public active brands" on brands for select using(active=true);
create policy "own profile" on profiles for select using(auth.uid()=id);
create policy "own addresses" on addresses for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "own orders" on orders for select using(auth.uid()=customer_id);

-- New-user profile
create or replace function public.handle_new_user() returns trigger language plpgsql security definer as $$
begin insert into public.profiles(id,full_name) values(new.id,coalesce(new.raw_user_meta_data->>'full_name','')); return new; end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Seed 50/50 ownership (replace names in Admin)
insert into partners(display_name,ownership_percent) values ('Partner A',50),('Partner B',50);

-- KARIA live-admin additions
insert into storage.buckets(id,name,public) values ('product-media','product-media',true) on conflict(id) do update set public=true;
insert into storage.buckets(id,name,public) values ('brand-logos','brand-logos',true) on conflict(id) do update set public=true;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles where id=auth.uid() and role in ('admin','super_admin'));
$$;

create policy "admins profiles" on profiles for select using(public.is_admin());
create policy "admins products all" on products for all using(public.is_admin()) with check(public.is_admin());
create policy "admins brands all" on brands for all using(public.is_admin()) with check(public.is_admin());

alter table product_media enable row level security;
alter table inventory_movements enable row level security;
alter table order_items enable row level security;
alter table partners enable row level security;
alter table expenses enable row level security;
alter table journal_entries enable row level security;
alter table journal_lines enable row level security;
create policy "public media" on product_media for select using(true);
create policy "admins media" on product_media for all using(public.is_admin()) with check(public.is_admin());
create policy "admins inventory" on inventory_movements for all using(public.is_admin()) with check(public.is_admin());
create policy "admins order items" on order_items for select using(public.is_admin());
create policy "admins partners" on partners for all using(public.is_admin()) with check(public.is_admin());
create policy "admins expenses" on expenses for all using(public.is_admin()) with check(public.is_admin());
create policy "admins journals" on journal_entries for all using(public.is_admin()) with check(public.is_admin());
create policy "admins journal lines" on journal_lines for all using(public.is_admin()) with check(public.is_admin());
create policy "admin upload product media" on storage.objects for insert to authenticated with check(bucket_id='product-media' and public.is_admin());
create policy "admin update product media" on storage.objects for update to authenticated using(bucket_id='product-media' and public.is_admin());
create policy "admin delete product media" on storage.objects for delete to authenticated using(bucket_id='product-media' and public.is_admin());
create policy "public read product media" on storage.objects for select using(bucket_id in ('product-media','brand-logos'));
