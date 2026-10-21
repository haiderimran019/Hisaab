import test from 'node:test';
import assert from 'node:assert/strict';
import {handle,type Env} from '../src/index.ts';
import {memoryStore} from '../src/store.ts';
import {readBeacon,readSubscribe,cleanEmail,onlyKeys,rateKey} from '../src/validate.ts';

const env:Env={DB:null,ALLOWED_ORIGIN:'https://haiderimran019.github.io',
 RATE_SECRET:'test-secret-value',ADMIN_TOKEN:'admin-token-for-tests'};
const today=()=>new Date().toISOString().slice(0,10);
const call=(store:ReturnType<typeof memoryStore>,path:string,init:RequestInit={})=>
 handle(new Request('https://api.example.test'+path,{
  headers:{origin:env.ALLOWED_ORIGIN,'cf-connecting-ip':'203.0.113.9',...(init.headers??{})},...init}),env,store);
const post=(store:ReturnType<typeof memoryStore>,path:string,body:unknown,headers:Record<string,string>={})=>
 call(store,path,{method:'POST',body:JSON.stringify(body),headers:{'content-type':'application/json',...headers}});

/* ── The central guarantee ───────────────────────────────────────────────── */

test('the service cannot be made to accept financial data', async () => {
 const store=memoryStore();
 const leaks=[
  {day:today(),appVersion:'1.0.0',plan:'pro',income:4203631},
  {day:today(),appVersion:'1.0.0',plan:'pro',client:'Orbit Labs'},
  {day:today(),appVersion:'1.0.0',plan:'pro',receipts:[{gross:'1800'}]},
  {day:today(),appVersion:'1.0.0',plan:'pro',taxDue:10750.98},
  {day:today(),appVersion:'1.0.0',plan:'pro',lines:[{amount:'-6500'}]},
  {day:today(),appVersion:'1.0.0',plan:'pro',installId:'abc-123'},
  {day:today(),appVersion:'1.0.0',plan:'pro',email:'someone@example.com'}
 ];
 for(const body of leaks){
  const response=await post(store,'/v1/usage',body);
  assert.equal(response.status,400,JSON.stringify(body));
  const {error}=await response.json() as {error:string};
  assert.match(error,/does not accept/);
  assert.match(error,/never sends financial data/);
 }
 // and nothing was counted
 const stats=await (await call(store,'/v1/stats')).json() as {opensLast30:number};
 assert.equal(stats.opensLast30,0);
});

test('a subscribe call cannot smuggle extra fields either', async () => {
 const store=memoryStore();
 const response=await post(store,'/v1/subscribe',{email:'a@b.co',consent:true,ntn:'1234567',income:'500000'});
 assert.equal(response.status,400);
 assert.match((await response.json() as {error:string}).error,/income, ntn/);
});

test('unknown keys are refused rather than ignored', () => {
 const result=onlyKeys({a:1,b:2},['a']);
 assert.equal(result.ok,false);
 assert.equal(onlyKeys({a:1},['a','b']).ok,true,'missing optional keys are fine');
 assert.equal(onlyKeys([1,2],['a']).ok,false,'an array is not an object body');
 assert.equal(onlyKeys(null,['a']).ok,false);
});

/* ── Usage counting ──────────────────────────────────────────────────────── */

test('a well-formed ping is counted and reported', async () => {
 const store=memoryStore();
 for(let i=0;i<3;i++){
  const response=await post(store,'/v1/usage',{day:today(),appVersion:'1.2.0',plan:'pro'});
  assert.equal(response.status,202);
 }
 await post(store,'/v1/usage',{day:today(),appVersion:'1.2.0',plan:'free'});
 const stats=await (await call(store,'/v1/stats')).json() as
  {opensLast30:number;byPlan:{plan:string;opens:number}[];note:string};
 assert.equal(stats.opensLast30,4);
 assert.deepEqual(stats.byPlan,[{plan:'pro',opens:3},{plan:'free',opens:1}]);
 assert.match(stats.note,/Opens, not people/,'the stats must not be presented as a headcount');
});

test('a ping is rejected when its date or plan is not sane', () => {
 const day=today();
 assert.equal(readBeacon({day,appVersion:'1.0.0',plan:'pro'},day).ok,true);
 assert.equal(readBeacon({day:'2019-01-01',appVersion:'1.0.0',plan:'pro'},day).ok,false,'cannot backfill history');
 assert.equal(readBeacon({day:'2030-01-01',appVersion:'1.0.0',plan:'pro'},day).ok,false,'cannot claim the future');
 assert.equal(readBeacon({day:'not-a-date',appVersion:'1.0.0',plan:'pro'},day).ok,false);
 assert.equal(readBeacon({day,appVersion:'1.0.0',plan:'enterprise'},day).ok,false);
 assert.equal(readBeacon({day,appVersion:'<script>',plan:'pro'},day).ok,false);
 assert.equal(readBeacon({day,plan:'pro'},day).ok,false,'appVersion is required');
});

