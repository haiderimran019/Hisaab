import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import webpush from 'npm:web-push@3.6.7';
import {safePushEndpoint,reminderFor} from './push-policy.ts';
const cors={'Access-Control-Allow-Origin':'https://haiderimran019.github.io','Cache-Control':'no-store','Content-Type':'application/json','Access-Control-Allow-Headers':'apikey,authorization,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 const {data:config,error}=await db.rpc('get_push_config');if(error||!config)return Response.json({available:false},{headers:cors});
 if(req.method==='GET')return Response.json({available:true,publicKey:config.public_key},{headers:cors});
 if(req.method!=='POST'||req.headers.get('X-Hisaab-Dispatch')!==config.dispatch_token)return Response.json({error:'Not authorized'},{status:401,headers:cors});
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const {data:subscriptions,error:listError}=await db.from('push_subscriptions').select('*').or(`last_sent_date.is.null,last_sent_date.neq.${today}`).limit(200);
 if(listError)return Response.json({error:'Reminder queue unavailable'},{status:503,headers:cors});
 webpush.setVapidDetails('https://haiderimran019.github.io/Hisaab/',config.public_key,config.private_key);
 let sent=0,expired=0;
 for(const sub of subscriptions||[]){const {data:member}=await db.from('company_memberships').select('role').eq('company_id',sub.company_id).eq('user_id',sub.user_id).maybeSingle();if(!member){await db.from('push_subscriptions').delete().eq('id',sub.id);continue;}const notice=reminderFor(today,sub.tax_year,sub.monthly_statement,sub.filing_reminders);if(!notice)continue;
 if(!safePushEndpoint(sub.endpoint)){await db.from('push_subscriptions').delete().eq('id',sub.id);continue;}
 // Claim before sending: a retry cannot duplicate a notification for this date.
 const {data:claimed}=await db.from('push_subscriptions').update({last_sent_date:today}).eq('id',sub.id).or(`last_sent_date.is.null,last_sent_date.neq.${today}`).select('id');if(!claimed?.length)continue;
 try{await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},JSON.stringify({...notice,url:'./',tag:'hisaab-check-in-'+today}),{TTL:86400,urgency:'normal',timeout:8000});sent++;}
 catch(e){const code=(e as {statusCode?:number}).statusCode;if(code===404||code===410){await db.from('push_subscriptions').delete().eq('id',sub.id);expired++;}}
 }
 return Response.json({sent,expired,date:today},{headers:cors});
});
