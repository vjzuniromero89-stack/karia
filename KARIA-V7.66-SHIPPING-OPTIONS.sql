-- KARIA V7.66 — shipping options at checkout (2026-11-21)
-- Standard shipping is now inside the bag price ($45 for Amelia and Aurora) and shows as Free.
-- Priority and Express are charged on top. create-checkout reads settings.shipping.methods.
alter table public.orders add column if not exists shipping_method text;

update public.settings
set value = value
  || jsonb_build_object(
       'methods', jsonb_build_array(
         jsonb_build_object('id','standard','name','Standard','service','USPS Ground Advantage','days','2–5 business days','price',0,'active',true),
         jsonb_build_object('id','priority','name','Priority','service','USPS Priority Mail','days','1–3 business days','price',16,'active',true),
         jsonb_build_object('id','express','name','Express','service','UPS 2nd Day Air','days','2 business days','price',48,'active',true)),
       'default_rate', 0,
       'free_shipping_over', 0),
    updated_at = now()
where key = 'shipping';

-- run 2026-11-21 as $40 → $52, then the owners chose $45 with shipping for both styles (same box and weight)
update public.products set price = 45 where style in ('Amelia','Aurora');

select sku, name, price from public.products order by sku;
