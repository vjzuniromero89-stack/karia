-- KARIA V7.44 — adds the Camel Crochet Tote (crochet body, brown resin handles) to the Shop.
-- Safe to run twice. Stock starts at 0, so it shows SOLD OUT until you post its inventory in Admin > Inventory.
-- The price is a placeholder copied from the stripe bags ($40.00): set the real one in Admin > Products > Edit.

insert into public.products (name, slug, sku, description, price, unit_cost, category, weight, low_stock_threshold, active, featured)
values ('Camel Crochet Tote', 'camel-crochet-tote', 'k14',
  E'A roomy crochet tote in warm camel, finished with glossy brown handles. The wide shape holds your everyday essentials and the solid color goes with everything.\nColor: Camel.\nMaterial: Chunky textile yarn; exact fiber composition to be confirmed.\nDesign: Solid crochet texture with a wide, open top.\nHandles: Two glossy brown D-shaped handles, wrapped in matching yarn.',
  40.00, 0, 'Bags & Handbags', 1.000, 2, true, false)
on conflict (sku) do nothing;

insert into public.product_media (product_id, url, media_type, sort_order)
select p.id, m.url, 'image', m.sort_order
from public.products p
cross join (values ('/products/camel-crochet-tote.jpg', 0), ('/products/camel-crochet-tote-scene.jpg', 1)) as m(url, sort_order)
where p.sku = 'k14'
  and not exists (select 1 from public.product_media x where x.product_id = p.id and x.url = m.url);
