-- KARIA V7.61 — the striped bags with the crocheted yarn handle are the "Amelia" style.
-- "Chocolate Stripe Bag" -> "Amelia Bag · Chocolate" (the Camel Crochet Tote, with wooden handles, is a different style and stays).
-- Safe to run twice: already renamed bags no longer end with " Stripe Bag".
update public.products
set name = 'Amelia Bag · ' || regexp_replace(name, '\s+Stripe Bag$', '', 'i')
where name ~* '\s+Stripe Bag$';

select sku, name from public.products order by sku;
