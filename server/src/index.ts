/* Hisaab service — the smallest backend that does the two jobs asked of it:
     1. hold email addresses people actively gave us, so licences and updates can
        be sent, with double opt-in and one-click unsubscribe;
     2. count how many people open the app.

   And one job it refuses: storing anything financial. There is no endpoint, no
   column and no accepted field for an amount, a client, a statement row or a tax
   figure. See server/src/validate.ts and server/schema.sql. */
import {readBeacon,readSubscribe,onlyKeys,randomToken,rateKey,err,type Result} from './validate';
import {d1Store,type Store,type Subscriber} from './store';
import {readExtractRequest,licenceAllows,readModelRows,providerFor} from './extract';

export type Env={
 DB:unknown;
 ALLOWED_ORIGIN:string;      // e.g. https://haiderimran019.github.io
 RATE_SECRET:string;         // any long random string
 ADMIN_TOKEN:string;         // bearer token for the admin endpoints
 RESEND_KEY?:string;         // optional: without it, confirmation emails are skipped
 MAIL_FROM?:string;          // e.g. Hisaab <hello@yourdomain.pk>
 PUBLIC_BASE?:string;        // where /v1/confirm lives, for the link in the email
 LICENCE_PUBLIC_KEY?:string; // the JWK from src/license.ts, so paid features are checked here
 MODEL_PROVIDER?:string;     // 'gemini' or 'anthropic'. Unset = document reading is off
 MODEL_NAME?:string;
 MODEL_KEY?:string;
};

const BEACON_LIMIT=20;       // pings per IP per day
const SUBSCRIBE_LIMIT=5;     // sign-ups per IP per day
const EXTRACT_LIMIT=12;      // documents per IP per day
const todayUtc=()=>new Date().toISOString().slice(0,10);

