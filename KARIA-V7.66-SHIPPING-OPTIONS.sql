-- KARIA V7.66 — shipping options at checkout (2026-11-21)
-- Standard shipping is now inside the bag price ($40 + $12 = $52) and shows as Free.
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

-- only bags still at the old $40 price, so running this twice does nothing
update public.products set price = 52 where price = 40;

select sku, name, price from public.products order by sku;
