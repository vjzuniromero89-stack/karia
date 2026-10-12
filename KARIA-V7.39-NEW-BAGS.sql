-- KARIA V7.39 — adds the Olive and Sand stripe bags to the Shop.
-- Safe to run twice. Stock starts at 0, so both show SOLD OUT until you post their inventory in Admin > Inventory.
-- Price is copied from "bolso k" ($40.00); change it in Admin > Products > Edit if it is different.

insert into public.products (name, slug, sku, description, price, unit_cost, category, weight, low_stock_threshold, active, featured)
values
 ('Olive Stripe Bag', 'olive-stripe-bag', 'k02',
  E'Bring a touch of green to your everyday look with this olive crochet handbag. Two cream stripes create a timeless contrast, while the matching woven handle and gold-tone rings complete its elegant design.\nColor: Olive green and cream.\nMaterial: Chunky textile yarn; exact fiber composition to be confirmed.\nDesign: Crochet texture with two horizontal cream stripes.\nHandle: Short, matching crochet handle.\nHardware: Gold-tone rings.',
  40.00, 0, 'Bags & Handbags', 1.000, 2, true, false),
 ('Sand Stripe Bag', 'sand-stripe-bag', 'k03',
  E'A soft neutral for every season: this sand crochet handbag pairs with everything. Two cream stripes add a quiet contrast, while the matching woven handle and gold-tone rings complete its elegant design.\nColor: Sand and cream.\nMaterial: Chunky textile yarn; exact fiber composition to be confirmed.\nDesign: Crochet texture with two horizontal cream stripes.\nHandle: Short, matching crochet handle.\nHardware: Gold-tone rings.',
  40.00, 0, 'Bags & Handbags', 1.000, 2, true, false)
on conflict (sku) do nothing;

-- photos (served by the site itself, from /public/products)
insert into public.product_media (product_id, url, media_type, sort_order)
select p.id, m.url, 'image', m.sort_order
from public.products p
join (values
 ('k02', '/products/olive-stripe-bag.jpg', 0),
 ('k02', '/products/olive-stripe-bag-scene.jpg', 1),
 ('k03', '/products/sand-stripe-bag.jpg', 0),
 ('k03', '/products/sand-stripe-bag-scene.jpg', 1)
) as m(sku, url, sort_order) on m.sku = p.sku
where not exists (select 1 from public.product_media x where x.product_id = p.id and x.url = m.url);
