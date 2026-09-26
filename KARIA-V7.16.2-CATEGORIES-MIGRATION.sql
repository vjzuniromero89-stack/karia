-- KARIA V7.16.2 — Categories final compatibility migration
-- Safe to run even if V7.16.1 migration was already run.

alter table public.categories
  add column if not exists active boolean not null default true;

alter table public.categories
  add column if not exists created_at timestamptz not null default now();

alter table public.categories enable row level security;

drop policy if exists "public active categories" on public.categories;
create policy "public active categories"
on public.categories for select
to anon, authenticated
using (
  active = true
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('staff','admin','super_admin')
  )
);

drop policy if exists "staff manage categories" on public.categories;
create policy "staff manage categories"
on public.categories for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('staff','admin','super_admin')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('staff','admin','super_admin')
  )
);

update public.categories set active=true where active is null;
