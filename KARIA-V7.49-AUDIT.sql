-- KARIA V7.49 — audit fixes (database side). Safe to run twice.
-- Order: KARIA-V7.42-REVIEWS.sql first, then this file. (If V7.42 was not run, step 4 is skipped.)

-- 1) Coupons: nobody can list codes any more. The store checks one code at a time with check_coupon().
alter table public.coupons add column if not exists max_uses integer;  -- 2) null = unlimited
drop policy if exists "public active coupons read" on public.coupons;
drop policy if exists public_read_active_coupons on public.coupons;  -- the same rule under its production name (found 2026-11-21)
do $$ begin create policy "admin coupons all" on public.coupons for all using (public.is_admin()) with check (public.is_admin()); exception when duplicate_object then null; end $$;

create or replace function public.check_coupon(p_code text)
returns table(code text, percent_off numeric, amount_off numeric)
language sql stable security definer set search_path = public as $$
  select c.code::text, c.percent_off::numeric, c.amount_off::numeric
  from public.coupons c
  where c.code = upper(trim(p_code))
    and c.active
    and (c.starts_at is null or c.starts_at <= now())
    and (c.ends_at is null or c.ends_at >= now())
    and (c.max_uses is null or (
      select count(*) from public.orders o
      where o.coupon_code = c.code and o.status::text in ('paid','processing','shipped','delivered')
    ) < c.max_uses);
$$;
revoke all on function public.check_coupon(text) from public;
grant execute on function public.check_coupon(text) to anon, authenticated;

-- 3) A paid order that is cancelled or refunded puts its pieces back in stock (once per order).
--    Mirrors the OUT rows written by V7.48, so custom bags (never taken out) are never returned.
create or replace function public.karia_cancelled_order_stock() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(old.status::text, '') in ('paid','processing','shipped','delivered')
     and new.status::text in ('cancelled','refunded')
     and exists (select 1 from public.inventory_movements where reference_id = new.id and movement_type::text = 'OUT')
     and not exists (select 1 from public.inventory_movements where reference_id = new.id and movement_type::text = 'RETURN') then
    insert into public.inventory_movements (product_id, qty, movement_type, reference_type, reference_id, note)
    select m.product_id, abs(m.qty), 'RETURN', 'order', new.id, 'Return · order #' || coalesce(new.order_number::text, '')
    from public.inventory_movements m
    where m.reference_id = new.id and m.movement_type::text = 'OUT';
  end if;
  return new;
end $$;
drop trigger if exists karia_cancelled_order_stock on public.orders;
create trigger karia_cancelled_order_stock
  after update of status on public.orders
  for each row execute function public.karia_cancelled_order_stock();

-- 4) Reviews: only customers who bought the bag (paid or later) can write or edit a review.
create or replace function public.karia_has_purchased(p_product_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.orders o join public.order_items oi on oi.order_id = o.id
    where o.customer_id = auth.uid() and oi.product_id = p_product_id
      and o.status::text in ('paid','processing','shipped','delivered'));
$$;
revoke all on function public.karia_has_purchased(uuid) from public;
grant execute on function public.karia_has_purchased(uuid) to authenticated;

do $$ begin
  if to_regclass('public.product_reviews') is null then
    raise notice 'product_reviews not found: run KARIA-V7.42-REVIEWS.sql, then run this file again';
    return;
  end if;
  drop policy if exists "customers write their own review" on public.product_reviews;
  create policy "customers write their own review" on public.product_reviews for insert to authenticated
    with check (user_id = auth.uid() and approved and public.karia_has_purchased(product_id));
  drop policy if exists "customers edit their own review" on public.product_reviews;
  create policy "customers edit their own review" on public.product_reviews for update to authenticated
    using (user_id = auth.uid() and approved)
    with check (user_id = auth.uid() and approved and public.karia_has_purchased(product_id));
end $$;

-- 5) Admin access needed by the Admin panel. Each policy is added only if no admin policy covers it yet.
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'product_media'
                 and cmd = 'ALL' and qual ilike '%is_admin%') then
    create policy "admin product media all" on public.product_media for all to authenticated
      using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'inventory_movements'
                 and cmd in ('ALL','DELETE') and qual ilike '%is_admin%') then
    create policy "admin inventory all" on public.inventory_movements for all to authenticated
      using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                 and cmd in ('ALL','DELETE') and qual ilike '%product-media%' and qual ilike '%is_admin%') then
    create policy "admin delete media" on storage.objects for delete to authenticated
      using (bucket_id in ('product-media','brand-logos','receipts') and public.is_admin());
  end if;
end $$;

-- 6) Remove the placeholder sentence from product texts ("Chunky textile yarn; exact fiber ..." -> "Chunky textile yarn").
update public.products
set description = regexp_replace(description, ';\s*exact fiber composition to be confirmed', '', 'gi'),
    materials   = regexp_replace(materials,   ';\s*exact fiber composition to be confirmed', '', 'gi')
where description ~* 'exact fiber composition to be confirmed'
   or materials   ~* 'exact fiber composition to be confirmed';

-- 7a) Contact form: at most 3 messages per email per hour.
create index if not exists idx_contact_messages_email_time on public.contact_messages (lower(email), created_at desc);
create or replace function public.karia_contact_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.contact_messages
      where lower(email) = lower(new.email) and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Too many messages from this email. Please try again later.';
  end if;
  return new;
end $$;
drop trigger if exists karia_contact_rate_limit on public.contact_messages;
create trigger karia_contact_rate_limit before insert on public.contact_messages
  for each row execute function public.karia_contact_rate_limit();

-- 7b) Newsletter: one row per email, whatever the capital letters (duplicates return 23505, which the store treats as "already subscribed").
create or replace function public.karia_newsletter_normalize() returns trigger
language plpgsql set search_path = public as $$
begin
  new.email := lower(trim(new.email));
  return new;
end $$;
drop trigger if exists karia_newsletter_normalize on public.newsletter_subscribers;
create trigger karia_newsletter_normalize before insert on public.newsletter_subscribers
  for each row execute function public.karia_newsletter_normalize();
do $$ begin
  if exists (select 1 from public.newsletter_subscribers group by lower(email) having count(*) > 1) then
    raise notice 'Newsletter has the same email in different capitals: delete the extra rows in Admin, then run this file again';
  else
    create unique index if not exists newsletter_subscribers_email_lower on public.newsletter_subscribers (lower(email));
  end if;
end $$;

-- 8) The storefront (signed in or not) reads only the 'shipping' and 'storefront' settings. Every other key stays admin-only.
alter table public.settings enable row level security;
grant select on public.settings to anon, authenticated;
do $$ begin
  create policy "public read shipping and storefront settings" on public.settings for select to anon, authenticated
    using (key in ('shipping','storefront'));
exception when duplicate_object then null; end $$;

-- Checks (read the results)
select tablename, policyname, cmd, roles, qual
from pg_policies
where (schemaname = 'public' and tablename in ('coupons','settings','product_reviews','product_media','inventory_movements'))
   or (schemaname = 'storage' and tablename = 'objects')
order by tablename, policyname;

select p.proname, p.prosecdef as security_definer, has_function_privilege('anon', p.oid, 'execute') as anon_can_run
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('check_coupon','karia_has_purchased','karia_cancelled_order_stock','karia_contact_rate_limit');

select tgname, tgrelid::regclass as on_table
from pg_trigger
where tgname in ('karia_paid_order_stock','karia_cancelled_order_stock','karia_contact_rate_limit','karia_newsletter_normalize');

select count(*) as products_still_with_placeholder
from public.products
where description ~* 'exact fiber composition' or materials ~* 'exact fiber composition';
