-- KARIA V7.16.3 — Product delete/archive permissions
-- Safe to run in Supabase SQL Editor.

-- Existing KARIA helper public.is_admin() is used by the rest of the Admin policies.
alter table public.products enable row level security;
alter table public.product_media enable row level security;
alter table public.inventory_movements enable row level security;

drop policy if exists "admin products all" on public.products;
create policy "admin products all"
on public.products for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin product media all" on public.product_media;
create policy "admin product media all"
on public.product_media for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin inventory all" on public.inventory_movements;
create policy "admin inventory all"
on public.inventory_movements for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Storage delete permission for product photos/videos.
drop policy if exists "admin delete media" on storage.objects;
create policy "admin delete media"
on storage.objects for delete to authenticated
using (
  bucket_id in ('product-media','brand-logos','receipts')
  and public.is_admin()
);
