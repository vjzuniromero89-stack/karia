-- KARIA V7.56 — Photos tab: a library of the business's photos (files live in the 'product-media' bucket under library/).
-- Safe to run twice.
create table if not exists public.media_library (
  id uuid primary key default gen_random_uuid(),
  path text not null unique,            -- storage path inside the product-media bucket
  url text not null,                    -- public URL
  name text,                            -- original file name
  size_bytes integer,
  width integer,
  height integer,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index if not exists idx_media_library_created on public.media_library (created_at desc);
alter table public.media_library enable row level security;
do $$ begin
  create policy "admin media library all" on public.media_library for all to authenticated
    using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;

-- Check: the table exists and which storage rules the bucket has
select to_regclass('public.media_library') is not null as library_table_ok,
  (select string_agg(policyname || ' (' || cmd || ')', ', ') from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and (qual ilike '%product-media%' or with_check ilike '%product-media%')) as product_media_storage_rules;
