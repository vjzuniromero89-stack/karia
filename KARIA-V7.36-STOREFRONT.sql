-- KARIA V7.36 — Contact page messages + public Contact/About details

-- 1. Messages sent from the Contact page (anyone can send, only admins can read or delete)
create table if not exists public.contact_messages(
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  message text not null check (char_length(message) between 1 and 4000),
  created_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;
do $$ begin create policy "anyone can send a message" on public.contact_messages for insert with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy "admin read messages" on public.contact_messages for select using (public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "admin delete messages" on public.contact_messages for delete using (public.is_admin()); exception when duplicate_object then null; end $$;

-- 2. The Contact and About pages read the "storefront" setting (contact email, WhatsApp, Instagram, About text).
--    Every other setting stays admin-only.
do $$ begin create policy "public read storefront setting" on public.settings for select using (key = 'storefront'); exception when duplicate_object then null; end $$;

-- 3. Customers can see the lines of their own orders on the My orders page.
do $$ begin
  create policy "own order items" on public.order_items for select
    using (exists (select 1 from public.orders o where o.id = order_items.order_id and o.customer_id = auth.uid()));
exception when duplicate_object then null; end $$;
