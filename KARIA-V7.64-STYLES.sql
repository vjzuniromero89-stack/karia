-- KARIA V7.64 — products belong to a style; Settings → Shipping keeps each style's box (cm) and packed weight (lb).
-- Run in production on 2026-11-21. Weight: 400 g bag + 270 g box = 670 g = 1.48 lb (owners' numbers).
alter table public.products add column if not exists style text;
update public.products set style = 'Amelia' where style is null and name ilike 'Amelia %';
update public.products set style = 'Aurora' where style is null and name ilike 'Aurora %';
update public.settings
set value = coalesce(value, '{}'::jsonb) || jsonb_build_object('styles', jsonb_build_array(
      jsonb_build_object('name','Amelia','l',30,'w',26,'h',15,'lb',1.48,'photo',null),
      jsonb_build_object('name','Aurora','l',30,'w',26,'h',15,'lb',1.48,'photo',null))),
    updated_at = now()
where key = 'shipping';
update public.products set weight = 1.48, box_l = 30, box_w = 26, box_h = 15 where style in ('Amelia','Aurora');
