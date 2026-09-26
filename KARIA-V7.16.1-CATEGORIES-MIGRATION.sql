-- KARIA V7.16.1 — Categories management migration
-- Run ONCE in Supabase > SQL Editor for the KARIA project.

-- 1) Add lifecycle support required by Admin > Categories.
alter table public.categories
  add column if not exists active boolean not null default true;

-- 2) Enable RLS on categories.
alter table public.categories enable row level security;

-- 3) Helper: admin/staff roles allowed to manage catalog categories.
-- Uses the existing public.profiles.role field.
drop policy if exists "public active categories" on public.categories;
create policy "public active categories"
on public.categories
for select
to anon, authenticated
using (active = true or exists (
  select 1 from public.profiles p
  where p.id = auth.uid()
    and p.role in ('staff','admin','super_admin')
));

drop policy if exists "staff manage categories" on public.categories;
create policy "staff manage categories"
on public.categories
for all
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

-- 4) Ensure existing categories are active.
update public.categories set active = true where active is null;
