-- KARIA V7.34 — newsletter sign-ups from the footer form
create table if not exists public.newsletter_subscribers(
  email text primary key,
  created_at timestamptz not null default now()
);
alter table public.newsletter_subscribers enable row level security;
do $$ begin create policy "anyone can subscribe" on public.newsletter_subscribers for insert with check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'); exception when duplicate_object then null; end $$;
do $$ begin create policy "admin read subscribers" on public.newsletter_subscribers for select using (public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy "admin delete subscribers" on public.newsletter_subscribers for delete using (public.is_admin()); exception when duplicate_object then null; end $$;