const json=(body:unknown,status=200,origin='*')=>new Response(JSON.stringify(body),{
 status,headers:{'content-type':'application/json; charset=utf-8','access-control-allow-origin':origin,
  'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
const html=(body:string,status=200)=>new Response(
 `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Hisaab</title><style>body{font-family:system-ui,sans-serif;background:#101112;color:#f1f1f2;
  display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;line-height:1.7}
  main{max-width:34rem}h1{font-size:1.4rem}a{color:#ff762b}</style><main>${body}</main>`,
 {status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});

/** One place that decides who may call us, so a stray origin cannot. */
function corsOrigin(request:Request,env:Env){
 const origin=request.headers.get('origin');
 if(!origin)return env.ALLOWED_ORIGIN;
 const allowed=env.ALLOWED_ORIGIN.split(',').map(o=>o.trim()).filter(Boolean);
 return allowed.includes(origin)?origin:'';
}
const fail=(e:Extract<Result<unknown>,{ok:false}>,origin:string)=>json({error:e.error},e.status,origin);

async function sendConfirmation(env:Env,email:string,token:string){
 if(!env.RESEND_KEY||!env.MAIL_FROM)return {sent:false,reason:'no mail provider configured'};
 const link=`${env.PUBLIC_BASE??''}/v1/confirm?token=${token}`;
 const response=await fetch('https://api.resend.com/emails',{
  method:'POST',
  headers:{authorization:`Bearer ${env.RESEND_KEY}`,'content-type':'application/json'},
  body:JSON.stringify({
   from:env.MAIL_FROM,to:[email],subject:'Confirm your Hisaab email',
   text:`Someone asked to hear from Hisaab at this address.\n\nIf it was you, confirm here:\n${link}\n\n`+
    `If it was not you, ignore this and nothing is stored beyond an unconfirmed row that we delete.\n\n`+
    `Hisaab never receives your income, clients or statements — those stay on your device.`})
 });
 return {sent:response.ok,reason:response.ok?'':`mail provider returned ${response.status}`};
}

export async function handle(request:Request,env:Env,store:Store):Promise<Response>{
 const url=new URL(request.url);
 const origin=corsOrigin(request,env);
 const path=url.pathname.replace(/\/+$/,'')||'/';

 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{
  'access-control-allow-origin':origin,'access-control-allow-methods':'GET,POST,OPTIONS',
  'access-control-allow-headers':'content-type','access-control-max-age':'86400'}});

 // Browser calls must come from an origin we published. Server-side calls (no
 // Origin header) fall through to the admin token check where it matters.
 if(request.headers.get('origin')&&!origin)return json({error:'This origin is not allowed to call the Hisaab service.'},403,'');

 const ip=request.headers.get('cf-connecting-ip')??request.headers.get('x-forwarded-for')??'unknown';
 const day=todayUtc();

 try{
  if(path==='/v1/health'&&request.method==='GET')return json({ok:true,service:'hisaab',day},200,origin);

  if(path==='/v1/usage'&&request.method==='POST'){
   const limited=await store.bumpRate(await rateKey(ip,day,env.RATE_SECRET)+':u',day);
   if(limited>BEACON_LIMIT)return json({error:'Too many pings today.'},429,origin);
   const beacon=readBeacon(await readJson(request),day);
   if(!beacon.ok)return fail(beacon,origin);
   await store.bumpUsage(beacon.value.day,beacon.value.plan,beacon.value.appVersion);
   return json({ok:true},202,origin);
  }

  if(path==='/v1/stats'&&request.method==='GET'){
   const [byDay,totals,subscribers]=await Promise.all([store.usageByDay(30,day),store.usageTotals(),store.countSubscribers()]);
   return json({
    note:'Opens, not people. Hisaab sends no device identifier, so one person using two browsers counts twice and anyone who switched the ping off counts zero.',
    last30Days:byDay,byPlan:totals,
    opensLast30:byDay.reduce((a,b)=>a+b.opens,0),
    confirmedSubscribers:subscribers.confirmed
   },200,origin);
  }

  if(path==='/v1/subscribe'&&request.method==='POST'){
   const limited=await store.bumpRate(await rateKey(ip,day,env.RATE_SECRET)+':s',day);
   if(limited>SUBSCRIBE_LIMIT)return json({error:'Too many sign-ups from here today.'},429,origin);
   const body=readSubscribe(await readJson(request));
   if(!body.ok)return fail(body,origin);
   const token=randomToken();
   const subscriber:Subscriber={email:body.value.email,status:'pending',token,source:body.value.source,
    createdAt:new Date().toISOString(),confirmedAt:null};
   const added=await store.addSubscriber(subscriber);
   // The same answer either way: whether an address is already on the list is
   // not something a stranger should be able to probe.
   if(added)await sendConfirmation(env,body.value.email,token);
   return json({ok:true,message:'If that address can receive mail, a confirmation is on its way.'},202,origin);
  }

  if(path==='/v1/confirm'&&request.method==='GET'){
   const token=url.searchParams.get('token')??'';
   if(!/^[0-9a-f]{48}$/.test(token))return html('<h1>That link is not valid</h1><p>Check you copied the whole thing.</p>',400);
   const found=await store.findByToken(token);
   if(!found)return html('<h1>That link is not valid</h1><p>It may already have been used.</p>',404);
   if(found.status!=='confirmed')await store.setStatus(token,'confirmed',new Date().toISOString());
   return html(`<h1>Confirmed</h1><p>We will send your licence key and occasional updates to this address, and nothing else.</p>
    <p>Your records never reach us — they stay encrypted on your device.</p>
    <p><a href="${escapeAttr(env.ALLOWED_ORIGIN.split(',')[0])}">Back to Hisaab</a> ·
    <a href="/v1/unsubscribe?token=${escapeAttr(token)}">Unsubscribe</a></p>`);
  }

  if(path==='/v1/unsubscribe'){
   const token=url.searchParams.get('token')??'';
   if(!/^[0-9a-f]{48}$/.test(token))return html('<h1>That link is not valid</h1>',400);
   const changed=await store.setStatus(token,'unsubscribed',null);
   return changed
    ?html('<h1>Unsubscribed</h1><p>We will not email that address again. Nothing else of yours was ever here.</p>')
    :html('<h1>That link is not valid</h1>',404);
  }

  if(path==='/v1/extract'&&request.method==='POST'){
   // Off unless a model is configured. A service with no key reads nothing.
   if(!env.MODEL_PROVIDER||!env.MODEL_KEY||!env.MODEL_NAME)
    return json({error:'Document reading is not switched on for this service.'},501,origin);
   const limited=await store.bumpRate(await rateKey(ip,day,env.RATE_SECRET)+':x',day);
   if(limited>EXTRACT_LIMIT)return json({error:'That is as many documents as this service reads from one place in a day.'},429,origin);
   const parsed=readExtractRequest(await readJson(request));
   if(!parsed.ok)return fail(parsed,origin);
   const licence=await licenceAllows(parsed.value.licence,env.LICENCE_PUBLIC_KEY??'',day);
   if(!licence.ok)return fail(licence,origin);
   const provider=providerFor(env.MODEL_PROVIDER,env.MODEL_NAME,env.MODEL_KEY,parsed.value.mime,parsed.value.data);
   if(!provider)return json({error:'This service is configured with a model provider it does not know.'},500,origin);
   let text='';
   try{
    const upstream=await fetch(provider.url,{method:'POST',headers:provider.headers,body:JSON.stringify(provider.body)});
    if(!upstream.ok){
     // Never pass an upstream body back: it can echo the document.
     console.error('extract upstream',provider.name,upstream.status);
     return json({error:'The reader could not process that document. Try a clearer scan, or import a CSV.'},502,origin);
    }
    text=provider.pick(await upstream.json());
   }catch{
    return json({error:'The reader could not be reached. Try again shortly.'},502,origin);
   }
   const rows=readModelRows(text);
   return json({
    rows,
    read:rows.length,
    note:'These rows were read by a machine and nothing here has been checked. Hisaab will test them against the running balance on your statement, and you confirm every one. Nothing was stored by this service.'
   },200,origin);
  }

  if(path.startsWith('/v1/admin/')){
   const given=(request.headers.get('authorization')??'').replace(/^Bearer\s+/i,'');
   if(!env.ADMIN_TOKEN||given.length!==env.ADMIN_TOKEN.length||!timingSafeEqual(given,env.ADMIN_TOKEN))
    return json({error:'Not authorised.'},401,origin);
   if(path==='/v1/admin/subscribers'&&request.method==='GET'){
    const limit=Math.min(1000,Math.max(1,Number(url.searchParams.get('limit')??'200')||200));
    return json({subscribers:await store.listConfirmed(limit),counts:await store.countSubscribers()},200,origin);
   }
   if(path==='/v1/admin/purge'&&request.method==='POST'){
    await store.purgeRatesBefore(day);
    return json({ok:true},200,origin);
   }
   return json({error:'No such admin endpoint.'},404,origin);
  }

  return json({error:'No such endpoint.'},404,origin);
 }catch(e){
  // Never echo an internal message back to a caller.
  console.error('hisaab-service',e instanceof Error?e.message:e);
  return json({error:'Something went wrong handling that request.'},500,origin);
 }
}

async function readJson(request:Request):Promise<unknown>{
 const text=await request.text();
 if(text.length>4000)throw Object.assign(new Error('body too large'),{tooLarge:true});
 if(!text.trim())return {};
 try{return JSON.parse(text);}catch{return null;}
}
const escapeAttr=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function timingSafeEqual(a:string,b:string){
 let diff=a.length^b.length;
 for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);
 return diff===0;
}

export default {
 fetch(request:Request,env:Env){return handle(request,env,d1Store(env.DB));}
};
