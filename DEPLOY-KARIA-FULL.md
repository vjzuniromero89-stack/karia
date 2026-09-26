# KARIA — deployment checklist

1. Run `KARIA-FULL-OPERATIONS.sql` in Supabase SQL Editor.
2. Deploy Edge Functions:
   - `admin-create-user`
   - `admin-update-user`
   - `create-checkout`
   - `stripe-webhook`
3. Edge Function secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
4. Stripe functions additionally require `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
5. Never expose the Service Role Key as a `VITE_` variable.
6. Keep Vercel frontend variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
7. Admin creation flow: Super Admin creates Admin/Staff → receives one-time temporary password → gives it privately to the user → user changes it after first sign-in.
8. Customers continue using normal storefront registration.
