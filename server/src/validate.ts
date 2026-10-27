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

/* ---------------------------------------------------------------------------
   Readers for the portal and the review broker.

   Every one of these goes through onlyKeys, which is what keeps the central
   guarantee true as the service grows: a body carrying `income`, `client`,
   `taxDue` or `lines` is refused by shape, at every route, without any route
   having to remember to check. The test suite fires those payloads at all of
   them. If someone adds an endpoint and forgets onlyKeys, that test fails. */

export const TAX_YEARS=['2026','2027'] as const;
export const LICENCE_PLANS=['pro','accountant'] as const;
export const CURRENCIES=['PKR','USD'] as const;

/** A short opaque identifier we generated: uuid, or our 48-hex tokens. */
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^[0-9a-f]{48}$/;
export const isId=(v:unknown):v is string=>typeof v==='string'&&ID.test(v);

/** Sign in to the portal: either ask for an emailed link, or present a Google
    ID token. Never both, so there is one code path per method. */
export type SignInBody={method:'link';email:string}|{method:'google';idToken:string};
export function readSignIn(body:unknown):Result<SignInBody>{
 const checked=onlyKeys(body,['email','idToken']);
 if(!checked.ok)return checked;
 const {email,idToken}=checked.value;
 if(email!==undefined&&idToken!==undefined)
  return err(400,'Send either an email address or a Google sign-in, not both.');
 if(typeof idToken==='string'){
  if(idToken.length<40||idToken.length>4096)return err(400,'That Google sign-in could not be read.');
  return ok({method:'google',idToken});
 }
 const cleaned=cleanEmail(email);
 if(!cleaned.ok)return cleaned;
 return ok({method:'link',email:cleaned.value});
}

/** Exchange a single-use emailed token for a session. */
export function readSignInExchange(body:unknown):Result<{token:string}>{
 const checked=onlyKeys(body,['token']);
 if(!checked.ok)return checked;
 const {token}=checked.value;
 if(typeof token!=='string'||!/^[0-9a-f]{48}$/.test(token))
  return err(400,'That sign-in link is not valid. Ask for a new one.');
 return ok({token});
}

/** Ask a named practitioner to review a pack. The fingerprint is a hash of the
    pack; the pack itself goes to the practitioner directly and never here. */
export type ReviewRequestBody={reviewerId:string;fingerprint:string;taxYear:string};
export function readReviewRequest(body:unknown):Result<ReviewRequestBody>{
 const checked=onlyKeys(body,['reviewerId','fingerprint','taxYear']);
 if(!checked.ok)return checked;
 const {reviewerId,fingerprint,taxYear}=checked.value;
 if(!isId(reviewerId))return err(400,'Choose a reviewer from the published list.');
 if(typeof fingerprint!=='string'||!/^[0-9a-f]{64}$/.test(fingerprint))
  return err(400,'A pack fingerprint must be a SHA-256 hash. Hisaab never sends the pack itself to a server.');
 if(typeof taxYear!=='string'||!(TAX_YEARS as readonly string[]).includes(taxYear))
  return err(400,'taxYear must be one of: '+TAX_YEARS.join(', '));
 return ok({reviewerId,fingerprint,taxYear});
}

/** A practitioner accepting, declining, or returning a signed review. */
export type ReviewUpdateBody={jobId:string;status:'accepted'|'signed'|'declined';signature:string};
export function readReviewUpdate(body:unknown):Result<ReviewUpdateBody>{
 const checked=onlyKeys(body,['jobId','status','signature']);
 if(!checked.ok)return checked;
 const {jobId,status,signature}=checked.value;
 if(!isId(jobId))return err(400,'That is not a review job we know.');
 if(status!=='accepted'&&status!=='signed'&&status!=='declined')
  return err(400,'status must be accepted, signed or declined.');
 if(status==='signed'){
  if(typeof signature!=='string'||!/^[A-Za-z0-9+/_=.-]{40,2048}$/.test(signature))
   return err(400,'A signed review must carry the signature produced by your reviewer key.');
  return ok({jobId,status,signature});
 }
 if(signature!==undefined&&signature!=='')return err(400,'Only a signed review carries a signature.');
 return ok({jobId,status,signature:''});
}

/** A real delete, not a flag. server/README.md named this as the missing path. */
export type ErasureBody={scope:'subscriber'|'licence'|'all';confirm:true};
export function readErasure(body:unknown):Result<ErasureBody>{
 const checked=onlyKeys(body,['scope','confirm']);
 if(!checked.ok)return checked;
 const {scope,confirm}=checked.value;
 if(scope!=='subscriber'&&scope!=='licence'&&scope!=='all')
  return err(400,'scope must be subscriber, licence or all.');
 if(confirm!==true)
  return err(400,'Erasure is permanent and cannot be undone, so it needs confirm: true.');
 return ok({scope,confirm:true});
}

/* ---- admin-only bodies. Still allow-listed; an admin token is not a reason
        to accept a field this service has no business holding. ---- */

export type IssueBody={keyId:string;licenceKey:string;email:string;name:string;
 plan:'pro'|'accountant';amountMinor:number;currency:'PKR'|'USD';paymentRef:string;years:number};
