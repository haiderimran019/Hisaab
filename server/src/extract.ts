/* Reading a statement the customer cannot export as CSV.

   This is the one endpoint that handles a document, so the rules around it are
   tighter than anywhere else in the service:

   - **Nothing is stored.** The file is held in memory for the length of one
     request, forwarded, and dropped. No database table, no log line, no copy.
   - **Nothing is trusted.** Whatever the model returns is parsed strictly and
     anything malformed is discarded. The rows then go back to the customer as
     *proposals*, where the running-balance check and a human decide. The model
     never writes into a ledger.
   - **It is paid and gated server-side**, by verifying the licence signature
     here rather than believing the client.
   - **It is provider-agnostic.** One env var swaps the model. Nothing about the
     product depends on which company reads the page. */
import {err,ok,onlyKeys,type Result} from './validate';

export const MAX_BASE64=6_000_000;             // ~4.5 MB of file
export const ACCEPTED=['application/pdf','image/png','image/jpeg'] as const;
export const MAX_ROWS=600;

export type ExtractRequest={licence:string;mime:string;data:string;hint:string};
export type ExtractedRow={date:string;description:string;amount:string;balance:string};

export function readExtractRequest(body:unknown):Result<ExtractRequest>{
 const checked=onlyKeys(body,['licence','mime','data','hint']);
 if(!checked.ok)return checked;
 const {licence,mime,data,hint}=checked.value;
 if(typeof licence!=='string'||!licence.startsWith('HSB1.'))return err(402,'Reading documents is part of Pro. Add your licence key in Settings.');
 if(typeof mime!=='string'||!(ACCEPTED as readonly string[]).includes(mime))
  return err(415,'Send a PDF, PNG or JPEG. Nothing else is read.');
 if(typeof data!=='string'||!data.length)return err(400,'No file content was sent.');
 if(data.length>MAX_BASE64)return err(413,'That file is too large to read. Split the statement by month.');
 if(!/^[A-Za-z0-9+/]+={0,2}$/.test(data))return err(400,'File content must be base64.');
 if(hint!==undefined&&(typeof hint!=='string'||hint.length>200))return err(400,'hint must be a short string.');
 return ok({licence,mime,data,hint:typeof hint==='string'?hint:''});
}

/* Licence verification, done here rather than taken on trust from the browser. */
const b64urlToBytes=(s:string)=>{
 const padded=s.replace(/-/g,'+').replace(/_/g,'/')+'=='.slice(0,(4-s.length%4)%4);
 const binary=atob(padded);
 return Uint8Array.from(binary,c=>c.charCodeAt(0));
};
export async function licenceAllows(key:string,publicKeyJwk:string,todayIso:string):Promise<Result<{name:string;plan:string}>>{
 if(!publicKeyJwk)return err(500,'This service has no licence key configured, so paid features cannot be checked.');
 const parts=key.replace(/\s/g,'').split('.');
 if(parts.length!==3||parts[0]!=='HSB1')return err(402,'That licence key is not readable.');
 let payload:{plan?:string;expires?:string;name?:string;v?:number};
 let signed:Uint8Array,signature:Uint8Array;
 try{
  signed=b64urlToBytes(parts[1]);signature=b64urlToBytes(parts[2]);
  payload=JSON.parse(new TextDecoder().decode(signed));
 }catch{return err(402,'That licence key is not readable.');}
 try{
  const publicKey=await crypto.subtle.importKey('jwk',JSON.parse(publicKeyJwk),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  const valid=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},publicKey,signature as BufferSource,signed as BufferSource);
  if(!valid)return err(402,'That licence key does not verify.');
 }catch{return err(500,'The licence key could not be checked.');}
 if(payload.v!==1||typeof payload.expires!=='string')return err(402,'That licence key is not one this service knows.');
 if(payload.expires<todayIso)return err(402,`That licence expired on ${payload.expires}. Your records are untouched; renew to read documents again.`);
 if(payload.plan!=='pro'&&payload.plan!=='accountant')return err(402,'This plan does not include reading documents.');
 return ok({name:typeof payload.name==='string'?payload.name.slice(0,80):'',plan:payload.plan});
}

/** What the model is asked for. Deliberately narrow: transcribe, do not interpret. */
export const PROMPT=`You are transcribing a bank statement so a person can check it. Return JSON only.

Return: {"rows":[{"date":"YYYY-MM-DD","description":"...","amount":"-1234.56","balance":"12345.67"}]}

Rules:
- Copy figures exactly as printed. Never compute, correct, round or infer a missing value.
- amount is negative for money leaving the account and positive for money arriving.
- balance is the running balance printed on that row. Use "" if the row has none.
- Include every transaction row. Exclude headers, totals, carried-forward lines and marketing text.
- If a figure is unclear, use "" for it rather than guessing. A blank is useful; a guess is harmful.
- Do not add rows that are not printed on the statement.`;

/* Strict parsing of whatever came back. The model is a stranger. */
export function readModelRows(raw:string):ExtractedRow[]{
 let text=raw.trim();
 const fence=text.match(/```(?:json)?\s*([\s\S]*?)```/);
 if(fence)text=fence[1].trim();
 let parsed:unknown;
 try{parsed=JSON.parse(text);}catch{return [];}
 const rows=(parsed as {rows?:unknown})?.rows;
 if(!Array.isArray(rows))return [];
 const out:ExtractedRow[]=[];
 for(const row of rows.slice(0,MAX_ROWS)){
  if(!row||typeof row!=='object')continue;
  const r=row as Record<string,unknown>;
  const date=typeof r.date==='string'?r.date.trim():'';
  const amount=typeof r.amount==='string'?r.amount.trim():typeof r.amount==='number'?String(r.amount):'';
  const balance=typeof r.balance==='string'?r.balance.trim():typeof r.balance==='number'?String(r.balance):'';
  const description=typeof r.description==='string'?r.description.trim().slice(0,300):'';
  // A row without a readable date and amount is no use; drop it rather than repair it.
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;
  if(!/^-?\d+(\.\d{1,2})?$/.test(amount.replace(/,/g,'')))continue;
  if(balance!==''&&!/^-?\d+(\.\d{1,2})?$/.test(balance.replace(/,/g,'')))continue;
  out.push({date,description,amount:amount.replace(/,/g,''),balance:balance.replace(/,/g,'')});
 }
 return out;
}

export type Provider={name:string;url:string;headers:Record<string,string>;body:unknown;pick:(json:any)=>string};
export function providerFor(provider:string,model:string,key:string,mime:string,data:string):Provider|null{
 if(provider==='gemini')return {
  name:'gemini',
  url:`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
  headers:{'content-type':'application/json','x-goog-api-key':key},
  body:{contents:[{parts:[{text:PROMPT},{inline_data:{mime_type:mime,data}}]}],
   generationConfig:{temperature:0,response_mime_type:'application/json'}},
  pick:(json)=>json?.candidates?.[0]?.content?.parts?.map((p:any)=>p?.text??'').join('')??''
 };
 if(provider==='anthropic')return {
  name:'anthropic',
  url:'https://api.anthropic.com/v1/messages',
  headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},
  body:{model,max_tokens:8000,temperature:0,messages:[{role:'user',content:[
   mime==='application/pdf'
    ?{type:'document',source:{type:'base64',media_type:mime,data}}
    :{type:'image',source:{type:'base64',media_type:mime,data}},
   {type:'text',text:PROMPT}]}]},
  pick:(json)=>(json?.content??[]).map((c:any)=>c?.text??'').join('')
 };
 return null;
}
