import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
Deno.serve(async(req)=>{if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
try{
 const auth=req.headers.get("Authorization")||"";
 const url=Deno.env.get("SUPABASE_URL")!, anon=Deno.env.get("SUPABASE_ANON_KEY")!;
 const sb=createClient(url,anon,{global:{headers:{Authorization:auth}}});
 const {data:{user}}=await sb.auth.getUser(); if(!user)throw new Error("Sign in required");
 const {items,shipping_address,coupon_code}=await req.json(); if(!Array.isArray(items)||!items.length)throw new Error("Cart is empty");
 // Server-authoritative pricing: never trust client price.
 const ids=[...new Set(items.map((x:any)=>x.product_id))];
 const {data:products,error}=await sb.from("products").select("id,name,price,active").in("id",ids).eq("active",true); if(error)throw error;
 const map=new Map((products||[]).map((p:any)=>[p.id,p]));
 const lines=items.map((x:any)=>{const p:any=map.get(x.product_id);if(!p)throw new Error("Unavailable product");return {product_id:p.id,name:p.name,quantity:Math.max(1,Number(x.quantity||1)),unit_price:Number(p.price)}}); 
 const subtotal=lines.reduce((a:number,l:any)=>a+l.quantity*l.unit_price,0);
 const {data:order,error:oe}=await sb.from("orders").insert({customer_id:user.id,status:"pending",subtotal,total:subtotal,shipping_address,coupon_code:coupon_code||null}).select().single();if(oe)throw oe;
 const {error:le}=await sb.from("order_items").insert(lines.map((l:any)=>({...l,order_id:order.id})));if(le)throw le;
 return new Response(JSON.stringify({ok:true,order_id:order.id,total:subtotal,requires_payment_configuration:true}),{headers:{...cors,"Content-Type":"application/json"}});
}catch(e){return new Response(JSON.stringify({ok:false,error:e instanceof Error?e.message:String(e)}),{status:400,headers:{...cors,"Content-Type":"application/json"}})}});