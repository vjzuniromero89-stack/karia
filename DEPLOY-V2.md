# KARIA COMPLETE V2 — deployment

This package is cumulative: it preserves the cinematic storefront, account/login, Supabase integration, Super Admin and existing admin functions, then adds the operational modules.

## 1. Database
Run `KARIA-COMPLETE-V2.sql` in Supabase SQL Editor after the SQL files you already ran.

## 2. Edge Functions
Redeploy these folders from `supabase/functions`:
- `admin-create-user`
- `admin-update-user`
- `create-checkout`
- `stripe-webhook`

For the first three browser-called functions, use the project's current JWT/custom-auth configuration as documented in your Supabase project. The code itself validates the signed-in user where required.

## 3. Secrets (server only)
Edge Functions need the standard Supabase server environment. Stripe functions additionally need:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Never add service-role or Stripe secret keys as `VITE_` variables.

## 4. Stripe webhook
In Stripe, point the webhook endpoint to your deployed `stripe-webhook` Edge Function and subscribe at minimum to `checkout.session.completed` and `charge.refunded`. Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.

## 5. Frontend
Vercel keeps:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Included operational flow
Storefront → account → cart → secure checkout → Stripe → paid order → inventory OUT → COGS/ledger → reports.
Admin includes Dashboard, Orders, Products, Brands, Inventory, Production, Customers, Accounting, Reports, Admin users and Settings.
