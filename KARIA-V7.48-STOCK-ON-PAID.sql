-- KARIA V7.48 — a paid order takes its pieces out of inventory (once per order).
-- Done in the database because the stripe-webhook deployed in Supabase is newer than the one in this repo.
-- Custom bags are made to order and never touch stock. Safe to run twice.
create or replace function public.karia_paid_order_stock() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status::text = 'paid' and coalesce(old.status::text, '') <> 'paid'
     and not exists (select 1 from public.inventory_movements where reference_id = new.id) then
    insert into public.inventory_movements (product_id, qty, movement_type, reference_type, reference_id, note)
    select oi.product_id, oi.qty, 'OUT', 'order', new.id, 'Sale · order #' || coalesce(new.order_number::text, '')
    from public.order_items oi
    where oi.order_id = new.id and oi.product_id is not null and oi.customization is null;
  end if;
  return new;
end $$;

drop trigger if exists karia_paid_order_stock on public.orders;
create trigger karia_paid_order_stock
  after update of status on public.orders
  for each row execute function public.karia_paid_order_stock();
