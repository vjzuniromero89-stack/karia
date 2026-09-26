import Stripe from "https://esm.sh/stripe@16?target=deno";
import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
Deno.serve(async(req)=>{
 const stripe=new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
 const sig=req.headers.get("stripe-signature")!;
 const body=await req.text();
 try{
  const event=await stripe.webhooks.constructEventAsync(body,sig,Deno.env.get("STRIPE_WEBHOOK_SECRET")!);
  const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  if(event.type==="checkout.session.completed"){
   const s=event.data.object as Stripe.Checkout.Session; const oid=s.metadata?.order_id;
   if(oid) await sb.from("orders").update({status:"paid",stripe_payment_intent:String(s.payment_intent||"")}).eq("id",oid);
   // Production hardening: post order items, inventory OUT, COGS, tax, fee and journal entry in one DB RPC transaction.
  }
  return new Response("ok");
 }catch(e){return new Response(String(e),{status:400})}
});