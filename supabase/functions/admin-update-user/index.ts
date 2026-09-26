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
  const body=await req.json();
  const {user_id,role,disabled=false,reset_password,force_password_change=false}=body;
  if(!user_id) throw new Error("User ID required");

  if(reset_password!==undefined){
    if(user_id===user.id) throw new Error("Use My Account to change your own password");
    if(typeof reset_password!=="string"||reset_password.length<8) throw new Error("Password must be at least 8 characters");
    const {data:targetProfile,error:targetProfileError}=await admin.from("profiles").select("role,email").eq("id",user_id).single();
    if(targetProfileError) throw targetProfileError;
    if(!["staff","admin"].includes(targetProfile?.role)) throw new Error("Password reset is limited to Staff and Admin accounts");
    const {error:passwordError}=await admin.auth.admin.updateUserById(user_id,{
      password:reset_password,
      user_metadata:{must_change_password:!!force_password_change}
    });
    if(passwordError) throw passwordError;
    await admin.from("audit_log").insert({actor_id:user.id,action:"ADMIN_PASSWORD_RESET",entity_type:"profile",entity_id:user_id,after_data:{force_password_change:!!force_password_change}});
    return Response.json({ok:true,password_reset:true},{headers:cors});
  }

  if(user_id===user.id && (role!=="super_admin"||disabled)) throw new Error("Cannot remove your own Super Admin access");
  if(!["customer","staff","admin","super_admin"].includes(role)) throw new Error("Invalid role");
  await admin.from("profiles").update({role,disabled}).eq("id",user_id);
  await admin.from("audit_log").insert({actor_id:user.id,action:"ADMIN_USER_UPDATED",entity_type:"profile",entity_id:user_id,after_data:{role,disabled}});
  return Response.json({ok:true},{headers:cors});
 }catch(e){return new Response(JSON.stringify({ok:false,error:String(e)}),{status:400,headers:{...cors,"Content-Type":"application/json"}})}
});