/* Talking to the Hisaab service — the only code in the app that may do so.

   Rules this file exists to keep:
   - Nothing financial is ever sent. The usage ping is a date, a build string and
     a plan word. There is no code path here that can read a receipt, a client, a
     statement line or a tax figure, and the service rejects such fields anyway.
   - No identifier is sent. Not an install id, not a device id, not an email. The
     service therefore counts opens, not people, and we say so rather than
     pretending otherwise.
   - The opt-out lives in plain localStorage, not in the encrypted workspace, so
     it is honoured before anything is unlocked and in the demo too.
   - With no API base configured, every function here does nothing at all. That is
     the default, so a build nobody has deployed a service for is genuinely silent. */
import type {LicenseStatus} from './license';

/** Set this to the deployed Worker URL. Empty means: contact nothing, ever. */
export const API_BASE='';
export const APP_VERSION='1.1.0';
const PING_DAY_KEY='hisaab.ping.day';
const PING_OFF_KEY='hisaab.ping.off';

export const serviceConfigured=()=>API_BASE.trim().length>0;

export function pingEnabled(){
 if(!serviceConfigured())return false;
 try{return localStorage.getItem(PING_OFF_KEY)!=='1';}catch{return false;}
}
export function setPingEnabled(on:boolean){
 try{on?localStorage.removeItem(PING_OFF_KEY):localStorage.setItem(PING_OFF_KEY,'1');}catch{/* storage blocked: stays off */}
}

const planWord=(status:LicenseStatus)=>
 status.state==='active'?status.plan:status.state==='trial'?'trial':'free';

/** Sends at most one ping per local day. Failure is silent by design: a counter is
    never worth an error in front of someone doing their tax. */
export async function pingOnce(status:LicenseStatus,todayIso:string){
 if(!pingEnabled())return {sent:false,reason:'off'};
 try{
  if(localStorage.getItem(PING_DAY_KEY)===todayIso)return {sent:false,reason:'already today'};
  // Written before the request, so a flaky network cannot cause a retry storm.
  localStorage.setItem(PING_DAY_KEY,todayIso);
 }catch{return {sent:false,reason:'no storage'};}
 try{
  await fetch(`${API_BASE}/v1/usage`,{
   method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({day:todayIso,appVersion:APP_VERSION,plan:planWord(status)}),
   keepalive:true,mode:'cors',credentials:'omit',referrerPolicy:'no-referrer'
  });
  return {sent:true,reason:''};
 }catch{return {sent:false,reason:'unreachable'};}
}

/** The only call that sends anything a person typed, and only the address itself. */
export async function subscribe(email:string,source='app'){
 if(!serviceConfigured())throw Error('No Hisaab service is configured in this build, so there is nowhere to send that.');
 const response=await fetch(`${API_BASE}/v1/subscribe`,{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({email:email.trim().toLowerCase(),consent:true,source}),
  mode:'cors',credentials:'omit',referrerPolicy:'no-referrer'
 });
 const body=await response.json().catch(()=>({})) as {error?:string;message?:string};
 if(!response.ok)throw Error(body.error??'That could not be sent right now. Try again later.');
 return body.message??'Check your inbox for a confirmation link.';
}
