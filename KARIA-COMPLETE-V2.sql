-- KARIA COMPLETE V2 — run after previous KARIA schema + KARIA-FULL-OPERATIONS.sql
create extension if not exists pgcrypto;
alter table public.profiles add column if not exists disabled boolean not null default false;
alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.products add column if not exists compare_at_price numeric(12,2);
alter table public.products add column if not exists seo_title text;
alter table public.products add column if not exists seo_description text;
alter table public.products add column if not exists weight numeric(12,3);
alter table public.products add column if not exists low_stock_threshold integer default 2;
alter table public.orders add column if not exists processor_fee numeric(12,2) default 0;
alter table public.orders add column if not exists tracking_number text;
alter table public.orders add column if not exists carrier text;
alter table public.orders add column if not exists notes text;
alter table public.orders add column if not exists currency text default 'usd';

create table if not exists public.settings(key text primary key,value jsonb not null default '{}'::jsonb,updated_at timestamptz default now());
create table if not exists public.material_movements(id uuid primary key default gen_random_uuid(),material_id uuid references public.materials(id),qty numeric(12,3) not null,movement_type text not null,reference_type text,reference_id uuid,note text,actor_id uuid references auth.users(id),created_at timestamptz default now());
create table if not exists public.refunds(id uuid primary key default gen_random_uuid(),order_id uuid references public.orders(id),amount numeric(12,2) not null,reason text,stripe_refund_id text,created_at timestamptz default now());
create table if not exists public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),kind text not null,title text not null,body text,read_at timestamptz,created_at timestamptz default now());
create table if not exists public.shipping_zones(id uuid primary key default gen_random_uuid(),name text not null,countries text[] default array['US'],flat_rate numeric(12,2) default 0,free_over numeric(12,2),active boolean default true);
create table if not exists public.wishlists(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete cascade,product_id uuid references public.products(id) on delete cascade,created_at timestamptz default now(),unique(user_id,product_id));

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from profiles where id=auth.uid() and role in ('staff','admin','super_admin') and coalesce(disabled,false)=false)$$;
create or replace function public.is_super_admin() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from profiles where id=auth.uid() and role='super_admin' and coalesce(disabled,false)=false)$$;

alter table public.product_media enable row level security; alter table public.brands enable row level security; alter table public.products enable row level security; alter table public.orders enable row level security; alter table public.order_items enable row level security; alter table public.inventory_movements enable row level security; alter table public.production_orders enable row level security; alter table public.expenses enable row level security; alter table public.settings enable row level security;

do $$ begin create policy "public active brands" on public.brands for select using(active=true or public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "public active products" on public.products for select using(active=true or public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "public product media" on public.product_media for select using(true); exception when duplicate_object then null; end $$;
do $$ begin create policy "admin brands write" on public.brands for all using(public.is_admin()) with check(public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "admin products write" on public.products for all using(public.is_admin()) with check(public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "admin media write" on public.product_media for all using(public.is_admin()) with check(public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "admin inventory" on public.inventory_movements for all using(public.is_admin()) with check(public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "admin production" on public.production_orders for all using(public.is_admin()) with check(public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "admin expenses" on public.expenses for all using(public.is_admin()) with check(public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "admin all orders" on public.orders for select using(public.is_admin() or customer_id=auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create policy "customer own order items" on public.order_items for select using(public.is_admin() or exists(select 1 from orders o where o.id=order_id and o.customer_id=auth.uid())); exception when duplicate_object then null; end $$;
do $$ begin create policy "admin settings" on public.settings for all using(public.is_admin()) with check(public.is_admin()); exception when duplicate_object then null; end $$;

insert into storage.buckets(id,name,public) values ('product-media','product-media',true),('brand-logos','brand-logos',true),('receipts','receipts',false) on conflict(id) do nothing;
do $$ begin create policy "read public store media" on storage.objects for select using(bucket_id in ('product-media','brand-logos')); exception when duplicate_object then null; end $$;
do $$ begin create policy "admin upload store media" on storage.objects for insert with check(bucket_id in ('product-media','brand-logos','receipts') and public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "admin update store media" on storage.objects for update using(bucket_id in ('product-media','brand-logos','receipts') and public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "admin delete store media" on storage.objects for delete using(bucket_id in ('product-media','brand-logos','receipts') and public.is_admin()); exception when duplicate_object then null; end $$;

insert into public.settings(key,value) values
('store', '{"name":"KARIA","currency":"USD","ownership":"50/50"}'::jsonb),
('shipping', '{"free_shipping_over":150,"default_rate":10}'::jsonb),
('legal', '{"returns_days":14}'::jsonb)
on conflict(key) do nothing;

-- Atomic fulfillment/accounting posting for a paid order.
create or replace function public.post_paid_order(p_order_id uuid,p_payment_intent text default null)
returns void language plpgsql security definer set search_path=public as $$
declare o orders%rowtype; it record; v_cogs numeric:=0; v_entry uuid; a_stripe uuid; a_sales uuid; a_inv uuid; a_cogs uuid; a_tax uuid;
begin
 select * into o from orders where id=p_order_id for update; if not found then raise exception 'Order not found'; end if;
 if o.status in ('paid','processing','shipped','delivered') then return; end if;
 update orders set status='paid',stripe_payment_intent=coalesce(p_payment_intent,stripe_payment_intent),updated_at=now() where id=p_order_id;
 for it in select * from order_items where order_id=p_order_id loop
   insert into inventory_movements(product_id,variant_id,qty,movement_type,reference_type,reference_id,note) values(it.product_id,it.variant_id,it.qty,'OUT','order',p_order_id,'Automatic sale fulfillment');
   v_cogs:=v_cogs+(it.qty*it.unit_cost);
 end loop;
 select id into a_stripe from ledger_accounts where code='1010'; select id into a_sales from ledger_accounts where code='4000'; select id into a_inv from ledger_accounts where code='1200'; select id into a_tax from ledger_accounts where code='2000';
 select id into a_cogs from ledger_accounts where code='5000'; if a_cogs is null then insert into ledger_accounts(code,name,account_type) values('5000','Cost of Goods Sold','EXPENSE') returning id into a_cogs; end if;
 insert into journal_entries(reference_type,reference_id,memo) values('order',p_order_id,'Stripe sale') returning id into v_entry;
 insert into journal_lines(entry_id,account_id,debit,credit) values(v_entry,a_stripe,o.total,0),(v_entry,a_sales,0,o.subtotal-o.discount);
 if coalesce(o.tax,0)>0 then insert into journal_lines(entry_id,account_id,debit,credit) values(v_entry,a_tax,0,o.tax); end if;
 if v_cogs>0 then insert into journal_lines(entry_id,account_id,debit,credit) values(v_entry,a_cogs,v_cogs,0),(v_entry,a_inv,0,v_cogs); end if;
end $$;
revoke all on function public.post_paid_order(uuid,text) from public,anon,authenticated;
