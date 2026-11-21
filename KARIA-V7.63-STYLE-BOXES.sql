-- KARIA V7.63 — optional per-product box (cm). Already run in production on 2026-11-21. The box and weight per STYLE live in settings.shipping.styles (Admin → Settings).
alter table public.products add column if not exists box_l numeric(6,1);
alter table public.products add column if not exists box_w numeric(6,1);
alter table public.products add column if not exists box_h numeric(6,1);
