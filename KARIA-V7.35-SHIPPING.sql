-- KARIA V7.35 — let the checkout page read the shipping rule (rate and free-shipping amount).
-- Every other setting stays admin-only. Run this AFTER deploying the create-checkout function.
do $$ begin
  create policy "public read shipping setting" on public.settings for select using (key = 'shipping');
exception when duplicate_object then null; end $$;
