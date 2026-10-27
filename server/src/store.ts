/* Storage interface. The handlers only ever see this, so the same code runs
   against Cloudflare D1 in production and an in-memory double in the tests.

   Nothing in here can hold a customer's own financial data. The one money
   column is `licences.amount_minor`, which is what somebody paid *us*; see the
   note at the top of schema.sql. */

export type Subscriber={email:string;status:'pending'|'confirmed'|'unsubscribed';token:string;source:string;createdAt:string;confirmedAt:string|null};

export type Licence={
 keyId:string;licenceKey:string;email:string;name:string;plan:'pro'|'accountant';
 amountMinor:number;currency:'PKR'|'USD';paymentRef:string;
 issuedAt:string;expiresAt:string;status:'active'|'refunded'|'replaced';note:string};

export type AuthToken={token:string;email:string;createdAt:string;expiresAt:string;usedAt:string|null};
export type Session={token:string;email:string;method:'link'|'google';createdAt:string;expiresAt:string};

export type Reviewer={
 id:string;name:string;firm:string;registration:string;
 publicKey:string;contactEmail:string;status:'pending'|'active'|'suspended';createdAt:string};

export type ReviewJob={
 id:string;reviewerId:string;customerEmail:string;fingerprint:string;taxYear:string;
 status:'requested'|'accepted'|'signed'|'declined'|'withdrawn';
 signature:string;createdAt:string;updatedAt:string};

export type Store={
 /** Returns false when the address is already on the list, so we never send a
     second confirmation to someone who did not ask again. */
 addSubscriber(s:Subscriber):Promise<boolean>;
 findByToken(token:string):Promise<Subscriber|null>;
 setStatus(token:string,status:Subscriber['status'],at:string|null):Promise<boolean>;
 countSubscribers():Promise<{pending:number;confirmed:number;unsubscribed:number}>;
 listConfirmed(limit:number):Promise<Subscriber[]>;
 /** Every row, confirmed or not — used by the admin view and the tests. */
 allSubscribers(limit:number):Promise<Subscriber[]>;
 /** One row per day per plan per build. Nothing identifies a device. */
 bumpUsage(day:string,plan:string,appVersion:string):Promise<void>;
 usageByDay(days:number,todayUtc:string):Promise<{day:string;opens:number}[]>;
 usageTotals():Promise<{plan:string;opens:number}[]>;
 /** Returns the count after incrementing, for rate limiting. */
 bumpRate(key:string,day:string):Promise<number>;
 purgeRatesBefore(day:string):Promise<void>;

 /* ---- the sales ledger ---- */
 addLicence(l:Licence):Promise<boolean>;
 findLicence(keyId:string):Promise<Licence|null>;
 licencesByEmail(email:string):Promise<Licence[]>;
 setLicenceStatus(keyId:string,status:Licence['status'],note:string):Promise<boolean>;

 /* ---- portal sign-in ---- */
 addAuthToken(t:AuthToken):Promise<void>;
 findAuthToken(token:string):Promise<AuthToken|null>;
 /** Newest first. For the tests, and for answering "did that link go out?"
     without a mail provider in the loop. Tokens are opaque and short-lived. */
 allAuthTokens(limit:number):Promise<AuthToken[]>;
 markAuthTokenUsed(token:string,at:string):Promise<boolean>;
 addSession(s:Session):Promise<void>;
 findSession(token:string):Promise<Session|null>;
 deleteSession(token:string):Promise<boolean>;
 purgeExpired(nowIso:string):Promise<void>;

 /* ---- per-licence document quota ---- */
 bumpExtractQuota(keyId:string,year:string):Promise<number>;
 extractQuotaUsed(keyId:string,year:string):Promise<number>;

 /* ---- the review broker. Holds a fingerprint, never a pack. ---- */
 addReviewer(r:Reviewer):Promise<boolean>;
 findReviewer(id:string):Promise<Reviewer|null>;
 listReviewers(status:Reviewer['status']):Promise<Reviewer[]>;
 setReviewerStatus(id:string,status:Reviewer['status']):Promise<boolean>;
 addReviewJob(j:ReviewJob):Promise<void>;
 findReviewJob(id:string):Promise<ReviewJob|null>;
 jobsForCustomer(email:string,limit:number):Promise<ReviewJob[]>;
 jobsForReviewer(reviewerId:string,limit:number):Promise<ReviewJob[]>;
 updateReviewJob(id:string,patch:{status?:ReviewJob['status'];signature?:string},at:string):Promise<boolean>;

 /* ---- filing reminders ---- */
 /** False when this person has already had this reminder, so a cron that
     fires twice cannot send it twice. */
 recordReminder(email:string,taxYear:string,milestone:string,at:string):Promise<boolean>;
 countReminders(taxYear:string,milestone:string):Promise<number>;

 /* ---- erasure ---- */
 eraseEmail(email:string,emailHash:string,scope:'subscriber'|'licence'|'all',at:string):Promise<{subscribers:number;licences:number}>;
 findErasure(emailHash:string):Promise<{erasedAt:string;scope:string}|null>;
};

