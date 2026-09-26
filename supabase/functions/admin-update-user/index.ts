import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 try{
  const auth=req.headers.get("Authorization"); if(!auth) throw new Error("Unauthorized");
  const url=Deno.env.get("SUPABASE_URL")!, anon=Deno.env.get("SUPABASE_ANON_KEY")!, service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const caller=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const {data:{user}}=await caller.auth.getUser(); if(!user) throw new Error("Unauthorized");
  const admin=createClient(url,service);
  const {data:me}=await admin.from("profiles").select("role").eq("id",user.id).single();
  if(me?.role!=="super_admin") throw new Error("Super Admin required");
  const {user_id,role,disabled=false}=await req.json();
  if(user_id===user.id && (role!=="super_admin"||disabled)) throw new Error("Cannot remove your own Super Admin access");
  if(!["customer","staff","admin","super_admin"].includes(role)) throw new Error("Invalid role");
  await admin.from("profiles").update({role,disabled}).eq("id",user_id);
  await admin.from("audit_log").insert({actor_id:user.id,action:"ADMIN_USER_UPDATED",entity_type:"profile",entity_id:user_id,after_data:{role,disabled}});
  return Response.json({ok:true},{headers:cors});
 }catch(e){return new Response(JSON.stringify({ok:false,error:String(e)}),{status:400,headers:{...cors,"Content-Type":"application/json"}})}
});