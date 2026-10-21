/* Request validation, written as a deny-list-free allow-list.

   The central guarantee of this service: it is not capable of accepting financial
   data. Every endpoint declares the exact fields it accepts and rejects a body
   carrying anything else — so a future careless change on the client cannot start
   leaking income, client names or statement rows here by accident. The test suite
   asserts this with real-looking payloads. */

export type Ok<T>={ok:true;value:T};
export type Err={ok:false;status:number;error:string};
export type Result<T>=Ok<T>|Err;
export const ok=<T>(value:T):Ok<T>=>({ok:true,value});
export const err=(status:number,error:string):Err=>({ok:false,status,error});

/** Rejects unknown keys outright rather than ignoring them. */
export function onlyKeys(body:unknown,allowed:readonly string[]):Result<Record<string,unknown>>{
 if(body===null||typeof body!=='object'||Array.isArray(body))return err(400,'Expected a JSON object.');
 const value=body as Record<string,unknown>;
 const extra=Object.keys(value).filter(k=>!allowed.includes(k));
 if(extra.length)return err(400,`This endpoint does not accept: ${extra.sort().join(', ')}. Hisaab never sends financial data to a server.`);
 return ok(value);
}

/* Deliberately strict: one @, a dot in the domain, no spaces, length-capped.
   Anything exotic is told to contact support rather than silently stored wrong. */
const EMAIL=/^[^\s@,;:<>"'()[\]\\]{1,64}@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
export function cleanEmail(raw:unknown):Result<string>{
 if(typeof raw!=='string')return err(400,'An email address is required.');
 const email=raw.trim().toLowerCase();
 if(email.length<6||email.length>254)return err(400,'That email address is not a length we can accept.');
 if(!EMAIL.test(email))return err(400,'That does not look like an email address we can send to.');
 return ok(email);
}

export const PLANS=['free','trial','pro','accountant'] as const;
export type UsagePlan=(typeof PLANS)[number];
export type UsageBeacon={day:string;appVersion:string;plan:UsagePlan};

/** A usage ping carries a date, a build number and a plan word. Nothing else can
    be expressed in it — there is no field for a figure, a name or an identifier. */
export function readBeacon(body:unknown,todayUtc:string):Result<UsageBeacon>{
 const checked=onlyKeys(body,['day','appVersion','plan']);
 if(!checked.ok)return checked;
 const {day,appVersion,plan}=checked.value;
 if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day))return err(400,'day must be YYYY-MM-DD.');
 // A clock can be a little out, but a ping cannot backfill history or claim the future.
 const drift=Math.abs(Date.parse(day+'T00:00:00Z')-Date.parse(todayUtc+'T00:00:00Z'))/86400000;
 if(!Number.isFinite(drift)||drift>2)return err(400,'day is too far from today to be a real ping.');
 if(typeof appVersion!=='string'||!/^[0-9A-Za-z.\-]{1,32}$/.test(appVersion))return err(400,'appVersion is not a recognisable build string.');
 if(typeof plan!=='string'||!(PLANS as readonly string[]).includes(plan))return err(400,'plan must be one of: '+PLANS.join(', '));
 return ok({day,appVersion,plan:plan as UsagePlan});
}

export type SubscribeBody={email:string;consent:true;source:string};
export function readSubscribe(body:unknown):Result<SubscribeBody>{
 const checked=onlyKeys(body,['email','consent','source']);
 if(!checked.ok)return checked;
 const email=cleanEmail(checked.value.email);
 if(!email.ok)return email;
 if(checked.value.consent!==true)return err(400,'We only store an address you have actively agreed to give us.');
 const source=checked.value.source;
 if(source!==undefined&&(typeof source!=='string'||source.length>40||!/^[a-z0-9-]*$/.test(source)))
  return err(400,'source must be a short lowercase label.');
 return ok({email:email.value,consent:true,source:typeof source==='string'?source:'app'});
}

export const randomToken=()=>{
 const bytes=crypto.getRandomValues(new Uint8Array(24));
 return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
};

/** IP addresses are never stored. They are hashed with a salt that changes every
    day, used only to stop one machine flooding the counters, and the rows are
    deleted with the day. The hash cannot be reversed to an address. */
export async function rateKey(ip:string,day:string,secret:string){
 const data=new TextEncoder().encode(`${day}:${secret}:${ip}`);
 const digest=await crypto.subtle.digest('SHA-256',data);
 return [...new Uint8Array(digest)].slice(0,8).map(b=>b.toString(16).padStart(2,'0')).join('');
}
