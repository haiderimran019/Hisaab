/* The licence portal.

   What a signed-in session can do, in full: see which keys this email bought,
   have one emailed again, and ask for everything we hold about the address to be
   deleted. That is the whole surface. There is no endpoint here that reads a
   workspace, because no workspace exists on this side — the vault is unlocked on
   the device by a passkey or a passphrase and this service cannot open it.

   Sign-in never leaks whether an address is known: asking for a link gives the
   same answer either way. */
import {readSignIn,readSignInExchange,readErasure,randomToken} from '../validate';
import {json,fail,readJson} from '../http';
import {verifyGoogleIdToken,hashEmail,plusMinutes,plusDays,AUTH_TOKEN_MINUTES,SESSION_DAYS} from '../auth';
import {sendSignInLink,sendLicenceKey} from '../mail';
import type {Route} from '../routes';

/** What a customer is shown about their own licence. Deliberately not the whole
    ledger row: `amount_minor`, `payment_ref` and `note` are our bookkeeping. */
const forCustomer=(l:{keyId:string;licenceKey:string;name:string;plan:string;issuedAt:string;expiresAt:string;status:string})=>({
 keyId:l.keyId,key:l.licenceKey,name:l.name,plan:l.plan,
 issuedAt:l.issuedAt,expiresAt:l.expiresAt,status:l.status});

export const signIn:Route={
 method:'POST',path:'/v1/portal/signin',auth:'public',
 limit:{bucket:'p',perDay:12},
 async handle({request,env,store,origin,now}){
  const body=readSignIn(await readJson(request));
  if(!body.ok)return fail(body,origin);

  if(body.value.method==='google'){
   const identity=await verifyGoogleIdToken(body.value.idToken,env.GOOGLE_CLIENT_ID??'',Date.parse(now));
   if(!identity.ok)return fail(identity,origin);
   const token=randomToken();
   await store.addSession({token,email:identity.value.email,method:'google',
    createdAt:now,expiresAt:plusDays(now,SESSION_DAYS)});
   return json({ok:true,session:token,email:identity.value.email,
    expiresAt:plusDays(now,SESSION_DAYS)},200,origin);
  }

  const token=randomToken();
  await store.addAuthToken({token,email:body.value.email,createdAt:now,
   expiresAt:plusMinutes(now,AUTH_TOKEN_MINUTES),usedAt:null});
  const mail=await sendSignInLink(env,body.value.email,token,AUTH_TOKEN_MINUTES);
  // Identical response whether or not that address has ever bought anything.
  return json({ok:true,
   message:`If that address can receive mail, a sign-in link is on its way. It works once and expires in ${AUTH_TOKEN_MINUTES} minutes.`,
   mail:mail.sent?'sent':'not configured'},202,origin);
 }
};

export const exchange:Route={
 method:'POST',path:'/v1/portal/session',auth:'public',
 limit:{bucket:'e',perDay:30},
 async handle({request,store,origin,now}){
  const body=readSignInExchange(await readJson(request));
  if(!body.ok)return fail(body,origin);
  const found=await store.findAuthToken(body.value.token);
  if(!found)return json({error:'That sign-in link is not valid. Ask for a new one.'},401,origin);
  if(found.expiresAt<now)return json({error:'That sign-in link has expired. Ask for a new one.'},401,origin);
  // Single-use, and the check is the write: if two requests race, one loses.
  const claimed=await store.markAuthTokenUsed(body.value.token,now);
  if(!claimed)return json({error:'That sign-in link has already been used. Ask for a new one.'},401,origin);
  const token=randomToken();
  await store.addSession({token,email:found.email,method:'link',
   createdAt:now,expiresAt:plusDays(now,SESSION_DAYS)});
  return json({ok:true,session:token,email:found.email,expiresAt:plusDays(now,SESSION_DAYS)},200,origin);
 }
};

export const licences:Route={
 method:'GET',path:'/v1/portal/licences',auth:'session',
 async handle({store,origin,session}){
  const rows=await store.licencesByEmail(session!.email);
  return json({email:session!.email,licences:rows.map(forCustomer),
   note:'Your key is checked on your own device. Hisaab never phones home to validate it, so it keeps working offline and we cannot tell whether you still use it.'},200,origin);
 }
};

export const resend:Route={
 method:'POST',path:'/v1/portal/resend',auth:'session',
 limit:{bucket:'r',perDay:10},
 async handle({env,store,origin,session}){
  const rows=(await store.licencesByEmail(session!.email)).filter(l=>l.status==='active'&&l.licenceKey);
  if(!rows.length)return json({error:'There is no active licence on this address.'},404,origin);
  const sent=await Promise.all(rows.map(l=>
   sendLicenceKey(env,session!.email,l.name,l.plan,l.licenceKey,l.expiresAt)));
  const delivered=sent.filter(s=>s.sent).length;
  return json({ok:delivered>0,emailed:delivered,
   message:delivered>0
    ?'Sent. Check your inbox, and your spam folder if it is not there.'
    :'This service has no mail provider configured, so nothing was sent. Your keys are listed above.'},
   delivered>0?200:503,origin);
 }
};

/* A real delete, which server/README.md named as the missing path. Permanent,
   confirmed in the body, and recorded as a hash so we can answer "did you
   honour my request" without keeping the address we were asked to forget. */
export const erase:Route={
 method:'POST',path:'/v1/portal/erase',auth:'session',
 limit:{bucket:'d',perDay:5},
 async handle({request,env,store,origin,session,now}){
  const body=readErasure(await readJson(request));
  if(!body.ok)return fail(body,origin);
  const email=session!.email;
  const removed=await store.eraseEmail(email,await hashEmail(email,env.RATE_SECRET),body.value.scope,now);
  return json({ok:true,erased:removed,scope:body.value.scope,
   message:body.value.scope==='all'
    ?'Deleted. Your address, your sales records and any review requests are gone from this service. Keys already issued keep working on your device — they are verified offline and we could not revoke them if we wanted to.'
    :'Deleted.'},200,origin);
 }
};

export const signOut:Route={
 method:'POST',path:'/v1/portal/signout',auth:'session',
 async handle({store,origin,session}){
  await store.deleteSession(session!.token);
  return json({ok:true},200,origin);
 }
};

export const portalRoutes=[signIn,exchange,licences,resend,erase,signOut];
