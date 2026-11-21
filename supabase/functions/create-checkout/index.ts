import Stripe from "https://esm.sh/stripe@18.5.0?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const money=(n:number)=>Math.round((Number(n)||0)*100)/100;
// KARIA V7.49 — only these messages reach the customer; anything else (Postgres, Stripe) is logged and replaced by a generic one
class UserError extends Error{}
const PAID_STATUSES=["paid","processing","shipped","delivered"];
const SITE="https://karia-liart.vercel.app";
// production, Vercel previews of this project (team edvickar) and the local dev server
const allowedOrigin=(o:string|null)=>!!o&&(o===SITE||/^https:\/\/karia-[a-z0-9-]+-edvickar\.vercel\.app$/.test(o)||o==="http://localhost:5186"||o==="http://127.0.0.1:5186");

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
  const {items,shipping_address,coupon_code,shipping_method}=await req.json();
  if(!Array.isArray(items)||!items.length)throw new UserError("Cart is empty");

  const ids=[...new Set(items.map((x:any)=>x.product_id))];
  const {data:products,error:pe}=await admin.from("products").select("id,sku,name,price,unit_cost,active").in("id",ids).eq("active",true);
  if(pe)throw pe;
  const map=new Map((products||[]).map((p:any)=>[p.id,p]));
  // KARIA V7.33 — custom bags: price and colors are re-validated on the server
  const hasCustom=items.some((x:any)=>x&&x.customization);
  let cfg:any=null, styleMap=new Map<string,any>(), colorMap=new Map<string,any>();
  if(hasCustom){
   const [{data:c,error:ce},{data:st,error:se},{data:co,error:coe}]=await Promise.all([
    admin.from("customize_config").select("*").eq("id",1).maybeSingle(),
    admin.from("customize_styles").select("*"),
    admin.from("customize_colors").select("*"),
   ]);
   if(ce||se||coe)throw new Error("Customize is not configured. Run KARIA-V7.33-CUSTOMIZE.sql");
   cfg=c||{enabled:false,customization_fee:0}; // no config row = custom bags off
   if(cfg.enabled!==true)throw new UserError("Custom bags are temporarily unavailable");
   styleMap=new Map((st||[]).map((r:any)=>[r.id,r]));colorMap=new Map((co||[]).map((r:any)=>[r.id,r]));
  }
  const cleanText=(v:unknown,n=60)=>String(v??"").replace(/[<>]/g,"").slice(0,n);
  const buildCustom=(raw:any)=>{
   const style=styleMap.get(String(raw?.style_id||""));
   if(!style||style.active===false)throw new UserError("This bag style is no longer available");
   const allowed:string[]|null=Array.isArray(style.allowed_colors)&&style.allowed_colors.length?style.allowed_colors:null;
   const parts:Record<string,any>={};
   for(const [key,val] of Object.entries(raw?.parts||{}).slice(0,12)){
    const col=colorMap.get(String((val as any)?.color_id||""));
    if(!col||col.active===false)throw new UserError(`Color for ${cleanText((val as any)?.label||key)} is sold out — please choose another`);
    if(allowed&&!allowed.includes(col.id))throw new UserError(`${col.name} is not available for ${style.name}`);
    parts[cleanText(key,30)]={label:cleanText((val as any)?.label||key),color_id:col.id,color_name:col.name,hex:col.hex};
   }
   if(!parts.body||!parts.handle)throw new UserError("Custom bag is missing body or handle color");
   const hw=["gold","silver","black"].includes(raw?.hardware)?raw.hardware:"gold";
   const out:any={style_id:style.id,style_name:style.name,kind:style.kind,parts,hardware:hw,hardware_name:{gold:"Gold",silver:"Silver",black:"Matte Black"}[hw as "gold"]};
   if(Array.isArray(style.bands)&&style.bands.length)out.bands=style.bands;
   return {customization:out,extra:money(Number(cfg.customization_fee||0)+Number(style.extra_price||0)),style};
  };
  const lines=items.map((x:any)=>{const p:any=map.get(x.product_id);if(!p)throw new UserError("Unavailable product");const quantity=Math.max(1,Number(x.quantity||x.qty||1));
   if(x.customization){if(p.sku!=="KARIA-CUSTOM-BAG")throw new UserError("Unavailable product");const c=buildCustom(x.customization);return {product_id:p.id,name:`Custom Bag · ${c.style.name}`,quantity,unit_price:money(Number(p.price)+c.extra),unit_cost:money(p.unit_cost||0),customization:c.customization}}
   return {product_id:p.id,name:p.name,quantity,unit_price:money(p.price),unit_cost:money(p.unit_cost||0),customization:null}});
  // KARIA V7.35 — stock is checked on the server; made-to-order custom bags are exempt
  const wanted=new Map<string,number>();
  for(const l of lines)if(!l.customization)wanted.set(l.product_id,(wanted.get(l.product_id)||0)+l.quantity);
  if(wanted.size){
   const {data:stockRows,error:se}=await admin.from("product_stock").select("product_id,stock").in("product_id",[...wanted.keys()]);
   if(se)throw se;
   const stock=new Map((stockRows||[]).map((r:any)=>[r.product_id,Number(r.stock||0)]));
   for(const [id,qty] of wanted){const left=stock.get(id)||0,name=(map.get(id) as any)?.name||"This product";if(left<=0)throw new UserError(`${name} is sold out`);if(qty>left)throw new UserError(`Only ${left} of ${name} available`)}
  }
  const subtotal=money(lines.reduce((a:number,l:any)=>a+l.quantity*l.unit_price,0));

  let coupon:any=null, discount=0, normalizedCode:string|null=null;
  if(coupon_code&&String(coupon_code).trim()){
   normalizedCode=String(coupon_code).trim().toUpperCase();
   // "*" so the function keeps working if max_uses (V7.49) is not there yet
   const {data,error}=await admin.from("coupons").select("*").eq("code",normalizedCode).maybeSingle();
   if(error)throw error;
   if(!data||!data.active)throw new UserError("Coupon code is not valid");
   const now=Date.now();
   if(data.starts_at&&new Date(data.starts_at).getTime()>now)throw new UserError("This coupon is not active yet");
   if(data.ends_at&&new Date(data.ends_at).getTime()<now)throw new UserError("This coupon has expired");
   if(data.max_uses!=null){
    const {count,error:ue}=await admin.from("orders").select("id",{count:"exact",head:true}).eq("coupon_code",normalizedCode).in("status",PAID_STATUSES);
    if(ue)throw ue;
    if((count||0)>=Number(data.max_uses))throw new UserError("This coupon has reached its usage limit");
   }
   const pct=Number(data.percent_off||0), fixed=Number(data.amount_off||0);
   if(pct>0)discount=money(subtotal*Math.min(pct,100)/100); else if(fixed>0)discount=money(fixed); else throw new UserError("Coupon has no discount configured");
   discount=Math.min(subtotal,Math.max(0,discount));coupon=data;
  }
  // KARIA V7.35 — shipping from Settings: flat rate, free once the order reaches the threshold
  // KARIA V7.66 — Settings may list methods (Standard free, Priority/Express extra); the price always comes from here, never from the browser
  const {data:shipRow}=await admin.from("settings").select("value").eq("key","shipping").maybeSingle();
  const rule:any=shipRow?.value||{},afterDiscount=money(Math.max(0,subtotal-discount));
  const methods:any[]=Array.isArray(rule.methods)?rule.methods.filter((m:any)=>m&&m.id&&m.active!==false):[];
  const method:any=methods.length?(shipping_method?methods.find((m:any)=>m.id===shipping_method):methods[0]):null;
  if(methods.length&&!method)throw new UserError("That shipping option is no longer available. Please choose another.");
  const freeOver=Number(rule.free_shipping_over||0);
  // extra_each: each bag after the first ships in its own box, so faster options charge it per extra bag (Express +$36, V7.67)
  const units=lines.reduce((a:number,l:any)=>a+l.quantity,0);
  const base=method?Number(method.price||0)+Math.max(0,Number(method.extra_each||0))*Math.max(0,units-1):Number(rule.default_rate||0);
  // the free-shipping amount only applies to the first (standard) option
  const shipping=freeOver>0&&afterDiscount>=freeOver&&(!method||method===methods[0])?0:money(Math.max(0,base));
  const shipName=method?[method.name,method.service].filter(Boolean).map(String).join(" · ").slice(0,80):null;
  const total=money(afterDiscount+shipping);

  const {data:order,error:oe}=await admin.from("orders").insert({customer_id:user.id,email:user.email||null,status:"pending",subtotal,discount_total:discount,shipping_total:shipping,total,shipping_address,coupon_code:normalizedCode,...(shipName?{shipping_method:shipName}:{})}).select().single();
  if(oe)throw oe;
  const {error:le}=await admin.from("order_items").insert(lines.map((l:any)=>({order_id:order.id,product_id:l.product_id,qty:l.quantity,unit_price:l.unit_price,unit_cost:l.unit_cost,...(l.customization?{customization:l.customization}:{})})));
  if(le){await admin.from("orders").delete().eq("id",order.id);throw le;}

  const stripe=new Stripe(stripeKey,{httpClient:Stripe.createFetchHttpClient()});
  const reqOrigin=req.headers.get("origin");
  const origin=allowedOrigin(reqOrigin)?reqOrigin!:SITE;
  const usd=(name:string,amount:number,quantity=1)=>({price_data:{currency:"usd",product_data:{name},unit_amount:Math.round(amount*100)},quantity});
  // no discount: one line per bag so the Stripe receipt lists them; with a discount one combined line (Stripe has no negative lines)
  const goods=discount>0
   ?[usd(`KARIA order #${order.order_number||''}${coupon?` · ${coupon.code}`:''}`,afterDiscount)]
   :lines.map((l:any)=>usd(l.name,l.unit_price,l.quantity));
  const session=await stripe.checkout.sessions.create({
   mode:"payment",
   customer_email:user.email||undefined,
   line_items:[...goods,...(shipping>0?[usd(shipName?`Shipping · ${shipName}`:"Shipping",shipping)]:[])],
   metadata:{order_id:order.id,order_number:String(order.order_number||""),coupon_code:normalizedCode||"",discount_total:discount.toFixed(2),shipping_method:shipName||""},
   success_url:`${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
   cancel_url:`${origin}/checkout?canceled=1`,
   expires_at:Math.floor(Date.now()/1000)+31*60, // Stripe's minimum is 30 min; 31 leaves room for clock/network delay
  });
  await admin.from("orders").update({stripe_session_id:session.id}).eq("id",order.id);
  return json({ok:true,order_id:order.id,order_number:order.order_number,subtotal,discount_total:discount,shipping_total:shipping,shipping_method:shipName,coupon_code:normalizedCode,total,checkout_url:session.url});
 }catch(e){
  console.error("CREATE CHECKOUT ERROR",e);
  return json({ok:false,error:e instanceof UserError?e.message:"We could not start the payment. Please try again."},400);
 }
});