export function readIssue(body:unknown):Result<IssueBody>{
 const checked=onlyKeys(body,['keyId','licenceKey','email','name','plan','amountMinor','currency','paymentRef','years']);
 if(!checked.ok)return checked;
 const {keyId,licenceKey,email,name,plan,amountMinor,currency,paymentRef,years}=checked.value;
 const cleaned=cleanEmail(email);
 if(!cleaned.ok)return cleaned;
 // The key is minted offline by tools/make-license.mjs; this only records it.
 if(!isId(keyId))return err(400,'keyId must be the uuid printed with the key.');
 if(typeof licenceKey!=='string'||!licenceKey.startsWith('HSB1.')||licenceKey.length>2048)
  return err(400,'licenceKey must be the signed key beginning HSB1.');
 if(typeof name!=='string'||!name.trim()||name.length>80)
  return err(400,'A licence needs the name to print on it, up to 80 characters.');
 if(typeof plan!=='string'||!(LICENCE_PLANS as readonly string[]).includes(plan))
  return err(400,'plan must be one of: '+LICENCE_PLANS.join(', '));
 // Money as an integer in the smallest unit. A float never touches a sale.
 if(typeof amountMinor!=='number'||!Number.isSafeInteger(amountMinor)||amountMinor<0||amountMinor>1e11)
  return err(400,'amountMinor must be a whole number of paisa or cents.');
 if(typeof currency!=='string'||!(CURRENCIES as readonly string[]).includes(currency))
  return err(400,'currency must be one of: '+CURRENCIES.join(', '));
 if(paymentRef!==undefined&&(typeof paymentRef!=='string'||paymentRef.length>80))
  return err(400,'paymentRef must be a short reference, up to 80 characters.');
 if(typeof years!=='number'||!Number.isInteger(years)||years<1||years>3)
  return err(400,'years must be 1, 2 or 3.');
 return ok({keyId,licenceKey,email:cleaned.value,name:name.trim(),plan:plan as IssueBody['plan'],
  amountMinor,currency:currency as IssueBody['currency'],
  paymentRef:typeof paymentRef==='string'?paymentRef:'',years});
}

export type ReviewerBody={name:string;firm:string;registration:string;publicKey:string;contactEmail:string};
export function readReviewer(body:unknown):Result<ReviewerBody>{
 const checked=onlyKeys(body,['name','firm','registration','publicKey','contactEmail']);
 if(!checked.ok)return checked;
 const {name,firm,registration,publicKey,contactEmail}=checked.value;
 if(typeof name!=='string'||!name.trim()||name.length>80)return err(400,'A reviewer needs a name.');
 const email=cleanEmail(contactEmail);
 if(!email.ok)return email;
 // Stored as text and handed to the app, which verifies signatures against it.
 // Parsed here only to refuse something that could never be a key.
 if(typeof publicKey!=='string'||publicKey.length<40||publicKey.length>2048)
  return err(400,'publicKey must be the reviewer public JWK.');
 try{
  const jwk=JSON.parse(publicKey) as {kty?:string;crv?:string};
  if(jwk?.kty!=='EC'||jwk?.crv!=='P-256')
   return err(400,'A reviewer key must be an EC P-256 JWK, matching the app verifier.');
 }catch{return err(400,'publicKey must be valid JSON.');}
 for(const [label,value] of [['firm',firm],['registration',registration]] as const)
  if(value!==undefined&&(typeof value!=='string'||value.length>80))
   return err(400,`${label} must be a short string, up to 80 characters.`);
 return ok({name:name.trim(),firm:typeof firm==='string'?firm:'',
  registration:typeof registration==='string'?registration:'',
  publicKey,contactEmail:email.value});
}

/* These three used to read their fields by hand, which meant an unknown field
   was ignored rather than refused — the one shape of hole the allow-list exists
   to prevent. The route-table test fires financial payloads at every POST route
   in the service, and it is these readers that let it assert the same answer
   everywhere instead of making exceptions. */

export type LicenceStatusBody={keyId:string;status:'active'|'refunded'|'replaced';note:string};
export function readLicenceStatus(body:unknown):Result<LicenceStatusBody>{
 const checked=onlyKeys(body,['keyId','status','note']);
 if(!checked.ok)return checked;
 const {keyId,status,note}=checked.value;
 if(typeof keyId!=='string'||!keyId)return err(400,'keyId is required.');
 if(status!=='active'&&status!=='refunded'&&status!=='replaced')
  return err(400,'status must be active, refunded or replaced.');
 if(note!==undefined&&(typeof note!=='string'||note.length>200))
  return err(400,'note must be a short string, up to 200 characters.');
 return ok({keyId,status,note:typeof note==='string'?note:''});
}

export type ReviewerStatusBody={id:string;status:'pending'|'active'|'suspended'};
export function readReviewerStatus(body:unknown):Result<ReviewerStatusBody>{
 const checked=onlyKeys(body,['id','status']);
 if(!checked.ok)return checked;
 const {id,status}=checked.value;
 if(!isId(id))return err(400,'id must be the reviewer uuid.');
 if(status!=='pending'&&status!=='active'&&status!=='suspended')
  return err(400,'status must be pending, active or suspended.');
 return ok({id,status});
}

/** Asking how much of the document allowance is left. A licence key, and
    nothing else — the quota answer needs no figure from anybody's books. */
export function readQuotaRequest(body:unknown):Result<{licence:string}>{
 const checked=onlyKeys(body,['licence']);
 if(!checked.ok)return checked;
 const {licence}=checked.value;
 if(typeof licence!=='string'||!licence)return err(402,'That needs your licence key.');
 return ok({licence});
}

/** Running the reminder cron by hand. Two switches and nothing else: there is
    no field here for a recipient, a figure or a message, so an admin token
    cannot be used to mail somebody something of their own devising. */
export function readReminderRun(body:unknown):Result<{dryRun:boolean;day:string}>{
 const checked=onlyKeys(body,['dryRun','day']);
 if(!checked.ok)return checked;
 const {dryRun,day}=checked.value;
 if(dryRun!==undefined&&typeof dryRun!=='boolean')return err(400,'dryRun must be true or false.');
 if(day!==undefined&&(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day)))
  return err(400,'day must be YYYY-MM-DD.');
 return ok({dryRun:dryRun!==false,day:typeof day==='string'?day:''});
}