test('one machine cannot run the counters up', async () => {
 const store=memoryStore();
 let limited=0;
 for(let i=0;i<25;i++){
  const response=await post(store,'/v1/usage',{day:today(),appVersion:'1.0.0',plan:'free'});
  if(response.status===429)limited++;
 }
 assert.ok(limited>0,'the rate limit must bite');
 const stats=await (await call(store,'/v1/stats')).json() as {opensLast30:number};
 assert.ok(stats.opensLast30<=20);
});

test('the rate-limit key cannot be turned back into an IP address', async () => {
 const day=today();
 const key=await rateKey('203.0.113.9',day,'secret');
 assert.match(key,/^[0-9a-f]{16}$/);
 assert.ok(!key.includes('203'));
 assert.notEqual(key,await rateKey('203.0.113.9',day,'another-secret'),'the salt matters');
 assert.notEqual(key,await rateKey('203.0.113.9','2020-01-01','secret'),'the day matters');
});

/* ── Email list ──────────────────────────────────────────────────────────── */

test('an address is only stored with active consent, and double opt-in', async () => {
 const store=memoryStore();
 assert.equal((await post(store,'/v1/subscribe',{email:'ayesha@example.com',consent:false})).status,400);
 const response=await post(store,'/v1/subscribe',{email:' Ayesha@Example.COM ',consent:true,source:'home'});
 assert.equal(response.status,202);
 let counts=await store.countSubscribers();
 assert.deepEqual(counts,{pending:1,confirmed:0,unsubscribed:0},'pending until confirmed');
 const stored=await store.listConfirmed(10);
 assert.equal(stored.length,0,'an unconfirmed address is not on the list');

 const [subscriber]=await store.allSubscribers(10);
 assert.equal(subscriber.email,'ayesha@example.com','addresses are normalised');

 const confirm=await call(store,`/v1/confirm?token=${subscriber.token}`);
 assert.equal(confirm.status,200);
 assert.match(await confirm.text(),/Confirmed/);
 counts=await store.countSubscribers();
 assert.equal(counts.confirmed,1);

 const out=await call(store,`/v1/unsubscribe?token=${subscriber.token}`);
 assert.equal(out.status,200);
 assert.equal((await store.countSubscribers()).unsubscribed,1);
});

test('a repeated sign-up does not reveal whether an address is already on the list', async () => {
 const store=memoryStore();
 const first=await post(store,'/v1/subscribe',{email:'same@example.com',consent:true});
 const second=await post(store,'/v1/subscribe',{email:'same@example.com',consent:true});
 assert.equal(first.status,second.status);
 assert.deepEqual(await first.json(),await second.json());
 assert.equal((await store.countSubscribers()).pending,1,'but only one row exists');
});

test('email addresses we cannot send to are refused up front', () => {
 for(const bad of ['','a@b','no-at-sign.com','two@@at.com','spaces in@example.com','a@b.c om',
  'x'.repeat(70)+'@example.com','<script>@example.com']){
  assert.equal(cleanEmail(bad).ok,false,bad);
 }
 for(const good of ['a@b.co','ayesha.khan+tax@gmail.com','someone@sub.domain.pk']){
  assert.equal(cleanEmail(good).ok,true,good);
 }
});

test('a confirmation link cannot be guessed or replayed into something else', async () => {
 const store=memoryStore();
 assert.equal((await call(store,'/v1/confirm?token=short')).status,400);
 assert.equal((await call(store,'/v1/confirm?token='+'a'.repeat(48))).status,404);
 assert.equal((await call(store,'/v1/unsubscribe?token=nope')).status,400);
});

/* ── Access control ──────────────────────────────────────────────────────── */

test('a foreign origin is refused', async () => {
 const store=memoryStore();
 const response=await handle(new Request('https://api.example.test/v1/stats',
  {headers:{origin:'https://evil.example'}}),env,store);
 assert.equal(response.status,403);
});

test('the admin endpoints need the token', async () => {
 const store=memoryStore();
 assert.equal((await call(store,'/v1/admin/subscribers')).status,401);
 assert.equal((await call(store,'/v1/admin/subscribers',{headers:{authorization:'Bearer wrong-token-here!'}})).status,401);
 const ok=await call(store,'/v1/admin/subscribers',{headers:{authorization:`Bearer ${env.ADMIN_TOKEN}`}});
 assert.equal(ok.status,200);
 const body=await ok.json() as {counts:{confirmed:number}};
 assert.equal(body.counts.confirmed,0);
});

test('preflight and health work, and unknown paths 404', async () => {
 const store=memoryStore();
 assert.equal((await call(store,'/v1/usage',{method:'OPTIONS'})).status,204);
 const health=await call(store,'/v1/health');
 assert.equal(health.status,200);
 assert.equal((await call(store,'/v1/anything-else')).status,404);
});

test('a malformed or oversized body is handled without a stack trace', async () => {
 const store=memoryStore();
 const bad=await call(store,'/v1/usage',{method:'POST',body:'{not json',headers:{'content-type':'application/json'}});
 assert.equal(bad.status,400);
 const huge=await call(store,'/v1/usage',{method:'POST',body:JSON.stringify({day:'x'.repeat(5000)}),
  headers:{'content-type':'application/json'}});
 assert.equal(huge.status,500);
 assert.match((await huge.json() as {error:string}).error,/went wrong/);
 assert.ok(!(await bad.text()).includes('SyntaxError'));
});
