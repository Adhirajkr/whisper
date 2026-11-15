import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const secret=Deno.env.get("CHAATTIKO_ADMIN_SESSION_SECRET")||"";
const password=Deno.env.get("CHAATTIKO_ADMIN_PASSWORD")||"";
const url=Deno.env.get("SUPABASE_URL")||"";
const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const anonKey=Deno.env.get("SUPABASE_ANON_KEY")||"";
const db=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
function b64url(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")}
function fromB64url(value:string){const s=value.replace(/-/g,"+").replace(/_/g,"/");const raw=atob(s+"=".repeat((4-s.length%4)%4));return Uint8Array.from(raw,c=>c.charCodeAt(0))}
async function mac(value:string){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return b64url(new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value))))}
function equal(a:string,b:string){if(a.length!==b.length)return false;let out=0;for(let i=0;i<a.length;i++)out|=a.charCodeAt(i)^b.charCodeAt(i);return out===0}
async function issueToken(){const payload=b64url(new TextEncoder().encode(JSON.stringify({exp:Date.now()+8*60*60*1000,scope:"chaattiko-admin"})));return payload+"."+await mac(payload)}
async function validToken(req:Request){const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");const [payload,signature]=token.split(".");if(!payload||!signature||!equal(await mac(payload),signature))return false;try{const d=JSON.parse(new TextDecoder().decode(fromB64url(payload)));return d.scope==="chaattiko-admin"&&d.exp>Date.now()}catch{return false}}
const limited=new Map<string,{count:number;reset:number}>();
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"Method not allowed."},405);
 if(!url||!serviceKey)return json({error:"Supabase server configuration is missing."},503);
 let body:any;try{body=await req.json()}catch{return json({error:"Invalid JSON body."},400)}
 // Authenticated user heartbeat: records coarse connection metadata for admin security review.
 if(body.action==="presence"){
  const jwt=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
  if(!anonKey||!jwt)return json({error:"Sign-in required."},401);
  const authClient=createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await authClient.auth.getUser(jwt);
  if(error||!data.user)return json({error:"Invalid user session."},401);
  const ip=(req.headers.get("x-forwarded-for")||"").split(",")[0].trim()||null;
  const agent=req.headers.get("user-agent")||null;
  const {data:profile,error:profileError}=await db.from("profiles").select("is_banned,kick_requested_at").eq("id",data.user.id).maybeSingle();
  if(profileError||!profile)return json({error:"Profile not found."},404);
  if(profile.is_banned)return json({kicked:true});
  if(profile.kick_requested_at){
    await db.from("profiles").update({kick_requested_at:null}).eq("id",data.user.id);
    return json({kicked:true});
  }
  const {error:updateError}=await db.from("profiles").update({last_seen_at:new Date().toISOString(),last_seen_ip:ip,last_seen_user_agent:agent}).eq("id",data.user.id);
  if(updateError)return json({error:updateError.message},500);
  return json({ok:true});
 }
 if(!secret||!password)return json({error:"Admin secrets are not configured. Add CHAATTIKO_ADMIN_PASSWORD and CHAATTIKO_ADMIN_SESSION_SECRET in Supabase Edge Function secrets."},503);
 if(body.action==="login"){
  const ip=(req.headers.get("x-forwarded-for")||"").split(",")[0].trim()||"unknown",now=Date.now();
  const state=limited.get(ip)||{count:0,reset:now+600000};if(state.reset<now){state.count=0;state.reset=now+600000}state.count++;limited.set(ip,state);
  if(state.count>8)return json({error:"Too many attempts. Try again in ten minutes."},429);
  if(!equal(String(body.password||""),password))return json({error:"Incorrect admin password."},401);
  limited.delete(ip);return json({token:await issueToken(),expiresIn:28800});
 }
 if(!(await validToken(req)))return json({error:"Admin authentication required."},401);
 if(body.action==="dashboard"){
  const [profiles,messages,blocks,conversations,audit]=await Promise.all([
   db.from("profiles").select("id,username,original_name,gender,is_banned,last_seen_at,last_seen_ip,last_seen_user_agent,created_at,accepted_terms_at").order("created_at",{ascending:false}).limit(1000),
   db.from("messages").select("id,user_id,username,body,reply_to,created_at,expires_at,conversation_id").order("created_at",{ascending:false}).limit(500),
   db.from("blocks").select("blocker_id,blocked_id,created_at").order("created_at",{ascending:false}).limit(500),
   db.from("conversations").select("id,kind,created_by,created_at").order("created_at",{ascending:false}).limit(500),
   db.from("admin_audit").select("*").order("created_at",{ascending:false}).limit(100)
  ]);
  const err=profiles.error||messages.error||blocks.error||conversations.error||audit.error;if(err)return json({error:err.message},500);
  return json({profiles:profiles.data,messages:messages.data,blocks:blocks.data,conversations:conversations.data,audit:audit.data});
 }
 if(body.action==="set_ban"||body.action==="kick"){
  const userId=String(body.userId||"");if(!userId)return json({error:"User ID is required."},400);
  const values=body.action==="kick"?{kick_requested_at:new Date().toISOString()}:{is_banned:!!body.banned};
  const {error}=await db.from("profiles").update(values).eq("id",userId);if(error)return json({error:error.message},500);
  await db.from("admin_audit").insert({action:body.action==="kick"?"kick_user":body.banned?"ban_user":"unban_user",target_user_id:userId});
  return json({ok:true});
 }
 if(body.action==="delete_message"){
  const messageId=String(body.messageId||"");if(!messageId)return json({error:"Message ID is required."},400);
  const {error}=await db.from("messages").delete().eq("id",messageId);if(error)return json({error:error.message},500);
  await db.from("admin_audit").insert({action:"delete_message",details:{message_id:messageId}});return json({ok:true});
 }
 if(body.action==="delete_user"){
  const userId=String(body.userId||"");
  if(!userId)return json({error:"User ID is required."},400);
  const {data:target,error:lookupError}=await db.from("profiles").select("id,username").eq("id",userId).maybeSingle();
  if(lookupError)return json({error:lookupError.message},500);
  if(!target)return json({error:"This user profile no longer exists."},404);
  const {error:authDeleteError}=await db.auth.admin.deleteUser(userId);
  if(authDeleteError)return json({error:"Could not delete the login account: "+authDeleteError.message},500);
  const {error:profileDeleteError}=await db.from("profiles").delete().eq("id",userId);
  if(profileDeleteError)return json({error:"The login account was deleted, but the profile cleanup needs attention: "+profileDeleteError.message},500);
  await db.from("admin_audit").insert({action:"delete_user",details:{user_id:userId,username:target.username}});
  return json({ok:true,deletedUsername:target.username});
 }
 return json({error:"Unknown admin action."},400);
});