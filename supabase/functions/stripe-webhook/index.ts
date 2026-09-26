import Stripe from "https://esm.sh/stripe@18.5.0?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!stripeKey || !webhookSecret || !supabaseUrl || !serviceKey) throw new Error("Missing server secrets");

    const stripe = new Stripe(stripeKey);
    const signature = req.headers.get("stripe-signature");
    if (!signature) return new Response("Missing Stripe signature", { status: 400 });
    const rawBody = await req.text();
    const event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.order_id;
      if (!orderId) throw new Error("Missing order_id metadata");
      if (session.payment_status !== "paid") return Response.json({ received: true, paid: false });

      const { data: order, error: orderError } = await db.from("orders")
        .select("id,total,status,processor_fee")
        .eq("id", orderId).single();
      if (orderError || !order) throw new Error("KARIA order not found");

      const stripeAmount = Number(session.amount_total ?? 0);
      const orderAmount = Math.round(Number(order.total ?? 0) * 100);
      if (stripeAmount !== orderAmount) throw new Error("Stripe amount does not match KARIA order");

      // Get Stripe's ACTUAL processing fee from the balance transaction.
      let processorFee = Number(order.processor_fee || 0);
      let paymentIntentId: string | null = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
      if (paymentIntentId) {
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge.balance_transaction"] });
        const charge: any = pi.latest_charge;
        const balanceTx: any = charge && typeof charge !== "string" ? charge.balance_transaction : null;
        if (balanceTx && typeof balanceTx !== "string") processorFee = Number(balanceTx.fee || 0) / 100;
      }

      const { error: updateError } = await db.from("orders").update({
        status: "paid",
        stripe_session_id: session.id,
        stripe_payment_intent: paymentIntentId,
        processor_fee: processorFee,
      }).eq("id", orderId);
      if (updateError) throw updateError;

      console.log("KARIA PAYMENT RECORDED", { order_id: orderId, processor_fee: processorFee });
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("STRIPE WEBHOOK ERROR", error);
    return Response.json({ received: false, error: error instanceof Error ? error.message : "Webhook error" }, { status: 400 });
  }
});
