import Stripe from "https://esm.sh/stripe@18.5.0?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// KARIA V7.58 — refunds a received return in Stripe, puts the bags back in stock and closes the return.
// POST {return_id, include_shipping}. Only admins and super admins (not staff).
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const money=(n:number)=>Math.round((Number(n)||0)*100)/100;
// only these messages reach the admin; anything else (Postgres, unexpected) is logged and replaced by a generic one
class UserError extends Error{}

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 try{
  const auth=req.headers.get("Authorization")||"";
  const url=Deno.env.get("SUPABASE_URL")!;
  const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const stripeKey=Deno.env.get("STRIPE_SECRET_KEY")!;
  if(!stripeKey)throw new Error("STRIPE_SECRET_KEY is not configured");
  const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const admin=createClient(url,service);
  const {data:{user}}=await userClient.auth.getUser();
  if(!user)throw new UserError("Sign in required");
  const {data:me,error:pe}=await admin.from("profiles").select("role,disabled").eq("id",user.id).maybeSingle();
  if(pe)throw pe;
  if(!me||me.disabled||!["admin","super_admin"].includes(String(me.role)))throw new UserError("Only an admin can send refunds.");

  const {return_id,include_shipping}=await req.json();
  if(!return_id)throw new UserError("Return not found");
  const {data:ret,error:re}=await admin.from("return_requests").select("*").eq("id",return_id).maybeSingle();
  if(re)throw re;
  if(!ret)throw new UserError("Return not found");
  if(ret.status==="refunded")throw new UserError("This return was already refunded.");
  if(ret.status!=="received")throw new UserError("Mark the bag as received before refunding.");

  const {data:order,error:oe}=await admin.from("orders").select("id,order_number,status,subtotal,discount_total,discount,shipping_total,shipping,total,stripe_session_id,stripe_payment_intent,order_items(id,product_id,qty,unit_price,customization)").eq("id",ret.order_id).maybeSingle();
  if(oe)throw oe;
  if(!order)throw new UserError("The order of this return no longer exists.");
  if(["cancelled","refunded"].includes(String(order.status)))throw new UserError(`Order #${order.order_number} is already ${order.status}.`);
  const lines=new Map((order.order_items||[]).map((it:any)=>[it.id,it]));

  // Price and quantity come from the order lines, never from the return row.
  const back=(ret.items||[]).map((x:any)=>{const it:any=lines.get(x.order_item_id);return it?{...it,qty:Math.min(Math.max(1,Number(x.qty)||1),Number(it.qty))}:null}).filter(Boolean) as any[];
  if(!back.length)throw new UserError("This return has no bags from the order.");
  const itemsAmount=back.reduce((s,it)=>s+it.qty*Number(it.unit_price),0);
  const subtotal=Number(order.subtotal)||(order.order_items||[]).reduce((s:number,it:any)=>s+Number(it.qty)*Number(it.unit_price),0);
  const discount=Number(order.discount_total??order.discount??0);
  // the coupon is shared by every bag in proportion, so a refund never exceeds what was paid for these bags
  const itemsNet=itemsAmount-(subtotal>0?discount*itemsAmount/subtotal:0);
  const shipping=include_shipping?Number(order.shipping_total??order.shipping??0):0;
  const {data:prev,error:pre}=await admin.from("return_requests").select("refund_amount").eq("order_id",order.id).eq("status","refunded");
  if(pre)throw pre;
  const left=Number(order.total)-(prev||[]).reduce((s:number,r:any)=>s+Number(r.refund_amount||0),0);
  const amount=money(Math.min(itemsNet+shipping,left));
  if(!(amount>0))throw new UserError("Nothing is left to refund on this order.");

  const stripe=new Stripe(stripeKey,{httpClient:Stripe.createFetchHttpClient()});
  let pi:string|null=order.stripe_payment_intent||null;
  if(!pi&&order.stripe_session_id){const s=await stripe.checkout.sessions.retrieve(order.stripe_session_id);pi=typeof s.payment_intent==="string"?s.payment_intent:s.payment_intent?.id??null}
  if(!pi)throw new UserError(`Order #${order.order_number} has no Stripe payment to refund.`);

  let refund:any;
  try{
   // same key for the same return: a double click or a retry never refunds twice
   refund=await stripe.refunds.create({payment_intent:pi,amount:Math.round(amount*100),reason:"requested_by_customer",metadata:{return_id:String(ret.id),order_id:String(order.id)}},{idempotencyKey:`return-${ret.id}`});
  }catch(e:any){
   console.error("STRIPE REFUND ERROR",e);
   if(e?.type==="StripeIdempotencyError")throw new UserError("A refund for this return was already sent with a different amount. Check the payment in Stripe before trying again.");
   if(e?.type==="StripePermissionError")throw new UserError("The Stripe key cannot make refunds. In Stripe, give the key the Refunds: Write permission.");
   if(e?.type==="StripeInvalidRequestError"||e?.type==="StripeCardError")throw new UserError(`Stripe: ${e.message}`);
   throw new UserError("Stripe did not answer. Nothing was refunded; please try again.");
  }
  if(refund.status==="failed"||refund.status==="canceled")throw new UserError(`Stripe could not refund this payment (status ${refund.status}). Check it in Stripe.`);

  try{
   // Stock: the returned bags go back, never more than this order took out (custom bags never left stock).
   const short=String(ret.id).slice(0,8),note=`Return · order #${order.order_number} · return ${short}`;
   const {data:done,error:de}=await admin.from("inventory_movements").select("id").eq("reference_id",order.id).eq("note",note).limit(1);
   if(de)throw de;
   if(!done?.length){
    const {data:moves,error:me}=await admin.from("inventory_movements").select("product_id,qty,movement_type").eq("reference_id",order.id).in("movement_type",["OUT","RETURN"]);
    if(me)throw me;
    const still=new Map<string,number>();
    for(const m of moves||[])still.set(m.product_id,(still.get(m.product_id)||0)+(m.movement_type==="OUT"?1:-1)*Math.abs(Number(m.qty)));
    const wanted=new Map<string,number>();
    for(const it of back)if(!it.customization&&it.product_id)wanted.set(it.product_id,(wanted.get(it.product_id)||0)+it.qty);
    const rows=[...wanted].map(([product_id,q])=>({product_id,qty:Math.min(q,still.get(product_id)||0),movement_type:"RETURN",reference_type:"order",reference_id:order.id,note})).filter(r=>r.qty>0);
    if(rows.length){const {error:ie}=await admin.from("inventory_movements").insert(rows);if(ie)throw ie}
   }
   const {error:ue}=await admin.from("return_requests").update({status:"refunded",refund_amount:amount,refund_shipping:!!include_shipping,stripe_refund_id:refund.id}).eq("id",ret.id);
   if(ue)throw ue;
   // Every bag of the order now refunded → the order becomes REFUNDED (the V7.58 trigger finds nothing left to put back).
   const {data:all,error:ae}=await admin.from("return_requests").select("items").eq("order_id",order.id).eq("status","refunded");
   if(ae)throw ae;
   const got=new Map<string,number>();
   for(const r of all||[])for(const x of r.items||[])got.set(x.order_item_id,(got.get(x.order_item_id)||0)+Number(x.qty||0));
   const whole=(order.order_items||[]).every((it:any)=>(got.get(it.id)||0)>=Number(it.qty));
   if(whole){const {error:se}=await admin.from("orders").update({status:"refunded"}).eq("id",order.id);if(se)throw se}
   return json({ok:true,refund_id:refund.id,amount,order_refunded:whole});
  }catch(e){
   console.error("REFUND SAVE ERROR",e);
   throw new UserError(`The refund ${refund.id} was sent to Stripe, but KARIA could not save it. Press Refund again to finish — Stripe will not refund twice.`);
  }
 }catch(e){
  if(!(e instanceof UserError))console.error("REFUND RETURN ERROR",e);
  return json({ok:false,error:e instanceof UserError?e.message:"We could not send the refund. Please try again."},400);
 }
});
