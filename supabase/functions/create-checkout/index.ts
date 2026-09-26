import Stripe from "https://esm.sh/stripe@16?target=deno";
import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
Deno.serve(async(req)=>{if(req.method==="OPTIONS")return new Response("ok",{headers:cors});try{
 const auth=req.headers.get("Authorization"); if(!auth) throw new Error("Sign in required");
 const url=Deno.env.get("SUPABASE_URL")!, service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, anon=Deno.env.get("SUPABASE_ANON_KEY")!;
 const caller=createClient(url,anon,{global:{headers:{Authorization:auth}}}); const {data:{user}}=await caller.auth.getUser(); if(!user)throw new Error("Sign in required");
 const {items,successUrl,cancelUrl}=await req.json(); if(!Array.isArray(items)||!items.length)throw new Error("Cart is empty");
 const db=createClient(url,service); const stripe=new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!); let subtotal=0;const line_items:any[]=[],orderItems:any[]=[];
 for(const x of items){const {data:p,error}=await db.from("products").select("id,name,price,unit_cost,active").eq("id",x.product_id).single();if(error||!p?.active)throw new Error("Invalid product");const qty=Math.max(1,Number(x.qty||1));subtotal+=Number(p.price)*qty;line_items.push({price_data:{currency:"usd",product_data:{name:p.name},unit_amount:Math.round(Number(p.price)*100)},quantity:qty});orderItems.push({product_id:p.id,qty,unit_price:p.price,unit_cost:p.unit_cost||0})}
 const {data:o,error:oe}=await db.from("orders").insert({customer_id:user.id,email:user.email,status:"pending",subtotal,total:subtotal}).select().single();if(oe)throw oe;
 await db.from("order_items").insert(orderItems.map(x=>({...x,order_id:o.id})));
 const session=await stripe.checkout.sessions.create({mode:"payment",customer_email:user.email,line_items,success_url:successUrl,cancel_url:cancelUrl,metadata:{order_id:o.id}});await db.from("orders").update({stripe_session_id:session.id}).eq("id",o.id);
 return new Response(JSON.stringify({url:session.url}),{headers:{...cors,"Content-Type":"application/json"}})
}catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:String(e)}),{status:400,headers:{...cors,"Content-Type":"application/json"}})}});
