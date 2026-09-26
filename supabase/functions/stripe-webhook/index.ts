import Stripe from "https://esm.sh/stripe@16?target=deno";
import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
Deno.serve(async(req)=>{const stripe=new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);const sig=req.headers.get("stripe-signature")||"";const body=await req.text();try{const event=await stripe.webhooks.constructEventAsync(body,sig,Deno.env.get("STRIPE_WEBHOOK_SECRET")!);const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
 if(event.type==="checkout.session.completed"){const s=event.data.object as Stripe.Checkout.Session;const oid=s.metadata?.order_id;if(oid){const {error}=await sb.rpc("post_paid_order",{p_order_id:oid,p_payment_intent:String(s.payment_intent||"")});if(error)throw error}}
 if(event.type==="charge.refunded"){const ch=event.data.object as Stripe.Charge;await sb.from("audit_log").insert({action:"STRIPE_REFUND_RECEIVED",entity_type:"stripe_charge",after_data:{charge_id:ch.id,amount_refunded:ch.amount_refunded}})}
 return new Response("ok");}catch(e){return new Response(e instanceof Error?e.message:String(e),{status:400})}});
