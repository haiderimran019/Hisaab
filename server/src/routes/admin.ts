/* Admin. Guarded by a bearer token compared in constant time.

   The sales ledger lives here because COMMERCIAL.md §7 requires one before any
   money is taken: "a sales ledger recording every key: id, name, plan, amount,
   date, expiry". Keys themselves are still minted offline by
   tools/make-license.mjs — the private signing key is not on this server and
   must never be. These endpoints record a sale that already happened and email
   the finished key to the buyer.

   An admin token is not a reason to relax the allow-list. Every body here still
   goes through a reader in validate.ts, so the service remains incapable of
   accepting a figure from anybody's books. */
import {readIssue,readReviewer,readLicenceStatus,readReviewerStatus,readReminderRun,cleanEmail} from '../validate';
import {json,fail,readJson} from '../http';
import {sendLicenceKey} from '../mail';
import {runReminders,due} from '../reminders';
import type {Route} from '../routes';

/** Calendar years, so a key bought on 3 March runs to 3 March. */
export function addYears(dayIso:string,years:number){
 const [y,m,d]=dayIso.split('-').map(Number);
 const date=new Date(Date.UTC(y+years,m-1,d));
 return date.toISOString().slice(0,10);
}

export const subscribers:Route={
 method:'GET',path:'/v1/admin/subscribers',auth:'admin',
 async handle({url,store,origin}){
  const limit=Math.min(1000,Math.max(1,Number(url.searchParams.get('limit')??'200')||200));
  return json({subscribers:await store.listConfirmed(limit),
   counts:await store.countSubscribers()},200,origin);
 }
};

export const purge:Route={
 method:'POST',path:'/v1/admin/purge',auth:'admin',
 async handle({store,origin,day,now}){
  await store.purgeRatesBefore(day);
  await store.purgeExpired(now);
  return json({ok:true,purged:['rate_limit','auth_tokens','sessions']},200,origin);
 }
};

/* Record a sale and email the key. Idempotent on key_id, so a retried request
   does not create a second ledger row for one payment. */
export const issue:Route={
 method:'POST',path:'/v1/admin/licence',auth:'admin',
 async handle({request,env,store,origin,day,now}){
  const body=readIssue(await readJson(request));
  if(!body.ok)return fail(body,origin);
  const v=body.value;
  const expiresAt=addYears(day,v.years);
  const added=await store.addLicence({keyId:v.keyId,licenceKey:v.licenceKey,
   email:v.email,name:v.name,plan:v.plan,amountMinor:v.amountMinor,currency:v.currency,
   paymentRef:v.paymentRef,issuedAt:now,expiresAt,status:'active',note:''});
  if(!added)
   return json({error:'That key id is already in the ledger. Nothing was changed.',keyId:v.keyId},409,origin);
  const mail=await sendLicenceKey(env,v.email,v.name,v.plan,v.licenceKey,expiresAt);
  return json({ok:true,keyId:v.keyId,expiresAt,
   emailed:mail.sent,
   mail:mail.sent?'sent':mail.reason,
   note:mail.sent?undefined:'The sale is recorded but no email was sent. Send the key by hand, or set RESEND_KEY and MAIL_FROM and use /v1/portal/resend.'
  },201,origin);
 }
};

export const lookup:Route={
 method:'GET',path:'/v1/admin/licence',auth:'admin',
 async handle({url,store,origin}){
  const email=cleanEmail(url.searchParams.get('email'));
  if(!email.ok)return fail(email,origin);
  return json({email:email.value,licences:await store.licencesByEmail(email.value)},200,origin);
 }
};

/* A refund marks the ledger row. It does not revoke the key, and saying so
   plainly is the honest position: keys are verified offline, so nothing here can
   reach a device. The 14-day refund promise in src/pricing.ts is kept by
   returning money, not by breaking software someone already installed. */
export const licenceStatus:Route={
 method:'POST',path:'/v1/admin/licence/status',auth:'admin',
 async handle({request,store,origin}){
  const body=readLicenceStatus(await readJson(request));
  if(!body.ok)return fail(body,origin);
  const {keyId,status,note}=body.value;
  const changed=await store.setLicenceStatus(keyId,status,note);
  if(!changed)return json({error:'No such key id in the ledger.'},404,origin);
  return json({ok:true,keyId,status,
   note:'The ledger is updated. The key itself is verified offline on the customer device and is not revoked by this.'},200,origin);
 }
};

export const addReviewer:Route={
 method:'POST',path:'/v1/admin/reviewer',auth:'admin',
 async handle({request,store,origin,now}){
  const body=readReviewer(await readJson(request));
  if(!body.ok)return fail(body,origin);
  const id=crypto.randomUUID();
  // Created as 'pending' on purpose: being in the table is not being published.
  // Activate only once the registration number has actually been checked.
  await store.addReviewer({id,...body.value,status:'pending',createdAt:now});
  return json({ok:true,id,status:'pending',
   next:'Check the registration number with their own body, then POST /v1/admin/reviewer/status to publish them.'},201,origin);
 }
};

export const reviewerStatus:Route={
 method:'POST',path:'/v1/admin/reviewer/status',auth:'admin',
 async handle({request,store,origin}){
  const body=readReviewerStatus(await readJson(request));
  if(!body.ok)return fail(body,origin);
  const {id,status}=body.value;
  const changed=await store.setReviewerStatus(id,status);
  if(!changed)return json({error:'No such reviewer.'},404,origin);
  return json({ok:true,id,status},200,origin);
 }
};

export const allReviewers:Route={
 method:'GET',path:'/v1/admin/reviewers',auth:'admin',
 async handle({store,origin}){
  const [pending,active,suspended]=await Promise.all([
   store.listReviewers('pending'),store.listReviewers('active'),store.listReviewers('suspended')]);
  return json({pending,active,suspended},200,origin);
 }
};

/* The reminder run, by hand. The cron in wrangler.toml calls the same function
   through scheduled() in index.ts; this exists so a run can be inspected before
   it is trusted, and so a missed cron can be caught up deliberately.

   It defaults to a dry run. Sending email to every confirmed address is not
   something a mistyped curl should do, so the caller has to ask for it with
   dryRun:false. */
export const reminders:Route={
 method:'POST',path:'/v1/admin/reminders',auth:'admin',
 async handle({request,env,store,origin,day}){
  const body=readReminderRun(await readJson(request));
  if(!body.ok)return fail(body,origin);
  const on=body.value.day||day;
  const result=await runReminders(env,store,on,{dryRun:body.value.dryRun});
  return json(result,200,origin);
 }
};

/** What is coming, without running anything. Useful for checking the cron is
    pointed at a day that actually has a milestone on it. */
export const reminderSchedule:Route={
 method:'GET',path:'/v1/admin/reminders',auth:'admin',
 async handle({url,store,origin,day}){
  const on=/^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('day')??'')
   ? url.searchParams.get('day')! : day;
  return json({day:on,due:due(on),
   confirmedAddresses:(await store.countSubscribers()).confirmed},200,origin);
 }
};

export const adminRoutes=[subscribers,purge,issue,lookup,licenceStatus,
 addReviewer,reviewerStatus,allReviewers,reminders,reminderSchedule];
