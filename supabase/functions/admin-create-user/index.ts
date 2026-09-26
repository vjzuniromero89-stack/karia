import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok",{headers:cors});
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("Unauthorized");
    const url=Deno.env.get("SUPABASE_URL")!;
    const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
    const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const caller=createClient(url,anon,{global:{headers:{Authorization:auth}}});
    const {data:{user}}=await caller.auth.getUser();
    if(!user) throw new Error("Unauthorized");

    const admin=createClient(url,service);
    const {data:profile}=await admin.from("profiles").select("role").eq("id",user.id).single();
    if(profile?.role!=="super_admin") throw new Error("Super Admin required");

    const {email,full_name,role="admin"}=await req.json();
    if(!["admin","staff"].includes(role)) throw new Error("Invalid role");
    const temporaryPassword=crypto.randomUUID().replaceAll("-","").slice(0,14)+"!9aA";
    const {data,error}=await admin.auth.admin.createUser({
      email,password:temporaryPassword,email_confirm:true,
      user_metadata:{full_name,must_change_password:true}
    });
    if(error) throw error;
    await admin.from("profiles").update({full_name,role}).eq("id",data.user.id);
    await admin.from("audit_log").insert({
      actor_id:user.id,action:"ADMIN_USER_CREATED",entity_type:"profile",entity_id:data.user.id,
      after_data:{email,full_name,role}
    });
    return new Response(JSON.stringify({ok:true,email,temporaryPassword,role}),{
      headers:{...cors,"Content-Type":"application/json"}
    });
  } catch(e) {
    return new Response(JSON.stringify({ok:false,error:String(e)}),{
      status:400,headers:{...cors,"Content-Type":"application/json"}
    });
  }
});