export function memoryStore():Store{
 const subs=new Map<string,Subscriber>();
 const usage=new Map<string,number>();
 const rates=new Map<string,{day:string;count:number}>();
 const licences=new Map<string,Licence>();
 const authTokens=new Map<string,AuthToken>();
 const reminders=new Set<string>();
 const sessions=new Map<string,Session>();
 const quota=new Map<string,number>();
 const reviewers=new Map<string,Reviewer>();
 const jobs=new Map<string,ReviewJob>();
 const erasures=new Map<string,{erasedAt:string;scope:string}>();
 return {
  async addSubscriber(s){if(subs.has(s.email))return false;subs.set(s.email,{...s});return true;},
  async findByToken(token){return [...subs.values()].find(s=>s.token===token)??null;},
  async setStatus(token,status,at){
   const found=[...subs.values()].find(s=>s.token===token);
   if(!found)return false;
   subs.set(found.email,{...found,status,confirmedAt:status==='confirmed'?at:found.confirmedAt});
   return true;},
  async countSubscribers(){
   const counts={pending:0,confirmed:0,unsubscribed:0};
   for(const s of subs.values())counts[s.status]++;
   return counts;},
  async listConfirmed(limit){return [...subs.values()].filter(s=>s.status==='confirmed').slice(0,limit);},
  async allSubscribers(limit){return [...subs.values()].slice(0,limit);},
  async bumpUsage(day,plan,appVersion){
   const key=`${day}|${plan}|${appVersion}`;
   usage.set(key,(usage.get(key)??0)+1);},
  async usageByDay(days,todayUtc){
   const out=new Map<string,number>();
   for(const [key,count] of usage){
    const day=key.split('|')[0];
    const age=(Date.parse(todayUtc+'T00:00:00Z')-Date.parse(day+'T00:00:00Z'))/86400000;
    if(age>=0&&age<days)out.set(day,(out.get(day)??0)+count);
   }
   return [...out].map(([day,opens])=>({day,opens})).sort((a,b)=>a.day<b.day?-1:1);},
  async usageTotals(){
   const out=new Map<string,number>();
   for(const [key,count] of usage){const plan=key.split('|')[1];out.set(plan,(out.get(plan)??0)+count);}
   return [...out].map(([plan,opens])=>({plan,opens})).sort((a,b)=>b.opens-a.opens);},
  async bumpRate(key,day){
   const found=rates.get(key);
   if(!found||found.day!==day){rates.set(key,{day,count:1});return 1;}
   found.count++;return found.count;},
  async purgeRatesBefore(day){
   for(const [key,value] of rates)if(value.day<day)rates.delete(key);},

  async addLicence(l){if(licences.has(l.keyId))return false;licences.set(l.keyId,{...l});return true;},
  async findLicence(keyId){const found=licences.get(keyId);return found?{...found}:null;},
  async licencesByEmail(email){
   return [...licences.values()].filter(l=>l.email===email)
    .sort((a,b)=>a.issuedAt<b.issuedAt?1:-1).map(l=>({...l}));},
  async setLicenceStatus(keyId,status,note){
   const found=licences.get(keyId);
   if(!found)return false;
   licences.set(keyId,{...found,status,note:note||found.note});
   return true;},

  async addAuthToken(t){authTokens.set(t.token,{...t});},
  async findAuthToken(token){const found=authTokens.get(token);return found?{...found}:null;},
  async allAuthTokens(limit){
   return [...authTokens.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
    .slice(0,limit).map(t=>({...t}));},
  async markAuthTokenUsed(token,at){
   const found=authTokens.get(token);
   if(!found||found.usedAt)return false;
   authTokens.set(token,{...found,usedAt:at});
   return true;},
  async addSession(s){sessions.set(s.token,{...s});},
  async findSession(token){const found=sessions.get(token);return found?{...found}:null;},
  async deleteSession(token){return sessions.delete(token);},
  async purgeExpired(nowIso){
   for(const [k,v] of authTokens)if(v.expiresAt<nowIso)authTokens.delete(k);
   for(const [k,v] of sessions)if(v.expiresAt<nowIso)sessions.delete(k);},

  async bumpExtractQuota(keyId,year){
   const key=`${keyId}|${year}`;
   const next=(quota.get(key)??0)+1;
   quota.set(key,next);
   return next;},
  async extractQuotaUsed(keyId,year){return quota.get(`${keyId}|${year}`)??0;},

  async addReviewer(r){if(reviewers.has(r.id))return false;reviewers.set(r.id,{...r});return true;},
  async findReviewer(id){const found=reviewers.get(id);return found?{...found}:null;},
  async listReviewers(status){
   return [...reviewers.values()].filter(r=>r.status===status).map(r=>({...r}));},
  async setReviewerStatus(id,status){
   const found=reviewers.get(id);
   if(!found)return false;
   reviewers.set(id,{...found,status});
   return true;},
  async addReviewJob(j){jobs.set(j.id,{...j});},
  async findReviewJob(id){const found=jobs.get(id);return found?{...found}:null;},
  async jobsForCustomer(email,limit){
   return [...jobs.values()].filter(j=>j.customerEmail===email)
    .sort((a,b)=>a.createdAt<b.createdAt?1:-1).slice(0,limit).map(j=>({...j}));},
  async jobsForReviewer(reviewerId,limit){
   return [...jobs.values()].filter(j=>j.reviewerId===reviewerId)
    .sort((a,b)=>a.createdAt<b.createdAt?1:-1).slice(0,limit).map(j=>({...j}));},
  async updateReviewJob(id,patch,at){
   const found=jobs.get(id);
   if(!found)return false;
   jobs.set(id,{...found,
    status:patch.status??found.status,
    signature:patch.signature??found.signature,
    updatedAt:at});
   return true;},

  async recordReminder(email,taxYear,milestone){
   const key=`${email}|${taxYear}|${milestone}`;
   if(reminders.has(key))return false;
   reminders.add(key);return true;},
  async countReminders(taxYear,milestone){
   return [...reminders].filter(k=>k.endsWith(`|${taxYear}|${milestone}`)).length;},

  async eraseEmail(email,emailHash,scope,at){
   let removedSubs=0,removedLicences=0;
   if(scope==='subscriber'||scope==='all'){
    if(subs.delete(email))removedSubs=1;}
   if(scope==='licence'||scope==='all'){
    for(const [k,v] of licences)if(v.email===email){licences.delete(k);removedLicences++;}}
   if(scope==='all'){
    for(const [k,v] of sessions)if(v.email===email)sessions.delete(k);
    for(const [k,v] of authTokens)if(v.email===email)authTokens.delete(k);
    for(const [k,v] of jobs)if(v.customerEmail===email)jobs.delete(k);
    for(const k of [...reminders])if(k.startsWith(`${email}|`))reminders.delete(k);}
   erasures.set(emailHash,{erasedAt:at,scope});
   return {subscribers:removedSubs,licences:removedLicences};},
  async findErasure(emailHash){const found=erasures.get(emailHash);return found?{...found}:null;}
 };
}

/* Cloudflare D1. The SQL lives here and nowhere else. */
type D1=any;
const licenceRow=(r:any):Licence=>({keyId:r.key_id,licenceKey:r.licence_key??'',
 email:r.email,name:r.name,plan:r.plan,
 amountMinor:Number(r.amount_minor),currency:r.currency,paymentRef:r.payment_ref,
 issuedAt:r.issued_at,expiresAt:r.expires_at,status:r.status,note:r.note});
const reviewerRow=(r:any):Reviewer=>({id:r.id,name:r.name,firm:r.firm,registration:r.registration,
 publicKey:r.public_key,contactEmail:r.contact_email,status:r.status,createdAt:r.created_at});
const jobRow=(r:any):ReviewJob=>({id:r.id,reviewerId:r.reviewer_id,customerEmail:r.customer_email,
 fingerprint:r.fingerprint,taxYear:r.tax_year,status:r.status,signature:r.signature,
 createdAt:r.created_at,updatedAt:r.updated_at});

export function d1Store(db:D1):Store{
 return {
  async addSubscriber(s){
   const existing=await db.prepare('select email from subscribers where email = ?').bind(s.email).first();
   if(existing)return false;
   await db.prepare('insert into subscribers (email,status,token,source,created_at,confirmed_at) values (?,?,?,?,?,null)')
    .bind(s.email,s.status,s.token,s.source,s.createdAt).run();
   return true;},
  async findByToken(token){
   const row=await db.prepare('select email,status,token,source,created_at,confirmed_at from subscribers where token = ?').bind(token).first();
   return row?{email:row.email,status:row.status,token:row.token,source:row.source,createdAt:row.created_at,confirmedAt:row.confirmed_at}:null;},
  async setStatus(token,status,at){
   const result=await db.prepare('update subscribers set status = ?, confirmed_at = coalesce(?,confirmed_at) where token = ?')
    .bind(status,status==='confirmed'?at:null,token).run();
   return (result.meta?.changes??0)>0;},
  async countSubscribers(){
   const rows=await db.prepare('select status, count(*) as n from subscribers group by status').all();
   const counts={pending:0,confirmed:0,unsubscribed:0};
   for(const r of rows.results??[])counts[r.status as keyof typeof counts]=Number(r.n);
   return counts;},
  async listConfirmed(limit){
   const rows=await db.prepare('select email,status,token,source,created_at,confirmed_at from subscribers where status = ? order by confirmed_at desc limit ?')
    .bind('confirmed',limit).all();
   return (rows.results??[]).map((r:any)=>({email:r.email,status:r.status,token:r.token,source:r.source,createdAt:r.created_at,confirmedAt:r.confirmed_at}));},
  async allSubscribers(limit){
   const rows=await db.prepare('select email,status,token,source,created_at,confirmed_at from subscribers order by created_at desc limit ?').bind(limit).all();
   return (rows.results??[]).map((r:any)=>({email:r.email,status:r.status,token:r.token,source:r.source,createdAt:r.created_at,confirmedAt:r.confirmed_at}));},
  async bumpUsage(day,plan,appVersion){
   await db.prepare(`insert into usage (day,plan,app_version,opens) values (?,?,?,1)
    on conflict(day,plan,app_version) do update set opens = opens + 1`).bind(day,plan,appVersion).run();},
  async usageByDay(days,todayUtc){
   const rows=await db.prepare(`select day, sum(opens) as opens from usage
    where julianday(?) - julianday(day) between 0 and ? group by day order by day`).bind(todayUtc,days-1).all();
   return (rows.results??[]).map((r:any)=>({day:r.day,opens:Number(r.opens)}));},
  async usageTotals(){
   const rows=await db.prepare('select plan, sum(opens) as opens from usage group by plan order by opens desc').all();
   return (rows.results??[]).map((r:any)=>({plan:r.plan,opens:Number(r.opens)}));},
  async bumpRate(key,day){
   await db.prepare(`insert into rate_limit (key,day,count) values (?,?,1)
    on conflict(key) do update set count = case when rate_limit.day = excluded.day then rate_limit.count + 1 else 1 end,
    day = excluded.day`).bind(key,day).run();
   const row=await db.prepare('select count from rate_limit where key = ?').bind(key).first();
   return Number(row?.count??1);},
  async purgeRatesBefore(day){await db.prepare('delete from rate_limit where day < ?').bind(day).run();},

  async addLicence(l){
   const existing=await db.prepare('select key_id from licences where key_id = ?').bind(l.keyId).first();
   if(existing)return false;
   await db.prepare(`insert into licences
    (key_id,licence_key,email,name,plan,amount_minor,currency,payment_ref,issued_at,expires_at,status,note)
    values (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(l.keyId,l.licenceKey,l.email,l.name,l.plan,l.amountMinor,l.currency,l.paymentRef,
     l.issuedAt,l.expiresAt,l.status,l.note).run();
   return true;},
  async findLicence(keyId){
   const row=await db.prepare('select * from licences where key_id = ?').bind(keyId).first();
   return row?licenceRow(row):null;},
  async licencesByEmail(email){
   const rows=await db.prepare('select * from licences where email = ? order by issued_at desc').bind(email).all();
   return (rows.results??[]).map(licenceRow);},
  async setLicenceStatus(keyId,status,note){
   const result=await db.prepare('update licences set status = ?, note = case when ? = \'\' then note else ? end where key_id = ?')
    .bind(status,note,note,keyId).run();
   return (result.meta?.changes??0)>0;},

  async addAuthToken(t){
   await db.prepare('insert into auth_tokens (token,email,created_at,expires_at,used_at) values (?,?,?,?,null)')
    .bind(t.token,t.email,t.createdAt,t.expiresAt).run();},
  async findAuthToken(token){
   const row=await db.prepare('select token,email,created_at,expires_at,used_at from auth_tokens where token = ?').bind(token).first();
   return row?{token:row.token,email:row.email,createdAt:row.created_at,expiresAt:row.expires_at,usedAt:row.used_at}:null;},
  async allAuthTokens(limit){
   const rows=await db.prepare('select token,email,created_at,expires_at,used_at from auth_tokens order by created_at desc limit ?')
    .bind(limit).all();
   return (rows.results??[]).map((r:any)=>({token:r.token,email:r.email,
    createdAt:r.created_at,expiresAt:r.expires_at,usedAt:r.used_at}));},
  async markAuthTokenUsed(token,at){
   // `used_at is null` in the WHERE is what makes a link single-use even if two
   // requests arrive at once: the second update changes no rows.
   const result=await db.prepare('update auth_tokens set used_at = ? where token = ? and used_at is null')
    .bind(at,token).run();
   return (result.meta?.changes??0)>0;},
  async addSession(s){
   await db.prepare('insert into sessions (token,email,method,created_at,expires_at) values (?,?,?,?,?)')
    .bind(s.token,s.email,s.method,s.createdAt,s.expiresAt).run();},
  async findSession(token){
   const row=await db.prepare('select token,email,method,created_at,expires_at from sessions where token = ?').bind(token).first();
   return row?{token:row.token,email:row.email,method:row.method,createdAt:row.created_at,expiresAt:row.expires_at}:null;},
  async deleteSession(token){
   const result=await db.prepare('delete from sessions where token = ?').bind(token).run();
   return (result.meta?.changes??0)>0;},
  async purgeExpired(nowIso){
   await db.prepare('delete from auth_tokens where expires_at < ?').bind(nowIso).run();
   await db.prepare('delete from sessions where expires_at < ?').bind(nowIso).run();},

  async bumpExtractQuota(keyId,year){
   await db.prepare(`insert into extract_quota (key_id,year,used) values (?,?,1)
    on conflict(key_id,year) do update set used = used + 1`).bind(keyId,year).run();
   const row=await db.prepare('select used from extract_quota where key_id = ? and year = ?').bind(keyId,year).first();
   return Number(row?.used??1);},
  async extractQuotaUsed(keyId,year){
   const row=await db.prepare('select used from extract_quota where key_id = ? and year = ?').bind(keyId,year).first();
   return Number(row?.used??0);},

  async addReviewer(r){
   const existing=await db.prepare('select id from reviewers where id = ?').bind(r.id).first();
   if(existing)return false;
   await db.prepare(`insert into reviewers (id,name,firm,registration,public_key,contact_email,status,created_at)
    values (?,?,?,?,?,?,?,?)`).bind(r.id,r.name,r.firm,r.registration,r.publicKey,r.contactEmail,r.status,r.createdAt).run();
   return true;},
  async findReviewer(id){
   const row=await db.prepare('select * from reviewers where id = ?').bind(id).first();
   return row?reviewerRow(row):null;},
  async listReviewers(status){
   const rows=await db.prepare('select * from reviewers where status = ? order by name').bind(status).all();
   return (rows.results??[]).map(reviewerRow);},
  async setReviewerStatus(id,status){
   const result=await db.prepare('update reviewers set status = ? where id = ?').bind(status,id).run();
   return (result.meta?.changes??0)>0;},
  async addReviewJob(j){
   await db.prepare(`insert into review_jobs
    (id,reviewer_id,customer_email,fingerprint,tax_year,status,signature,created_at,updated_at)
    values (?,?,?,?,?,?,?,?,?)`)
    .bind(j.id,j.reviewerId,j.customerEmail,j.fingerprint,j.taxYear,j.status,j.signature,j.createdAt,j.updatedAt).run();},
  async findReviewJob(id){
   const row=await db.prepare('select * from review_jobs where id = ?').bind(id).first();
   return row?jobRow(row):null;},
  async jobsForCustomer(email,limit){
   const rows=await db.prepare('select * from review_jobs where customer_email = ? order by created_at desc limit ?')
    .bind(email,limit).all();
   return (rows.results??[]).map(jobRow);},
  async jobsForReviewer(reviewerId,limit){
   const rows=await db.prepare('select * from review_jobs where reviewer_id = ? order by created_at desc limit ?')
    .bind(reviewerId,limit).all();
   return (rows.results??[]).map(jobRow);},
  async updateReviewJob(id,patch,at){
   const result=await db.prepare(`update review_jobs set
    status = coalesce(?,status), signature = coalesce(?,signature), updated_at = ? where id = ?`)
    .bind(patch.status??null,patch.signature??null,at,id).run();
   return (result.meta?.changes??0)>0;},

  async recordReminder(email,taxYear,milestone,at){
   // The primary key does the work: a duplicate insert changes no rows, so the
   // caller learns it has already been sent without a read-then-write race.
   const r=await db.prepare(`insert into reminder_log (email,tax_year,milestone,sent_at)
    values (?,?,?,?) on conflict(email,tax_year,milestone) do nothing`)
    .bind(email,taxYear,milestone,at).run();
   return (r.meta?.changes??0)>0;},
  async countReminders(taxYear,milestone){
   const row=await db.prepare('select count(*) as n from reminder_log where tax_year = ? and milestone = ?')
    .bind(taxYear,milestone).first();
   return Number(row?.n??0);},

  async eraseEmail(email,emailHash,scope,at){
   let subscribers=0,licencesRemoved=0;
   if(scope==='subscriber'||scope==='all'){
    const r=await db.prepare('delete from subscribers where email = ?').bind(email).run();
    subscribers=r.meta?.changes??0;}
   if(scope==='licence'||scope==='all'){
    const r=await db.prepare('delete from licences where email = ?').bind(email).run();
    licencesRemoved=r.meta?.changes??0;}
   if(scope==='all'){
    await db.prepare('delete from sessions where email = ?').bind(email).run();
    await db.prepare('delete from auth_tokens where email = ?').bind(email).run();
    await db.prepare('delete from review_jobs where customer_email = ?').bind(email).run();
    await db.prepare('delete from reminder_log where email = ?').bind(email).run();}
   await db.prepare(`insert into erasures (email_hash,erased_at,scope) values (?,?,?)
    on conflict(email_hash) do update set erased_at = excluded.erased_at, scope = excluded.scope`)
    .bind(emailHash,at,scope).run();
   return {subscribers,licences:licencesRemoved};},
  async findErasure(emailHash){
   const row=await db.prepare('select erased_at,scope from erasures where email_hash = ?').bind(emailHash).first();
   return row?{erasedAt:row.erased_at,scope:row.scope}:null;}
 };
}
