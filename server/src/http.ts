/* Response shaping and who-may-call-us, in one place.

   This was inline in index.ts while there were four endpoints. It is its own
   module now so that adding a route cannot accidentally ship a response without
   the no-store and nosniff headers, or with a permissive origin. */
import type {Result} from './validate';

export const SECURITY_HEADERS={
 'cache-control':'no-store',
 'x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer',
 'x-frame-options':'DENY'
} as const;

export const json=(body:unknown,status=200,origin='*')=>new Response(JSON.stringify(body),{
 status,headers:{'content-type':'application/json; charset=utf-8',
  'access-control-allow-origin':origin,...SECURITY_HEADERS}});

export const html=(body:string,status=200)=>new Response(
 `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Hisaab</title><style>body{font-family:system-ui,sans-serif;background:#f7f6f3;color:#1b1b1f;
  display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;line-height:1.7}
  main{max-width:34rem}h1{font-size:1.4rem}a{color:#4f46e5}
  @media(prefers-color-scheme:dark){body{background:#0e1512;color:#f1f1f2}a{color:#a5b4fc}}</style><main>${body}</main>`,
 {status,headers:{'content-type':'text/html; charset=utf-8',...SECURITY_HEADERS}});

/** Turns a failed validation into its response, so no route writes this twice. */
export const fail=(e:Extract<Result<unknown>,{ok:false}>,origin:string)=>json({error:e.error},e.status,origin);

/** One place that decides who may call us, so a stray origin cannot. */
export function corsOrigin(request:Request,allowedList:string){
 const origin=request.headers.get('origin');
 if(!origin)return allowedList.split(',')[0]?.trim()??'';
 const allowed=allowedList.split(',').map(o=>o.trim()).filter(Boolean);
 return allowed.includes(origin)?origin:'';
}

export const preflight=(origin:string)=>new Response(null,{status:204,headers:{
 'access-control-allow-origin':origin,
 'access-control-allow-methods':'GET,POST,OPTIONS',
 'access-control-allow-headers':'content-type,authorization',
 'access-control-max-age':'86400'}});

/** Bodies are small by design. A large one is refused before it is parsed. */
export async function readJson(request:Request,limit=8000):Promise<unknown>{
 const text=await request.text();
 if(text.length>limit)throw Object.assign(new Error('body too large'),{tooLarge:true});
 if(!text.trim())return {};
 try{return JSON.parse(text);}catch{return null;}
}

/** Extraction carries a base64 document, so it gets its own larger ceiling. */
export const readLargeJson=(request:Request)=>readJson(request,8_000_000);

export const escapeAttr=(s:string)=>s.replace(/[&<>"']/g,c=>
 ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

export function timingSafeEqual(a:string,b:string){
 let diff=a.length^b.length;
 for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);
 return diff===0;
}
