/* Entitlements from an offline-verifiable licence key.

   Honest statement of what this is and is not:
   - The key is signed with the publisher's private ECDSA P-256 key and verified in
     the browser against the public key below. A key cannot be forged without that
     private key, and verification needs no server and no account.
   - Enforcement is client-side. Someone who edits the published JavaScript can lift
     the gate. That is accepted: the paid value is maintained rules, imports that
     keep working, and support — not secrecy. Do not describe this as DRM.
   - An expired or absent key never locks a customer out of their own records. Every
     record stays readable and every CSV export stays available. Only the paid
     workflow steps stop. */
import type {PlanId} from './pricing';

export const PUBLIC_KEY_JWK:JsonWebKey|null={"kty":"EC","crv":"P-256","x":"Qv9vOxeOX54gnHoy0K46UZrY5CbPtibuUJmUz8rdI0Q","y":"SbPp082N7iCkV19P-534Kv7IS548X_QyLcsMaj8ct4s","ext":true};
export const KEY_PREFIX='HSB1';
export const TRIAL_DAYS=14;

export type LicensePayload={v:1;id:string;name:string;plan:Exclude<PlanId,'free'>;issued:string;expires:string;seats?:number};
export type LicenseStatus=
 |{state:'none';plan:'free';reason:string}
 |{state:'trial';plan:'pro';expires:string;daysLeft:number}
 |{state:'active';plan:Exclude<PlanId,'free'>;payload:LicensePayload;daysLeft:number}
 |{state:'expired';plan:'free';payload:LicensePayload;reason:string}
 |{state:'invalid';plan:'free';reason:string};

export type Limits={accounts:number;importsPerMonth:number;rowsPerImport:number;filingPack:boolean;multiClient:boolean};
export const LIMITS:Record<'free'|'pro'|'accountant',Limits>={
 free:{accounts:1,importsPerMonth:1,rowsPerImport:60,filingPack:false,multiClient:false},
 pro:{accounts:10,importsPerMonth:Infinity,rowsPerImport:8000,filingPack:true,multiClient:false},
 accountant:{accounts:40,importsPerMonth:Infinity,rowsPerImport:8000,filingPack:true,multiClient:true}
};

const b64urlToBytes=(s:string)=>{
 const padded=s.replace(/-/g,'+').replace(/_/g,'/')+'=='.slice(0,(4-s.length%4)%4);
 return Uint8Array.from(atob(padded),c=>c.charCodeAt(0));
};
export const normalizeKey=(s:string)=>s.replace(/[\s ]/g,'');

function readPayload(raw:unknown):LicensePayload{
 if(!raw||typeof raw!=='object')throw Error('Key contents are not readable.');
 const p=raw as Record<string,unknown>;
 const iso=/^\d{4}-\d{2}-\d{2}$/;
 if(p.v!==1)throw Error('This key was issued for a different version of Hisaab.');
 if(typeof p.id!=='string'||!p.id)throw Error('Key is missing its identifier.');
 if(typeof p.name!=='string')throw Error('Key is missing its holder name.');
 if(p.plan!=='pro'&&p.plan!=='accountant')throw Error('Key names a plan this version does not know.');
 if(typeof p.issued!=='string'||!iso.test(p.issued))throw Error('Key issue date is not readable.');
 if(typeof p.expires!=='string'||!iso.test(p.expires))throw Error('Key expiry date is not readable.');
 return {v:1,id:p.id.slice(0,80),name:p.name.slice(0,120),plan:p.plan,issued:p.issued,expires:p.expires,
  seats:typeof p.seats==='number'&&Number.isInteger(p.seats)&&p.seats>0&&p.seats<=500?p.seats:undefined};
}

const daysBetween=(from:string,to:string)=>Math.round((Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86400000);

/** Verifies the signature, then the dates. Never throws: the caller shows the reason. */
export async function checkLicense(key:string,todayIso:string,publicKeyJwk:JsonWebKey|null=PUBLIC_KEY_JWK):Promise<LicenseStatus>{
 const clean=normalizeKey(key);
 if(!clean)return {state:'none',plan:'free',reason:'No licence key entered.'};
 if(!publicKeyJwk)return {state:'invalid',plan:'free',reason:'This build was published without a licence verification key, so keys cannot be checked.'};
 const parts=clean.split('.');
 if(parts.length!==3||parts[0]!==KEY_PREFIX)return {state:'invalid',plan:'free',reason:'That does not look like a Hisaab key. Paste the whole key, starting with HSB1.'};
 let payload:LicensePayload,signed:Uint8Array,signature:Uint8Array;
 try{
  signed=b64urlToBytes(parts[1]);
  signature=b64urlToBytes(parts[2]);
  payload=readPayload(JSON.parse(new TextDecoder().decode(signed)));
 }catch(e){return {state:'invalid',plan:'free',reason:e instanceof Error?e.message:'Key could not be read.'};}
 let ok=false;
 try{
  const publicKey=await crypto.subtle.importKey('jwk',publicKeyJwk,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  ok=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},publicKey,signature as BufferSource,signed as BufferSource);
 }catch{return {state:'invalid',plan:'free',reason:'This browser could not check the key signature.'};}
 if(!ok)return {state:'invalid',plan:'free',reason:'The signature on this key does not match. Check for a missing character, or ask for a fresh key.'};
 const daysLeft=daysBetween(todayIso,payload.expires);
 if(daysLeft<0)return {state:'expired',plan:'free',payload,reason:`This key covered you to ${payload.expires}. Your records are untouched; renew to use imports and the Filing Pack again.`};
 return {state:'active',plan:payload.plan,payload,daysLeft};
}

export function trialStatus(trialStarted:string,todayIso:string):LicenseStatus{
 if(!trialStarted)return {state:'none',plan:'free',reason:'No licence key entered.'};
 const used=daysBetween(trialStarted,todayIso);
 const left=TRIAL_DAYS-used;
 if(used<0||left<=0)return {state:'none',plan:'free',reason:'Your Pro trial has finished.'};
 const expires=new Date(Date.parse(trialStarted+'T00:00:00Z')+TRIAL_DAYS*86400000).toISOString().slice(0,10);
 return {state:'trial',plan:'pro',expires,daysLeft:left};
}

export const limitsFor=(status:LicenseStatus)=>LIMITS[status.plan];
export function planLabel(status:LicenseStatus){
 switch(status.state){
  case 'active':return status.plan==='accountant'?'Accountant':'Pro';
  case 'trial':return `Pro trial · ${status.daysLeft} day${status.daysLeft===1?'':'s'} left`;
  case 'expired':return 'Expired — Free';
  default:return 'Free';
 }
}
/** Imports already made in the calendar month of `todayIso`. */
export const importsThisMonth=(batches:{importedAt:string}[],todayIso:string)=>
 batches.filter(b=>b.importedAt.slice(0,7)===todayIso.slice(0,7)).length;
