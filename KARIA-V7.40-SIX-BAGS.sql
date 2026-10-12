-- KARIA V7.40 — adds six more colors of the stripe bag to the Shop.
-- Safe to run twice. Stock starts at 0, so they show SOLD OUT until you post their inventory in Admin > Inventory.
-- Price is copied from the other stripe bags ($40.00); change it in Admin > Products > Edit if it is different.

insert into public.products (name, slug, sku, description, price, unit_cost, category, weight, low_stock_threshold, active, featured)
select c.name || ' Stripe Bag', lower(c.name) || '-stripe-bag', c.sku,
  c.intro || E' Two cream stripes create a timeless contrast, while the matching woven handle and gold-tone rings complete its elegant design.\nColor: ' || c.color || E' and cream.\nMaterial: Chunky textile yarn; exact fiber composition to be confirmed.\nDesign: Crochet texture with two horizontal cream stripes.\nHandle: Short, matching crochet handle.\nHardware: Gold-tone rings.',
  40.00, 0, 'Bags & Handbags', 1.000, 2, true, false
from (values
 ('Terracotta', 'k04', 'Terracotta', 'Warm as baked clay, this terracotta crochet handbag brings color to any outfit.'),
 ('Lavender',   'k05', 'Lavender',   'Soft and fresh, this lavender crochet handbag adds a gentle pop of color.'),
 ('Burgundy',   'k06', 'Burgundy',   'Deep and rich, this burgundy crochet handbag dresses up your everyday look.'),
 ('Navy',       'k07', 'Navy blue',  'A classic you will reach for every day: this navy crochet handbag goes with everything.'),
 ('Rose',       'k08', 'Rose pink',  'Sweet and bright, this rose crochet handbag adds a playful touch.'),
 ('Black',      'k09', 'Black',      'Bold and timeless, this black crochet handbag works from day to night.')
) as c(name, sku, color, intro)
on conflict (sku) do nothing;

-- photos (served by the site itself, from /public/products): whole scene first, close-up second
insert into public.product_media (product_id, url, media_type, sort_order)
select p.id, '/products/' || p.slug || s.suffix, 'image', s.sort_order
from public.products p
cross join (values ('.jpg', 0), ('-scene.jpg', 1)) as s(suffix, sort_order)
where p.sku in ('k04','k05','k06','k07','k08','k09')
  and not exists (select 1 from public.product_media x where x.product_id = p.id and x.url = '/products/' || p.slug || s.suffix);
