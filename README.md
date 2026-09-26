# KARIA — Complete Store Foundation

KARIA is a multi-brand handcrafted-bag storefront with a cinematic public experience and an operational back office.

## Included
- Cinematic responsive storefront using supplied KARIA product photos/video
- Catalog, cart UI and Admin preview
- Multi-brand data model (KARIA is the store; each product can retain its own brand/logo)
- Supabase Auth-ready profiles/roles and RLS foundation
- Product/media/variant catalog schema
- Inventory movement ledger and computed stock
- Orders, order items, coupons and customer addresses
- Materials + production orders
- 50/50 partner ownership + contributions/distributions
- Double-entry accounting chart, journals, expenses and Stripe payout reconciliation tables
- Audit log
- Stripe Checkout Edge Function + Stripe webhook scaffold
- Environment template with no secrets committed

## Setup
1. `npm install`
2. Copy `.env.example` to `.env` and add Supabase URL + anon key.
3. Run `supabase-schema.sql` in Supabase SQL Editor.
4. Create Storage buckets for `product-media`, `brand-logos`, `receipts`.
5. Deploy `create-checkout` and `stripe-webhook` Supabase Edge Functions.
6. Add Stripe server secrets to Supabase Edge Function secrets.
7. Configure Stripe webhook to the deployed `stripe-webhook` function.
8. `npm run dev`

## Important production note
The visual storefront/admin demo works immediately. Live authentication, cloud uploads and real card charges require your own Supabase/Stripe credentials. Secret keys are intentionally not embedded in this ZIP. Before accepting real money, the webhook should call a single Postgres RPC that atomically creates order items, inventory OUT, COGS, tax/fees and balanced journal lines; the included schema is structured for that production step.
