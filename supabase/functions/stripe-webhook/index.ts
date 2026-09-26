// KARIA Stripe webhook.
// Deploy only after STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are configured.
// Payment completion must call a single database transaction/RPC that:
// marks order paid, creates inventory SALE/OUT, records COGS/tax/fees, and ledger entries.
// This function intentionally rejects requests until Stripe secrets are configured.
Deno.serve(async(req)=>{
 const secret=Deno.env.get("STRIPE_WEBHOOK_SECRET");
 if(!secret)return new Response("Stripe webhook is not configured",{status:503});
 return new Response("Webhook signature verification must be enabled before live payments",{status:501});
});