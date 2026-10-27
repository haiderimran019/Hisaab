/* Hisaab service — the entry point, and nothing else.

   What this service does: holds email addresses people actively gave us, counts
   how many times the app is opened, sells and re-delivers licence keys, brokers
   paid practitioner reviews, and reads a statement document on request.

   What it refuses, still and permanently: storing anything from a customer's
   books. There is no endpoint, no column and no accepted field for an income
   figure, a client name, a statement row, an invoice or a tax figure. The review
   broker holds a pack's fingerprint — a hash — and never the pack. See
   src/validate.ts, schema.sql, and the test that fires real-looking financial
   payloads at every route in the table.

   Everything specific to a route now lives in src/routes/. This file does only
   the things that must happen identically for all of them: decide who may call,
   rate-limit, resolve a session or an admin token, dispatch, and never leak an
   internal error. A new endpoint is an entry in the table below. */
import {rateKey} from './validate';
import {json,preflight,corsOrigin} from './http';
import {bearer} from './auth';
import {buildTable,methodsFor,type Ctx,type Route} from './routes';
import {d1Store,type Store} from './store';
import {runReminders} from './reminders';
import type {Env} from './env';
import {coreRoutes} from './routes/core';
import {portalRoutes} from './routes/portal';
import {reviewRoutes} from './routes/review';
import {documentRoutes} from './routes/documents';
import {adminRoutes} from './routes/admin';

export type {Env} from './env';

/** The whole surface of the service, in one readable list. */
export const ROUTES:Route[]=[
 ...coreRoutes,
 ...portalRoutes,
 ...reviewRoutes,
 ...documentRoutes,
 ...adminRoutes
];
const TABLE=buildTable(ROUTES);

const todayUtc=()=>new Date().toISOString().slice(0,10);

export async function handle(request:Request,env:Env,store:Store):Promise<Response>{
 const url=new URL(request.url);
 const origin=corsOrigin(request,env.ALLOWED_ORIGIN??'');
 const path=url.pathname.replace(/\/+$/,'')||'/';

 if(request.method==='OPTIONS')return preflight(origin);

 // Browser calls must come from an origin we published. Server-side calls (no
 // Origin header) fall through to the admin token check where it matters.
 if(request.headers.get('origin')&&!origin)
  return json({error:'This origin is not allowed to call the Hisaab service.'},403,'');

 const route=TABLE.get(`${request.method} ${path}`);
 if(!route){
  const allowed=methodsFor(TABLE,path);
  if(allowed.length)
   return json({error:`That endpoint accepts ${allowed.join(' and ')}.`},405,origin);
  return json({error:'No such endpoint.'},404,origin);
 }

 const now=new Date().toISOString();
 const ctx:Ctx={
  request,env,store,url,origin,
  ip:request.headers.get('cf-connecting-ip')??request.headers.get('x-forwarded-for')??'unknown',
  day:todayUtc(),
  now,
  country:(request.headers.get('cf-ipcountry')??'').toUpperCase()
 };

 try{
  if(route.limit){
   const key=await rateKey(ctx.ip,ctx.day,env.RATE_SECRET??'')+':'+route.limit.bucket;
   const count=await store.bumpRate(key,ctx.day);
   if(count>route.limit.perDay)
    return json({error:'That is as many of those as this service accepts from one place in a day.'},429,origin);
  }

  if(route.auth==='admin'){
   const given=bearer(request);
   if(!env.ADMIN_TOKEN||given.length!==env.ADMIN_TOKEN.length||!constantEquals(given,env.ADMIN_TOKEN))
    return json({error:'Not authorised.'},401,origin);
  }

  if(route.auth==='session'){
   const token=bearer(request);
   if(!/^[0-9a-f]{48}$/.test(token))
    return json({error:'Sign in to do that.'},401,origin);
   const session=await store.findSession(token);
   if(!session)return json({error:'Sign in to do that.'},401,origin);
   if(session.expiresAt<now){
    await store.deleteSession(token);
    return json({error:'That session has expired. Sign in again.'},401,origin);
   }
   ctx.session=session;
  }

  return await route.handle(ctx);
 }catch(e){
  // Never echo an internal message back to a caller.
  const tooLarge=typeof e==='object'&&e!==null&&'tooLarge' in e;
  if(tooLarge)return json({error:'That request body is larger than this endpoint accepts.'},413,origin);
  console.error('hisaab-service',e instanceof Error?e.message:e);
  return json({error:'Something went wrong handling that request.'},500,origin);
 }
}

function constantEquals(a:string,b:string){
 let diff=a.length^b.length;
 for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);
 return diff===0;
}

/* The cron. wrangler.toml fires this once a day; reminders.ts decides whether
   anything falls due on the day it runs, so firing on a day with no milestone
   costs one query and sends nothing.

   Errors are logged and swallowed on purpose: a scheduled handler that throws
   gets retried by the platform, and a retry after a partial send is only safe
   because reminder_log makes it so. Logging the reason is what tells us a run
   failed at all, since nobody is watching a response code. */
export async function scheduled(event:{scheduledTime:number},env:Env,store:Store){
 const day=new Date(event.scheduledTime).toISOString().slice(0,10);
 try{
  const result=await runReminders(env,store,day);
  if(result.milestones.length)
   console.log('hisaab-reminders',JSON.stringify({day,sent:result.sent,
    skipped:result.skipped,failed:result.failed,reason:result.reason}));
  return result;
 }catch(e){
  console.error('hisaab-reminders-failed',day,e instanceof Error?e.message:e);
  return null;
 }
}

export default {
 fetch(request:Request,env:Env){return handle(request,env,d1Store(env.DB));},
 scheduled(event:{scheduledTime:number},env:Env){return scheduled(event,env,d1Store(env.DB));}
};
