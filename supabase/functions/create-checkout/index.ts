import Stripe from "https://esm.sh/stripe@18.5.0?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const money=(n:number)=>Math.round((Number(n)||0)*100)/100;

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
  if(!user)throw new Error("Sign in required");
  const {items,shipping_address,coupon_code}=await req.json();
  if(!Array.isArray(items)||!items.length)throw new Error("Cart is empty");

  const ids=[...new Set(items.map((x:any)=>x.product_id))];
  const {data:products,error:pe}=await admin.from("products").select("id,name,price,unit_cost,active").in("id",ids).eq("active",true);
  if(pe)throw pe;
  const map=new Map((products||[]).map((p:any)=>[p.id,p]));
  const lines=items.map((x:any)=>{const p:any=map.get(x.product_id);if(!p)throw new Error("Unavailable product");const quantity=Math.max(1,Number(x.quantity||x.qty||1));return {product_id:p.id,name:p.name,quantity,unit_price:money(p.price),unit_cost:money(p.unit_cost||0)}});
  const subtotal=money(lines.reduce((a:number,l:any)=>a+l.quantity*l.unit_price,0));

  let coupon:any=null, discount=0, normalizedCode:string|null=null;
  if(coupon_code&&String(coupon_code).trim()){
   normalizedCode=String(coupon_code).trim().toUpperCase();
   const {data,error}=await admin.from("coupons").select("id,code,percent_off,amount_off,active,starts_at,ends_at").eq("code",normalizedCode).maybeSingle();
   if(error)throw error;
   if(!data||!data.active)throw new Error("Coupon code is not valid");
   const now=Date.now();
   if(data.starts_at&&new Date(data.starts_at).getTime()>now)throw new Error("This coupon is not active yet");
   if(data.ends_at&&new Date(data.ends_at).getTime()<now)throw new Error("This coupon has expired");
   const pct=Number(data.percent_off||0), fixed=Number(data.amount_off||0);
   if(pct>0)discount=money(subtotal*Math.min(pct,100)/100); else if(fixed>0)discount=money(fixed); else throw new Error("Coupon has no discount configured");
   discount=Math.min(subtotal,Math.max(0,discount));coupon=data;
  }
  const total=money(Math.max(0,subtotal-discount));

  const {data:order,error:oe}=await admin.from("orders").insert({customer_id:user.id,email:user.email||null,status:"pending",subtotal,discount_total:discount,shipping_total:0,total,shipping_address,coupon_code:normalizedCode}).select().single();
  if(oe)throw oe;
  const {error:le}=await admin.from("order_items").insert(lines.map((l:any)=>({order_id:order.id,product_id:l.product_id,qty:l.quantity,unit_price:l.unit_price,unit_cost:l.unit_cost})));
  if(le){await admin.from("orders").delete().eq("id",order.id);throw le;}

  const stripe=new Stripe(stripeKey,{httpClient:Stripe.createFetchHttpClient()});
  const origin=req.headers.get("origin")||"https://karia-liart.vercel.app";
  const session=await stripe.checkout.sessions.create({
   mode:"payment",
   customer_email:user.email||undefined,
   line_items:[{price_data:{currency:"usd",product_data:{name:coupon?`KARIA order #${order.order_number||''} · ${coupon.code}`:`KARIA order #${order.order_number||''}`},unit_amount:Math.round(total*100)},quantity:1}],
   metadata:{order_id:order.id,order_number:String(order.order_number||""),coupon_code:normalizedCode||"",discount_total:discount.toFixed(2)},
   success_url:`${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
   cancel_url:`${origin}/checkout?canceled=1`,
  });
  await admin.from("orders").update({stripe_session_id:session.id}).eq("id",order.id);
  return json({ok:true,order_id:order.id,order_number:order.order_number,subtotal,discount_total:discount,coupon_code:normalizedCode,total,checkout_url:session.url});
 }catch(e){console.error("CREATE CHECKOUT ERROR",e);return json({ok:false,error:e instanceof Error?e.message:String(e)},400)}
});
