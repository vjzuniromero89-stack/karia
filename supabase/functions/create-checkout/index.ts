import Stripe from "https://esm.sh/stripe@16?target=deno";
import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"}});
 try{
  const {items,email,successUrl,cancelUrl}=await req.json();
  const stripe=new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
  const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let subtotal=0; const line_items=[];
  for(const x of items){
   const {data:p,error}=await supabase.from("products").select("id,name,price,unit_cost,active").eq("id",x.product_id).single();
   if(error||!p?.active) throw new Error("Invalid product");
   subtotal+=Number(p.price)*x.qty;
   line_items.push({price_data:{currency:"usd",product_data:{name:p.name},unit_amount:Math.round(Number(p.price)*100)},quantity:x.qty});
  }
  const {data:o,error:oe}=await supabase.from("orders").insert({email,status:"pending",subtotal,total:subtotal}).select().single();
  if(oe) throw oe;
  const session=await stripe.checkout.sessions.create({mode:"payment",customer_email:email,line_items,success_url:successUrl,cancel_url:cancelUrl,metadata:{order_id:o.id}});
  await supabase.from("orders").update({stripe_session_id:session.id}).eq("id",o.id);
  return Response.json({url:session.url});
 }catch(e){return Response.json({error:String(e)},{status:400})}
});