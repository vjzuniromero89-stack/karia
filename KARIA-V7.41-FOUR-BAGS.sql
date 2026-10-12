-- KARIA V7.41 — adds four more colors of the stripe bag to the Shop.
-- Safe to run twice. Stock starts at 0, so they show SOLD OUT until you post their inventory in Admin > Inventory.
-- Price is copied from the other stripe bags ($40.00); change it in Admin > Products > Edit if it is different.

insert into public.products (name, slug, sku, description, price, unit_cost, category, weight, low_stock_threshold, active, featured)
select c.name || ' Stripe Bag', c.slug || '-stripe-bag', c.sku,
  c.intro || E' Two cream stripes create a timeless contrast, while the matching woven handle and gold-tone rings complete its elegant design.\nColor: ' || c.color || E' and cream.\nMaterial: Chunky textile yarn; exact fiber composition to be confirmed.\nDesign: Crochet texture with two horizontal cream stripes.\nHandle: Short, matching crochet handle.\nHardware: Gold-tone rings.',
  40.00, 0, 'Bags & Handbags', 1.000, 2, true, false
from (values
 ('Turquoise',  'turquoise',  'k10', 'Turquoise',     'Bright as the sea, this turquoise crochet handbag brings a splash of color to your day.'),
 ('Mustard',    'mustard',    'k11', 'Mustard yellow','Golden and warm, this mustard crochet handbag lights up any outfit.'),
 ('Pearl Gray', 'pearl-gray', 'k12', 'Pearl gray',    'Calm and easy to wear, this pearl gray crochet handbag pairs with everything.'),
 ('Emerald',    'emerald',    'k13', 'Emerald green', 'Rich and vivid, this emerald crochet handbag makes a quiet statement.')
) as c(name, slug, sku, color, intro)
on conflict (sku) do nothing;

-- photos (served by the site itself, from /public/products): whole scene first, close-up second
insert into public.product_media (product_id, url, media_type, sort_order)
select p.id, '/products/' || p.slug || s.suffix, 'image', s.sort_order
from public.products p
cross join (values ('.jpg', 0), ('-scene.jpg', 1)) as s(suffix, sort_order)
where p.sku in ('k10','k11','k12','k13')
  and not exists (select 1 from public.product_media x where x.product_id = p.id and x.url = '/products/' || p.slug || s.suffix);
