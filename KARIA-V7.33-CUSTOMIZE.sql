-- KARIA V7.33 — CUSTOMIZE (3D bag configurator)
-- Run once in Supabase → SQL Editor. Safe to run again (idempotent).

-- 1) Order lines can carry the full custom-bag recipe (style + color of every part)
alter table public.order_items add column if not exists customization jsonb;

-- 2) Yarn palette
create table if not exists public.customize_colors(
 id text primary key,
 name text not null,
 hex text not null,
 active boolean not null default true,      -- false = sold out (hidden from customers)
 sort_order int not null default 0,
 created_at timestamptz default now()
);

-- 3) Styles (the 10 built-in designs + any stripe styles created from Admin)
create table if not exists public.customize_styles(
 id text primary key,
 name text not null,
 sub text,
 kind text not null default 'bands',        -- bands | vertical | diagonal | block
 bands jsonb,                                -- for admin-created stripe styles
 extra_price numeric(12,2) not null default 0,
 active boolean not null default true,
 allowed_colors text[],                      -- null = every active color
 sort_order int not null default 0,
 created_at timestamptz default now()
);

-- 4) Global settings (single row)
create table if not exists public.customize_config(
 id int primary key default 1 check (id=1),
 enabled boolean not null default true,
 customization_fee numeric(12,2) not null default 0,
 lead_time text,
 updated_at timestamptz default now()
);

alter table public.customize_colors enable row level security;
alter table public.customize_styles enable row level security;
alter table public.customize_config enable row level security;

drop policy if exists "public read customize colors" on public.customize_colors;
create policy "public read customize colors" on public.customize_colors for select using (true);
drop policy if exists "admin write customize colors" on public.customize_colors;
create policy "admin write customize colors" on public.customize_colors for all to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('staff','admin','super_admin') and coalesce(p.disabled,false)=false)) with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('staff','admin','super_admin') and coalesce(p.disabled,false)=false));

drop policy if exists "public read customize styles" on public.customize_styles;
create policy "public read customize styles" on public.customize_styles for select using (true);
drop policy if exists "admin write customize styles" on public.customize_styles;
create policy "admin write customize styles" on public.customize_styles for all to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('staff','admin','super_admin') and coalesce(p.disabled,false)=false)) with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('staff','admin','super_admin') and coalesce(p.disabled,false)=false));

drop policy if exists "public read customize config" on public.customize_config;
create policy "public read customize config" on public.customize_config for select using (true);
drop policy if exists "admin write customize config" on public.customize_config;
create policy "admin write customize config" on public.customize_config for all to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('staff','admin','super_admin') and coalesce(p.disabled,false)=false)) with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('staff','admin','super_admin') and coalesce(p.disabled,false)=false));

-- 5) Seed data
insert into public.customize_colors(id,name,hex,sort_order) values
 ('black','Black','#1c1c1e',0),
 ('carbon-gray','Carbon Gray','#3b3c40',1),
 ('dark-grey','Dark Grey','#86888b',2),
 ('light-green','Light Green','#b8bbb6',3),
 ('coffee','Coffee','#4a2a1c',4),
 ('brown','Brown','#7a5240',5),
 ('dark-khaki','Dark Khaki','#b8a27f',6),
 ('dark-green','Dark Green','#1e3a33',7),
 ('denim-blue','Denim Blue','#1f4e7a',8),
 ('violets','Violets','#5a2a6d',9),
 ('sapphire-blue','Sapphire Blue','#1d5fc0',10),
 ('lake-blue','Lake Blue','#2e99c8',11),
 ('peacock-green','Peacock Green','#128f88',12),
 ('grass-green','Grass Green','#2e983a',13),
 ('lime-green','Lime Green','#86b23a',14),
 ('burgundy','Burgundy','#6d1024',15),
 ('red','Red','#d01c2b',16),
 ('rose','Rose','#e0217a',17),
 ('orange','Orange','#f06a1c',18),
 ('gray-pink','Gray Pink','#d9adba',19),
 ('milky-white','Milky White','#efeae0',20),
 ('light-tan','Light Tan','#e3c2a2',21),
 ('golden-yellow','Golden Yellow','#eeb41f',22),
 ('mint-green','Mint Green','#8fdfcb',23)
on conflict (id) do nothing;

insert into public.customize_styles(id,name,sub,kind,sort_order) values
 ('classic-double','Classic Double Stripe','Dos rayas horizontales','bands',0),
 ('multi-stripe','Multi Stripe','Rayas múltiples','bands',1),
 ('vertical-stripe','Vertical Stripe','Rayas verticales','vertical',2),
 ('wide-stripe','Wide Stripe','Raya ancha central','bands',3),
 ('asymmetric-stripe','Asymmetric Stripe','Rayas asimétricas','bands',4),
 ('framed-stripe','Framed Stripe','Doble raya enmarcada','bands',5),
 ('diagonal-stripe','Diagonal Stripe','Rayas diagonales','diagonal',6),
 ('triple-stripe','Triple Stripe','Tres rayas','bands',7),
 ('border-stripe','Border Stripe','Raya con borde','bands',8),
 ('block-stripe','Block Stripe','Rayas en bloques','block',9)
on conflict (id) do nothing;

insert into public.customize_config(id,enabled,customization_fee,lead_time)
values (1,true,0,'Handmade to order · ships in 7–10 days')
on conflict (id) do nothing;

-- 6) The base product every custom bag is sold as (hidden from Shop/New by the storefront).
--    Change the base price later in Admin → Customize.
insert into public.products(name,slug,sku,description,materials,price,unit_cost,active)
values ('KARIA Custom Bag','karia-custom-bag','KARIA-CUSTOM-BAG','Made-to-order crochet bag designed by the customer in KARIA Customize.','T-shirt yarn (polyester/spandex) · metal rings',118,0,true)
on conflict (sku) do nothing;

notify pgrst, 'reload schema';
