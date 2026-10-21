/* Storage interface. The handlers only ever see this, so the same code runs
   against Cloudflare D1 in production and an in-memory double in the tests. */
export type Subscriber={email:string;status:'pending'|'confirmed'|'unsubscribed';token:string;source:string;createdAt:string;confirmedAt:string|null};
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
};

export function memoryStore():Store{
 const subs=new Map<string,Subscriber>();
 const usage=new Map<string,number>();
 const rates=new Map<string,{day:string;count:number}>();
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
   for(const [key,value] of rates)if(value.day<day)rates.delete(key);}
 };
}

/* Cloudflare D1. The SQL lives here and nowhere else. */
type D1=any;
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
  async purgeRatesBefore(day){await db.prepare('delete from rate_limit where day < ?').bind(day).run();}
 };
}
