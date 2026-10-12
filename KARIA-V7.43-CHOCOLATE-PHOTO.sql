-- KARIA V7.43 — the Chocolate bag uses the same kind of photo files as the other colors
-- (lighter than the 2 MB original, with a small copy for the home page) and gains a close-up as second photo.
delete from public.product_media where product_id = (select id from public.products where sku = 'k01');
insert into public.product_media (product_id, url, media_type, sort_order)
select p.id, m.url, 'image', m.sort_order
from public.products p
cross join (values ('/products/chocolate-stripe-bag.jpg', 0), ('/products/chocolate-stripe-bag-scene.jpg', 1)) as m(url, sort_order)
where p.sku = 'k01';
