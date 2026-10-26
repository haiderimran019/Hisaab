/* Reading a statement the customer cannot export as CSV.

   The rules in src/extract.ts still hold — nothing stored, nothing trusted,
   licence verified here rather than in the browser. Two gates are added, and
   both were named as gaps rather than invented:

   1. **A per-licence annual cap.** server/README.md: "At PKR 2,400/year per
      customer, uncapped extraction will eat the margin... add a per-licence
      annual cap before you advertise it." The per-IP cap stops a flood; this
      stops one paying customer costing more than they pay.

   2. **A country gate.** This is the only route that sends a customer's
      financial document outside Pakistan. Pakistan has no enacted data
      protection act today, but the pending bill would restrict exactly this, and
      its "critical" and "sensitive" categories are loosely drawn. Setting
      EXTRACT_BLOCKED_COUNTRIES=PK refuses the route for callers there, the same
      day, without redeploying the app or rebuilding anything. The rest of the
      product is unaffected because the rest of the product never leaves the
      device. */
import {readExtractRequest,licenceAllows,readModelRows,providerFor} from '../extract';
import {readQuotaRequest} from '../validate';
import {json,fail,readLargeJson} from '../http';
import {extractConfigured,extractAnnualCap,blockedCountries} from '../env';
import type {Route} from '../routes';

/** Pakistan's tax year runs July to June, so the quota resets with it rather
    than on 1 January — a filing season should get a whole allowance. */
export function taxYearOf(day:string){
 const [year,month]=day.split('-').map(Number);
 return String(month>=7?year+1:year);
}

export const extract:Route={
 method:'POST',path:'/v1/extract',auth:'public',
 limit:{bucket:'x',perDay:12},
 largeBody:true,
 async handle({request,env,store,origin,day,country}){
  if(!extractConfigured(env))
   return json({error:'Document reading is not switched on for this service.'},501,origin);
  // Consent is meaningless if the recipient cannot be named, so refuse to read
  // anything until READER_NAME is set — the client enforces this too.
  if(!env.READER_NAME)
   return json({error:'Document reading is not switched on, because this service has not published who reads the document.'},501,origin);

  if(country&&blockedCountries(env).includes(country))
   return json({error:'Reading documents is unavailable in your country, because it would send your statement to a reader outside it. Import a CSV instead — that never leaves your device.'},451,origin);

  const parsed=readExtractRequest(await readLargeJson(request));
  if(!parsed.ok)return fail(parsed,origin);
  const licence=await licenceAllows(parsed.value.licence,env.LICENCE_PUBLIC_KEY??'',day);
  if(!licence.ok)return fail(licence,origin);

  const year=taxYearOf(day);
  const cap=extractAnnualCap(env);
  const used=await store.bumpExtractQuota(licence.value.id,year);
  if(used>cap)
   return json({error:`That licence has read ${cap} documents this tax year, which is the limit included. Import a CSV, or get in touch if you genuinely need more.`,
    used:cap,cap},429,origin);

  const provider=providerFor(env.MODEL_PROVIDER!,env.MODEL_NAME!,env.MODEL_KEY!,
   parsed.value.mime,parsed.value.data);
  if(!provider)return json({error:'This service is configured with a model provider it does not know.'},500,origin);

  let text='';
  try{
   const upstream=await fetch(provider.url,{method:'POST',headers:provider.headers,
    body:JSON.stringify(provider.body)});
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
   rows,read:rows.length,
   reader:env.READER_NAME,
   quota:{used,cap,taxYear:year},
   note:'These rows were read by a machine and nothing here has been checked. Hisaab will test them against the running balance on your statement, and you confirm every one. Nothing was stored by this service.'
  },200,origin);
 }
};

/** Lets the app show the remaining allowance without sending a document. */
export const quota:Route={
 method:'POST',path:'/v1/extract/quota',auth:'public',
 limit:{bucket:'k',perDay:60},
 async handle({request,env,store,origin,day}){
  const body=readQuotaRequest(await readLargeJson(request));
  if(!body.ok)return fail(body,origin);
  const licence=await licenceAllows(body.value.licence,env.LICENCE_PUBLIC_KEY??'',day);
  if(!licence.ok)return fail(licence,origin);
  const year=taxYearOf(day);
  return json({
   taxYear:year,
   used:await store.extractQuotaUsed(licence.value.id,year),
   cap:extractAnnualCap(env),
   available:extractConfigured(env)&&Boolean(env.READER_NAME)
  },200,origin);
 }
};

export const documentRoutes=[extract,quota];
