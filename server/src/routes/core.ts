/* Health, usage counting, and the mailing list — the routes that existed before
   the portal, moved out of index.ts unchanged in behaviour. */
import {readBeacon,readSubscribe,randomToken} from '../validate';
import {json,html,fail,escapeAttr} from '../http';
import {readJson} from '../http';
import {sendConfirmation} from '../mail';
import type {Route} from '../routes';
import type {Subscriber} from '../store';

export const health:Route={
 method:'GET',path:'/v1/health',auth:'public',
 async handle({origin,day}){return json({ok:true,service:'hisaab',day},200,origin);}
};

export const usage:Route={
 method:'POST',path:'/v1/usage',auth:'public',
 limit:{bucket:'u',perDay:20},
 async handle({request,store,origin,day}){
  const beacon=readBeacon(await readJson(request),day);
  if(!beacon.ok)return fail(beacon,origin);
  await store.bumpUsage(beacon.value.day,beacon.value.plan,beacon.value.appVersion);
  return json({ok:true},202,origin);
 }
};

export const stats:Route={
 method:'GET',path:'/v1/stats',auth:'public',
 async handle({store,origin,day}){
  const [byDay,totals,subscribers]=await Promise.all([
   store.usageByDay(30,day),store.usageTotals(),store.countSubscribers()]);
  return json({
   note:'Opens, not people. Hisaab sends no device identifier, so one person using two browsers counts twice and anyone who switched the ping off counts zero.',
   last30Days:byDay,byPlan:totals,
   opensLast30:byDay.reduce((a,b)=>a+b.opens,0),
   confirmedSubscribers:subscribers.confirmed
  },200,origin);
 }
};

export const subscribe:Route={
 method:'POST',path:'/v1/subscribe',auth:'public',
 limit:{bucket:'s',perDay:5},
 async handle({request,env,store,origin,now}){
  const body=readSubscribe(await readJson(request));
  if(!body.ok)return fail(body,origin);
  const token=randomToken();
  const subscriber:Subscriber={email:body.value.email,status:'pending',token,
   source:body.value.source,createdAt:now,confirmedAt:null};
  const added=await store.addSubscriber(subscriber);
  // The same answer either way: whether an address is already on the list is
  // not something a stranger should be able to probe.
  if(added)await sendConfirmation(env,body.value.email,token);
  return json({ok:true,message:'If that address can receive mail, a confirmation is on its way.'},202,origin);
 }
};

export const confirm:Route={
 method:'GET',path:'/v1/confirm',auth:'public',
 async handle({url,env,store,now}){
  const token=url.searchParams.get('token')??'';
  if(!/^[0-9a-f]{48}$/.test(token))
   return html('<h1>That link is not valid</h1><p>Check you copied the whole thing.</p>',400);
  const found=await store.findByToken(token);
  if(!found)return html('<h1>That link is not valid</h1><p>It may already have been used.</p>',404);
  if(found.status!=='confirmed')await store.setStatus(token,'confirmed',now);
  return html(`<h1>Confirmed</h1><p>We will send your licence key and occasional updates to this address, and nothing else.</p>
   <p>Your records never reach us — they stay encrypted on your device.</p>
   <p><a href="${escapeAttr(env.ALLOWED_ORIGIN.split(',')[0])}">Back to Hisaab</a> ·
   <a href="/v1/unsubscribe?token=${escapeAttr(token)}">Unsubscribe</a></p>`);
 }
};

export const unsubscribeGet:Route={
 method:'GET',path:'/v1/unsubscribe',auth:'public',
 async handle({url,store}){
  const token=url.searchParams.get('token')??'';
  if(!/^[0-9a-f]{48}$/.test(token))return html('<h1>That link is not valid</h1>',400);
  const changed=await store.setStatus(token,'unsubscribed',null);
  return changed
   ?html(`<h1>Unsubscribed</h1><p>We will not email that address again. Nothing else of yours was ever here.</p>
     <p>If you would rather the address were deleted outright than marked, reply to any
     Hisaab email asking for erasure and it is removed from the table entirely.</p>`)
   :html('<h1>That link is not valid</h1>',404);
 }
};

/** One-click unsubscribe as RFC 8058 wants it: a POST that needs no login. */
export const unsubscribePost:Route={
 method:'POST',path:'/v1/unsubscribe',auth:'public',
 async handle({url,store,origin}){
  const token=url.searchParams.get('token')??'';
  if(!/^[0-9a-f]{48}$/.test(token))return json({error:'That link is not valid.'},400,origin);
  const changed=await store.setStatus(token,'unsubscribed',null);
  return json({ok:changed},changed?200:404,origin);
 }
};

export const coreRoutes=[health,usage,stats,subscribe,confirm,unsubscribeGet,unsubscribePost];
