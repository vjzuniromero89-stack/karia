-- KARIA V7.16.4 — Reliable Admin Product Delete
-- Run this entire script in Supabase SQL Editor.

create or replace function public.admin_delete_product(p_product_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sales bigint := 0;
  v_name text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select name into v_name from public.products where id=p_product_id;
  if v_name is null then
    return jsonb_build_object('success',false,'action','none','message','Product not found');
  end if;

  select count(*) into v_sales
  from public.order_items
  where product_id=p_product_id;

  -- Never destroy a product referenced by a sale: preserve order/accounting history.
  if v_sales > 0 then
    update public.products set active=false where id=p_product_id;
    return jsonb_build_object(
      'success',true,'action','archived',
      'message','Product archived because it has sales history'
    );
  end if;

  -- Remove non-financial dependencies that can block the product FK.
  delete from public.inventory_movements where product_id=p_product_id;

  -- These tables exist in the KARIA schema. Production is no longer used in the UI,
  -- but old rows can still exist and otherwise block deletion.
  delete from public.production_materials
  where production_id in (
    select id from public.production_orders where product_id=p_product_id
  );
  delete from public.production_orders where product_id=p_product_id;

  -- Product variants/media are normally ON DELETE CASCADE, but explicitly removing
  -- them makes deletion reliable across older KARIA schema versions.
  delete from public.product_variants where product_id=p_product_id;
  delete from public.product_media where product_id=p_product_id;

  -- Optional newer KARIA relation. Dynamic SQL keeps this migration compatible
  -- with databases created before product_materials existed.
  if to_regclass('public.product_materials') is not null then
    execute 'delete from public.product_materials where product_id=$1' using p_product_id;
  end if;

  delete from public.products where id=p_product_id;

  if found then
    return jsonb_build_object(
      'success',true,'action','deleted',
      'message','Product permanently deleted'
    );
  end if;

  return jsonb_build_object('success',false,'action','none','message','Product delete affected no rows');
end;
$$;

revoke all on function public.admin_delete_product(uuid) from public;
grant execute on function public.admin_delete_product(uuid) to authenticated;
