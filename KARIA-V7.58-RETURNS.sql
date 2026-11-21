-- KARIA V7.58 — Returns: customers ask for a return in My orders, admins approve, receive the bag and refund in Stripe.
-- Safe to run twice. Needs V7.48 (stock on paid) and V7.49 (stock back on cancel/refund) already run.
-- The refund itself is done by the Edge Function "refund-return" (Stripe + stock + order status).

-- 1) Table
create table if not exists public.return_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_id uuid default auth.uid(),
  status text not null default 'requested' check (status in ('requested','approved','declined','received','refunded')),
  items jsonb not null,                 -- [{order_item_id, product_id, name, qty, unit_price}] — rebuilt from order_items on insert
  reason text not null,
  note text,
  photo_paths text[] not null default '{}',  -- files in the private bucket return-photos, "<customer id>/<...>"
  return_tracking text,
  refund_amount numeric(12,2),
  refund_shipping boolean not null default false,
  stripe_refund_id text,
  history jsonb not null default '[]',  -- [{status, at, by}]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_return_requests_order on public.return_requests (order_id);
create index if not exists idx_return_requests_status on public.return_requests (status, created_at desc);
-- one open return per order (a declined or refunded one does not block a new one)
create unique index if not exists return_requests_one_open on public.return_requests (order_id)
  where status in ('requested','approved','received');

-- 2) Can the signed-in customer return this order? Own order, shipped or delivered, and inside the returns window
--    (days from Settings, default 14) plus 21 days for the trip, counted from the order date.
create or replace function public.karia_can_return(p_order uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.orders o
    where o.id = p_order
      and o.customer_id = auth.uid()
      and o.status::text in ('shipped','delivered')
      and o.created_at > now() - make_interval(days => coalesce(
        (select nullif(value->>'returns_days','')::numeric::int from public.settings where key = 'storefront'),
        (select nullif(value->>'returns_days','')::numeric::int from public.settings where key = 'legal'),
        14) + 21));
$$;
revoke all on function public.karia_can_return(uuid) from public;
grant execute on function public.karia_can_return(uuid) to authenticated;

-- 3) Before insert: never trust what the browser sends. Items are rebuilt from the order's own lines (real price,
--    quantity capped by what was bought minus what other returns already took), photos must be the customer's own
--    folder (max 3), and the first history entry is written here.
create or replace function public.karia_return_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_items jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'order_item_id', oi.id, 'product_id', oi.product_id,
           'name', coalesce(p.name, 'Bag'), 'qty', q.qty, 'unit_price', oi.unit_price) order by p.name), '[]'::jsonb)
    into v_items
  from (
    select (e->>'order_item_id')::uuid as order_item_id, max(greatest(1, coalesce((e->>'qty')::int, 1))) as wanted
    from jsonb_array_elements(case when jsonb_typeof(new.items) = 'array' then new.items else '[]'::jsonb end) e
    where (e->>'order_item_id') ~* '^[0-9a-f-]{36}$'
    group by 1
  ) w
  join public.order_items oi on oi.id = w.order_item_id and oi.order_id = new.order_id
  left join public.products p on p.id = oi.product_id
  cross join lateral (
    select least(w.wanted, oi.qty - coalesce((
      select sum((x->>'qty')::int) from public.return_requests r, jsonb_array_elements(r.items) x
      where r.order_id = new.order_id and r.status <> 'declined' and (x->>'order_item_id')::uuid = oi.id), 0)) as qty
  ) q
  where q.qty > 0;
  if jsonb_array_length(v_items) = 0 then
    raise exception 'Choose at least one bag that has not been returned yet.';
  end if;
  new.items := v_items;
  new.reason := left(trim(coalesce(new.reason, '')), 80);
  new.note := nullif(left(trim(coalesce(new.note, '')), 2000), '');
  new.photo_paths := coalesce((select array_agg(x) from (
      select x from unnest(coalesce(new.photo_paths, '{}')) x
      where new.customer_id is not null and x like new.customer_id::text || '/%' limit 3) s), '{}');
  new.history := jsonb_build_array(jsonb_build_object('status', new.status, 'at', now(),
                   'by', case when public.is_admin() then 'admin' else 'customer' end));
  new.created_at := now();
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists karia_return_before_insert on public.return_requests;
create trigger karia_return_before_insert before insert on public.return_requests
  for each row execute function public.karia_return_before_insert();

-- 4) Before update: keep updated_at and add a history line on every status change.
create or replace function public.karia_return_before_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then
    new.history := coalesce(old.history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('status', new.status, 'at', now(),
      'by', coalesce((select coalesce(nullif(trim(full_name), ''), 'admin') from public.profiles where id = auth.uid()), 'KARIA')));
  end if;
  return new;
end $$;
drop trigger if exists karia_return_before_update on public.return_requests;
create trigger karia_return_before_update before update on public.return_requests
  for each row execute function public.karia_return_before_update();

-- 5) Row level security: customers read their own and create a fresh request; only admins change anything.
alter table public.return_requests enable row level security;
grant select, insert, update, delete on public.return_requests to authenticated;
do $$ begin
  create policy "customers read own returns" on public.return_requests for select to authenticated
    using (customer_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "customers request a return" on public.return_requests for insert to authenticated
    with check (customer_id = auth.uid() and status = 'requested' and public.karia_can_return(order_id)
                and refund_amount is null and stripe_refund_id is null and refund_shipping = false and return_tracking is null);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "admin returns all" on public.return_requests for all to authenticated
    using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;

-- 6) A partial return (refund-return writes RETURN rows for the returned bags only) must not stop the rest of the
--    order's stock from coming back if the order is later cancelled/refunded: put back only what is still out.
create or replace function public.karia_cancelled_order_stock() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(old.status::text, '') in ('paid','processing','shipped','delivered')
     and new.status::text in ('cancelled','refunded') then
    insert into public.inventory_movements (product_id, qty, movement_type, reference_type, reference_id, note)
    select m.product_id, m.out_qty - m.back_qty, 'RETURN', 'order', new.id, 'Return · order #' || coalesce(new.order_number::text, '')
    from (
      select product_id,
             sum(abs(qty)) filter (where movement_type::text = 'OUT') as out_qty,
             coalesce(sum(abs(qty)) filter (where movement_type::text = 'RETURN'), 0) as back_qty
      from public.inventory_movements
      where reference_id = new.id and movement_type::text in ('OUT','RETURN')
      group by product_id
    ) m
    where m.out_qty - m.back_qty > 0;
  end if;
  return new;
end $$;

-- 7) Private bucket for the customers' photos (damaged / wrong item). Files: "<customer id>/<return>/<n>.jpg".
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('return-photos', 'return-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg'];
do $$ begin
  create policy "customers upload return photos" on storage.objects for insert to authenticated
    with check (bucket_id = 'return-photos' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "owner and admin read return photos" on storage.objects for select to authenticated
    using (bucket_id = 'return-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "admin delete return photos" on storage.objects for delete to authenticated
    using (bucket_id = 'return-photos' and public.is_admin());
exception when duplicate_object then null; end $$;

-- Checks (read the results)
select to_regclass('public.return_requests') is not null as returns_table_ok,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'return_requests') as table_policies,
  (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
     and (qual ilike '%return-photos%' or with_check ilike '%return-photos%')) as photo_policies,
  (select public from storage.buckets where id = 'return-photos') as bucket_is_public,
  (select string_agg(tgname, ', ') from pg_trigger where tgrelid = 'public.return_requests'::regclass and not tgisinternal) as triggers,
  has_function_privilege('authenticated', 'public.karia_can_return(uuid)', 'execute') as can_return_granted;
