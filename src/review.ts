/* Practitioner sign-off certificates — the "verified" tick, and what it means.

   A certificate is a signed statement by a reviewer:
     "I, <name>, registration <registration>, reviewed the Filing Pack whose
      contents hash to <digest>, for tax year <year>, on <date>."

   It is bound to a content digest, so the tick cannot be moved onto a pack whose
   numbers have since changed: edit one figure and the tick goes amber with
   "reviewed an earlier version". That is the whole point. A tick that survives an
   edit is worse than no tick.

   What the tick is NOT: it is not a government endorsement, not FBR approval, and
   not proof that the reviewer is registered — only that a holder of the reviewing
   key said so. Hisaab verifies the signature, not the credential behind it. */
import type {Workspace} from './core';

/** Reviewer keys the app will accept. Each is added deliberately, per release. */
export type Reviewer={id:string;name:string;registration:string;publicKey:JsonWebKey};
/* Deliberately empty until a real Pakistani practitioner is engaged and their key
   is added with tools/make-review.mjs --add-reviewer. Until then no tick can ever
   be shown, which is the correct state of this business today. */
export const REVIEWERS:Reviewer[]=[];
export const CERT_PREFIX='HSBREV1';

export type ReviewPayload={v:1;reviewer:string;name:string;registration:string;taxYear:number;digest:string;reviewedOn:string;note:string};
export type ReviewStatus=
 |{state:'none'}
 |{state:'verified';payload:ReviewPayload}
 |{state:'stale';payload:ReviewPayload;reason:string}
 |{state:'invalid';reason:string};

const b64urlToBytes=(s:string)=>{
 const padded=s.replace(/-/g,'+').replace(/_/g,'/')+'=='.slice(0,(4-s.length%4)%4);
 return Uint8Array.from(atob(padded),c=>c.charCodeAt(0));
};
const hex=(buffer:ArrayBuffer)=>[...new Uint8Array(buffer)].map(b=>b.toString(16).padStart(2,'0')).join('');

/** The figures a reviewer actually signed off. Presentation is excluded on
    purpose: restyling the pack must not invalidate a review, but changing a
    number, a declaration or a statement line must. */
export function packDigestInput(w:Workspace,year:number){
 const inYear=(d:string)=>{const [y,m]=d.split('-').map(Number);return y+(m>=7?1:0)===year;};
 const pick=<T extends Record<string,unknown>>(rows:T[],keys:(keyof T)[])=>
  rows.map(r=>keys.map(k=>String(r[k]??'')).join('\u001f'));
 return JSON.stringify({
  taxYear:year,
  profile:w.profile,
  receipts:pick(w.receipts.filter(r=>inYear(r.date)).slice().sort((a,b)=>a.id<b.id?-1:1),
   ['date','client','currency','gross','fee','rate','bankFee','withheld','category','taxBase','baseConfirmed','banking','evidence']),
  expenses:pick(w.expenses.filter(e=>inYear(e.date)).slice().sort((a,b)=>a.id<b.id?-1:1),
   ['date','vendor','category','amount','currency','rate','businessPct','deductible','evidence']),
  accounts:pick(w.accounts.slice().sort((a,b)=>a.id<b.id?-1:1),
   ['label','currency','opening','closing','periodStart','periodEnd','balancesConfirmed']),
  lines:pick(w.lines.slice().sort((a,b)=>a.id<b.id?-1:1),['date','amount','status','accountId','row'])
 });
}
export async function packDigest(w:Workspace,year:number):Promise<string>{
 const bytes=new TextEncoder().encode('hisaab-pack-v1:'+packDigestInput(w,year));
 return hex(await crypto.subtle.digest('SHA-256',bytes as BufferSource));
}

function readPayload(raw:unknown):ReviewPayload{
 if(!raw||typeof raw!=='object')throw Error('Certificate contents are not readable.');
 const p=raw as Record<string,unknown>;
 const str=(k:string,max:number)=>{const v=p[k];if(typeof v!=='string'||!v)throw Error(`Certificate is missing ${k}.`);return v.slice(0,max);};
 if(p.v!==1)throw Error('This certificate was issued for a different version of Hisaab.');
 if(typeof p.taxYear!=='number'||!Number.isInteger(p.taxYear))throw Error('Certificate names no tax year.');
 if(typeof p.digest!=='string'||!/^[0-9a-f]{64}$/.test(p.digest))throw Error('Certificate carries no valid pack fingerprint.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(p.reviewedOn)))throw Error('Certificate review date is not readable.');
 return {v:1,reviewer:str('reviewer',80),name:str('name',120),registration:str('registration',80),
  taxYear:p.taxYear,digest:p.digest,reviewedOn:String(p.reviewedOn),
  note:typeof p.note==='string'?p.note.slice(0,400):''};
}

/** Verifies signature, reviewer, tax year and the pack fingerprint, in that order. */
export async function checkReview(certificate:string,w:Workspace,year:number,reviewers:Reviewer[]=REVIEWERS):Promise<ReviewStatus>{
 const clean=(certificate??'').replace(/[\s ]/g,'');
 if(!clean)return {state:'none'};
 const parts=clean.split('.');
 if(parts.length!==3||parts[0]!==CERT_PREFIX)
  return {state:'invalid',reason:'That does not look like a Hisaab review certificate. Paste the whole thing, starting with HSBREV1.'};
 let payload:ReviewPayload,signed:Uint8Array,signature:Uint8Array;
 try{
  signed=b64urlToBytes(parts[1]);signature=b64urlToBytes(parts[2]);
  payload=readPayload(JSON.parse(new TextDecoder().decode(signed)));
 }catch(e){return {state:'invalid',reason:e instanceof Error?e.message:'Certificate could not be read.'};}
 const reviewer=reviewers.find(r=>r.id===payload.reviewer);
 if(!reviewer)return {state:'invalid',reason:`This release does not recognise the reviewer "${payload.reviewer}". A tick is only shown for reviewers published with the app.`};
 let ok=false;
 try{
  const key=await crypto.subtle.importKey('jwk',reviewer.publicKey,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  ok=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,signature as BufferSource,signed as BufferSource);
 }catch{return {state:'invalid',reason:'This browser could not check the certificate signature.'};}
 if(!ok)return {state:'invalid',reason:'The signature on this certificate does not match. Ask the reviewer to reissue it.'};
 if(payload.taxYear!==year)
  return {state:'stale',payload,reason:`This certificate covers tax year ${payload.taxYear}. You are looking at ${year}.`};
 const digest=await packDigest(w,year);
 if(digest!==payload.digest)
  return {state:'stale',payload,reason:'Your records have changed since this review. The tick covers the figures as they were on '+payload.reviewedOn+'. Send the reviewer an updated pack.'};
 return {state:'verified',payload};
}
export const reviewerName=(id:string,reviewers:Reviewer[]=REVIEWERS)=>reviewers.find(r=>r.id===id)?.name??id;
