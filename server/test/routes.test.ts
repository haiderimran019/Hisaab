/* The new surface: the portal, the review broker, the sales ledger and the
   document quota — and first, the guarantee that holds all of it together.

   api.test.ts proves one endpoint refuses financial data. That was fine when
   there was one endpoint taking a body. There are now a dozen, so the test
   below walks ROUTES itself rather than a list someone has to remember to
   extend. Add a route that quietly accepts an unknown field and this fails
   without anybody editing it. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSign,generateKeyPairSync,createPrivateKey,randomUUID} from 'node:crypto';
import {handle,ROUTES,type Env} from '../src/index.ts';
import {memoryStore,type Store} from '../src/store.ts';
import {primeGoogleKeys,clearGoogleKeys,plusDays,plusMinutes,hashEmail} from '../src/auth.ts';
import {readReviewRequest,readIssue,readErasure,readLicenceStatus,randomToken} from '../src/validate.ts';
import {taxYearOf} from '../src/routes/documents.ts';
import {addYears} from '../src/routes/admin.ts';

/* ── fixtures ─────────────────────────────────────────────────────────────── */

const b64url=(b:Buffer)=>b.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');

/** The licence signing pair. Mirrors tools/make-license.mjs; the real private
    key is never on a server and never in this repository. */
const licencePair=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const licenceJwk=JSON.stringify(licencePair.publicKey.export({format:'jwk'}));
const licencePriv=createPrivateKey({key:licencePair.privateKey.export({format:'jwk'}),format:'jwk'});
const signedLicence=(over:Record<string,unknown>={})=>{
 const payload={v:1,id:randomUUID(),name:'Ayesha',plan:'pro',issued:'2026-01-01',expires:'2027-10-01',...over};
 const bytes=Buffer.from(JSON.stringify(payload),'utf8');
 return `HSB1.${b64url(bytes)}.${b64url(createSign('SHA256').update(bytes).sign({key:licencePriv,dsaEncoding:'ieee-p1363'}))}`;
};

/** A reviewer's published key: EC P-256, the curve the app's verifier knows. */
const reviewerJwk=JSON.stringify(
 generateKeyPairSync('ec',{namedCurve:'prime256v1'}).publicKey.export({format:'jwk'}));

const ADMIN='admin-token-for-tests';
const ORIGIN='https://app.test';
const CLIENT_ID='1234.apps.googleusercontent.com';
const env:Env={DB:null,ALLOWED_ORIGIN:ORIGIN,RATE_SECRET:'test-secret-value',ADMIN_TOKEN:ADMIN,
 LICENCE_PUBLIC_KEY:licenceJwk,GOOGLE_CLIENT_ID:CLIENT_ID,
 MODEL_PROVIDER:'gemini',MODEL_NAME:'test-model',MODEL_KEY:'k',READER_NAME:'Test Reader'};

const call=(store:Store,path:string,init:RequestInit&{env?:Env;ip?:string}={})=>
 handle(new Request('https://api.test'+path,{
  headers:{origin:ORIGIN,'cf-connecting-ip':init.ip??'203.0.113.9',...(init.headers??{})},
  method:init.method,body:init.body}),init.env??env,store);
const post=(store:Store,path:string,body:unknown,headers:Record<string,string>={},more:{env?:Env;ip?:string}={})=>
 call(store,path,{method:'POST',body:JSON.stringify(body),
  headers:{'content-type':'application/json',...headers},...more});
const auth=(token:string)=>({authorization:`Bearer ${token}`});
const admin=auth(ADMIN);
const body=async <T>(r:Response)=>await r.json() as T;

/** Puts a signed-in session straight in the store: the sign-in flow has its own
    tests below and the rest of them should not have to re-run it. */
async function sessionFor(store:Store,email:string){
 const token=randomToken();
 const now=new Date().toISOString();
 await store.addSession({token,email,method:'link',createdAt:now,expiresAt:plusDays(now,30)});
 return token;
}

async function activeReviewer(store:Store,contactEmail='reviewer@firm.pk'){
 const created=await post(store,'/v1/admin/reviewer',
  {name:'Sana Malik',firm:'Malik & Co',registration:'ICAP-1234',
   publicKey:reviewerJwk,contactEmail},admin);
 const {id}=await body<{id:string}>(created);
 await post(store,'/v1/admin/reviewer/status',{id,status:'active'},admin);
 return id;
}

/* ── The central guarantee, driven off the route table ────────────────────── */

/* Four routes read no JSON body, so there is no allow-list for them to fail.
   Purge, signout and resend take everything they need from the session or the
   admin token, and the one-click unsubscribe takes its token from the query
   string because RFC 8058 has the mail provider POST a form body of its own,
   which we ignore. They are named here rather than skipped silently, and they
   are still asserted on: nothing from the payload may come back out of them.
   A new route only lands in this set deliberately — leave it out and the
   assertion below demands the allow-list refusal like everywhere else. */
const NO_JSON_BODY=new Set([
 '/v1/admin/purge','/v1/portal/signout','/v1/portal/resend','/v1/unsubscribe']);

const LEAKS={income:4203631,client:'Orbit Labs',taxDue:10750.98,
 receipts:[{gross:'1800'}],lines:[{amount:'-6500'}],ntn:'1234567',installId:'abc-123'};

test('no route in the service accepts financial data, whoever is calling', async () => {
 const store=memoryStore();
 const posts=ROUTES.filter(r=>r.method==='POST');
 assert.ok(posts.length>=10,'the table should be the thing under test, not a stub');

 for(const route of posts){
  // A session per route, because one of the routes under test is signout.
  const headers=route.auth==='admin'?admin
   :route.auth==='session'?auth(await sessionFor(store,'ayesha@example.com')):{};
  // A fresh IP per route so one route's rate limit cannot mask another's answer.
  const response=await post(store,route.path,LEAKS,headers,{ip:`10.0.0.${posts.indexOf(route)+1}`});
  const text=await response.text();

  if(NO_JSON_BODY.has(route.path)){
   for(const value of ['4203631','Orbit Labs','10750.98','1800','6500','1234567','abc-123'])
    assert.ok(!text.includes(value),`${route.path} echoed ${value}`);
   continue;
  }

  assert.equal(response.status,400,`${route.method} ${route.path} answered ${response.status}: ${text}`);
  assert.match(text,/does not accept/,`${route.path} refused the body for the wrong reason`);
  assert.match(text,/never sends financial data/,`${route.path} did not say why`);
  // The refusal names the fields, and names nothing but the fields.
  assert.ok(!text.includes('4203631')&&!text.includes('Orbit Labs')&&!text.includes('10750.98'),
   `${route.path} echoed a value back in its refusal`);
 }
});

test('every GET route is reachable only as a GET, and no path is registered twice', async () => {
 const store=memoryStore();
 const seen=new Set<string>();
 for(const route of ROUTES){
  const key=`${route.method} ${route.path}`;
  assert.ok(!seen.has(key),`duplicate route ${key}`);
  seen.add(key);
 }
 // A GET sent as a POST is a 405 with the right method named, not a 404.
 const wrong=await post(store,'/v1/health',{});
 assert.equal(wrong.status,405);
 assert.match((await body<{error:string}>(wrong)).error,/accepts GET/);
});

test('a session route refuses a token that is absent, malformed, unknown or expired', async () => {
 const store=memoryStore();
 assert.equal((await call(store,'/v1/portal/licences')).status,401);
 assert.equal((await call(store,'/v1/portal/licences',{headers:auth('not-hex')})).status,401);
 assert.equal((await call(store,'/v1/portal/licences',{headers:auth('a'.repeat(48))})).status,401);

 const stale=randomToken();
 const now=new Date().toISOString();
 await store.addSession({token:stale,email:'old@example.com',method:'link',
  createdAt:plusDays(now,-40),expiresAt:plusDays(now,-10)});
 const response=await call(store,'/v1/portal/licences',{headers:auth(stale)});
 assert.equal(response.status,401);
 assert.match((await body<{error:string}>(response)).error,/expired/);
 assert.equal(await store.findSession(stale),null,'an expired session is deleted, not left lying about');
});

/* ── Portal sign-in ──────────────────────────────────────────────────────── */

test('asking for a sign-in link says the same thing whether or not we know the address', async () => {
 const store=memoryStore();
 await post(store,'/v1/admin/licence',{keyId:randomUUID(),licenceKey:signedLicence(),
  email:'known@example.com',name:'Ayesha',plan:'pro',amountMinor:240000,currency:'PKR',
  paymentRef:'ref-1',years:1},admin);

 const known=await post(store,'/v1/portal/signin',{email:'known@example.com'});
 const stranger=await post(store,'/v1/portal/signin',{email:'nobody@example.com'});
 assert.equal(known.status,stranger.status);
 const a=await body<{message:string}>(known);
 const b=await body<{message:string}>(stranger);
 assert.equal(a.message,b.message,'the reply must not reveal who is a customer');
 assert.match(a.message,/works once/);
});

test('a sign-in link works exactly once, and not after it expires', async () => {
 const store=memoryStore();
 await post(store,'/v1/portal/signin',{email:'ayesha@example.com'});
 const [issued]=await store.allAuthTokens(5);
 assert.equal(issued.email,'ayesha@example.com');
 assert.equal(issued.usedAt,null);
 const token=issued.token;

 const first=await post(store,'/v1/portal/session',{token});
 assert.equal(first.status,200);
 const {session,email}=await body<{session:string;email:string}>(first);
 assert.match(session,/^[0-9a-f]{48}$/);
 assert.equal(email,'ayesha@example.com');

 const second=await post(store,'/v1/portal/session',{token});
 assert.equal(second.status,401);
 assert.match((await body<{error:string}>(second)).error,/already been used/);

 // And the session it produced is the one the licence route accepts.
 const licences=await call(store,'/v1/portal/licences',{headers:auth(session)});
 assert.equal(licences.status,200);
 assert.equal((await body<{email:string}>(licences)).email,'ayesha@example.com');
});

test('an expired sign-in link is refused rather than silently renewed', async () => {
 const store=memoryStore();
 const token=randomToken();
 const now=new Date().toISOString();
 await store.addAuthToken({token,email:'late@example.com',createdAt:plusMinutes(now,-60),
  expiresAt:plusMinutes(now,-30),usedAt:null});
 const response=await post(store,'/v1/portal/session',{token});
 assert.equal(response.status,401);
 assert.match((await body<{error:string}>(response)).error,/expired/);
 const after=await store.findAuthToken(token);
 assert.equal(after?.usedAt,null,'a refused link is not marked used');
});

/* ── Google sign-in ──────────────────────────────────────────────────────── */

const googlePair=generateKeyPairSync('rsa',{modulusLength:2048});
const googleJwk={...googlePair.publicKey.export({format:'jwk'}),kid:'test-kid',alg:'RS256',use:'sig'};

/** Mints an ID token the way Google would, so the verifier is tested rather
    than mocked. Nothing here reaches the network. */
function idToken(over:Record<string,unknown>={},kid='test-kid'){
 const header=b64url(Buffer.from(JSON.stringify({alg:'RS256',kid,typ:'JWT'})));
 const claims=b64url(Buffer.from(JSON.stringify({
  iss:'https://accounts.google.com',aud:CLIENT_ID,
  exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000),
  email:'ayesha@gmail.com',email_verified:true,...over})));
 const sig=b64url(createSign('RSA-SHA256').update(`${header}.${claims}`).sign(googlePair.privateKey));
 return `${header}.${claims}.${sig}`;
}

test('a genuine Google token signs the buyer in, and a tampered one does not', async (t) => {
 primeGoogleKeys([googleJwk]);
 t.after(clearGoogleKeys);
 const store=memoryStore();

 const good=await post(store,'/v1/portal/signin',{idToken:idToken()});
 assert.equal(good.status,200);
 const {session,email}=await body<{session:string;email:string}>(good);
 assert.equal(email,'ayesha@gmail.com');
 assert.ok(await store.findSession(session));

 const tampered=idToken().slice(0,-4)+'AAAA';
 const bad=await post(store,'/v1/portal/signin',{idToken:tampered},{},{ip:'10.1.1.1'});
 assert.equal(bad.status,401);
 assert.match((await body<{error:string}>(bad)).error,/could not be verified/);
});

test('a Google token minted for another site, expired, or unverified is refused', async (t) => {
 primeGoogleKeys([googleJwk]);
 t.after(clearGoogleKeys);
 const store=memoryStore();
 const cases:[string,Record<string,unknown>,RegExp][]=[
  ['another audience',{aud:'someone-else.apps.googleusercontent.com'},/not issued for Hisaab/],
  ['an expired token',{exp:Math.floor(Date.now()/1000)-60},/expired/],
  ['an unverified address',{email_verified:false},/no verified email/],
  ['a foreign issuer',{iss:'https://evil.example'},/could not be verified/],
  ['no address at all',{email:undefined},/could not be verified|carried no email/]
 ];
 let ip=20;
 for(const [label,over,expected] of cases){
  const response=await post(store,'/v1/portal/signin',{idToken:idToken(over)},{},{ip:`10.2.0.${ip++}`});
  assert.equal(response.status,401,label);
  assert.match((await body<{error:string}>(response)).error,expected,label);
 }
 // An unknown signing key is refused rather than trusted on the strength of the header.
 const unknown=await post(store,'/v1/portal/signin',{idToken:idToken({},'other-kid')},{},{ip:'10.2.1.1'});
 assert.equal(unknown.status,401);
});

test('Google sign-in is off, with a clear answer, when no client id is configured', async () => {
 const store=memoryStore();
 const response=await post(store,'/v1/portal/signin',{idToken:idToken()},{},
  {env:{...env,GOOGLE_CLIENT_ID:undefined}});
 assert.equal(response.status,501);
 assert.match((await body<{error:string}>(response)).error,/not switched on/);
});

test('sign-in takes an address or a Google token, never both', async () => {
 const store=memoryStore();
 const response=await post(store,'/v1/portal/signin',{email:'a@b.co',idToken:idToken()});
 assert.equal(response.status,400);
 assert.match((await body<{error:string}>(response)).error,/not both/);
});

/* ── The sales ledger ────────────────────────────────────────────────────── */

const sale=(over:Record<string,unknown>={})=>({keyId:randomUUID(),licenceKey:signedLicence(),
 email:'buyer@example.com',name:'Ayesha Khan',plan:'pro',amountMinor:240000,
 currency:'PKR',paymentRef:'jazzcash-9981',years:1,...over});

test('a sale is recorded once, and a retried request does not double it', async () => {
 const store=memoryStore();
 const payload=sale();
 const first=await post(store,'/v1/admin/licence',payload,admin);
 assert.equal(first.status,201);
 const {expiresAt}=await body<{expiresAt:string}>(first);
 assert.equal(expiresAt,addYears(new Date().toISOString().slice(0,10),1));

 const retry=await post(store,'/v1/admin/licence',payload,admin);
 assert.equal(retry.status,409,'one payment, one ledger row');
 assert.match((await body<{error:string}>(retry)).error,/Nothing was changed/);
 assert.equal((await store.licencesByEmail('buyer@example.com')).length,1);
});

test('money is recorded as whole minor units, and the ledger is ours alone', async () => {
 assert.equal(readIssue(sale({amountMinor:2400.5})).ok,false,'no floats in a sale');
 assert.equal(readIssue(sale({amountMinor:-1})).ok,false);
 assert.equal(readIssue(sale({years:9})).ok,false);
 assert.equal(readIssue(sale({licenceKey:'not-a-key'})).ok,false);
 assert.equal(readIssue(sale({keyId:'nope'})).ok,false,'the key id is the uuid printed with the key');
 assert.equal(readIssue(sale({plan:'enterprise'})).ok,false);

 const store=memoryStore();
 await post(store,'/v1/admin/licence',sale({email:'buyer@example.com'}),admin);
 const session=await sessionFor(store,'buyer@example.com');
 const mine=await call(store,'/v1/portal/licences',{headers:auth(session)});
 const seen=await body<{licences:Record<string,unknown>[];note:string}>(mine);
 assert.equal(seen.licences.length,1);
 for(const ours of ['amountMinor','paymentRef','note','currency'])
  assert.ok(!(ours in seen.licences[0]),`${ours} is our bookkeeping, not the customer's licence`);
 assert.equal(seen.licences[0].key,undefined===seen.licences[0].key?undefined:seen.licences[0].key);
 assert.match(seen.note,/never phones home/);
});

test('a refund marks the ledger and says plainly that it does not revoke the key', async () => {
 const store=memoryStore();
 const payload=sale();
 await post(store,'/v1/admin/licence',payload,admin);
 const response=await post(store,'/v1/admin/licence/status',
  {keyId:payload.keyId,status:'refunded',note:'asked within 14 days'},admin);
 assert.equal(response.status,200);
 assert.match((await body<{note:string}>(response)).note,/is not revoked/);
 assert.equal((await store.findLicence(payload.keyId))?.status,'refunded');

 assert.equal((await post(store,'/v1/admin/licence/status',
  {keyId:'no-such-key',status:'refunded'},admin)).status,404);
 assert.equal(readLicenceStatus({keyId:'x',status:'cancelled'}).ok,false);
});

test('the ledger is unreachable without the admin token', async () => {
 const store=memoryStore();
 for(const path of ['/v1/admin/licence','/v1/admin/reviewers'])
  assert.equal((await call(store,path)).status,401,path);
 assert.equal((await post(store,'/v1/admin/licence',sale(),auth('admin-token-for-testt'))).status,401,
  'a token of the right length but wrong value');
 assert.equal((await post(store,'/v1/admin/licence',sale(),{},{env:{...env,ADMIN_TOKEN:''}})).status,401,
  'an unset admin token locks the door rather than opening it');
});

/* ── The review broker: a fingerprint, never a pack ──────────────────────── */

const FINGERPRINT='a'.repeat(64);

test('a review request carries a hash of the pack and refuses anything else', () => {
 const base={reviewerId:randomUUID(),fingerprint:FINGERPRINT,taxYear:'2026'};
 assert.equal(readReviewRequest(base).ok,true);

 // The shapes someone would try if they wanted to send the pack itself.
 for(const instead of ['{"income":450000}','JVBERi0xLjQK'+'A'.repeat(200),'a'.repeat(63),'A'.repeat(64)]){
  const result=readReviewRequest({...base,fingerprint:instead});
  assert.equal(result.ok,false,instead.slice(0,20));
 }
 const refused=readReviewRequest({...base,fingerprint:'nope'}) as {error:string};
 assert.match(refused.error,/SHA-256 hash/);
 assert.match(refused.error,/never sends the pack itself/);
 assert.equal(readReviewRequest({...base,pack:'...'}).ok,false,'no field for a pack exists');
 assert.equal(readReviewRequest({...base,taxYear:'2019'}).ok,false);
});

test('a request reaches a listed reviewer, and the pack is sent outside this service', async () => {
 const store=memoryStore();
 const reviewerId=await activeReviewer(store);
 const session=await sessionFor(store,'ayesha@example.com');

 const response=await post(store,'/v1/review/request',
  {reviewerId,fingerprint:FINGERPRINT,taxYear:'2026'},auth(session));
 assert.equal(response.status,201);
 const made=await body<{jobId:string;reviewer:{contactEmail:string};next:string}>(response);
 assert.equal(made.reviewer.contactEmail,'reviewer@firm.pk');
 assert.match(made.next,/does not go through Hisaab/);

 // What the service kept: the hash, and nothing resembling a document.
 const stored=await store.findReviewJob(made.jobId);
 assert.equal(stored?.fingerprint,FINGERPRINT);
 assert.equal(stored?.status,'requested');
 assert.deepEqual(Object.keys(stored!).sort(),
  ['createdAt','customerEmail','fingerprint','id','reviewerId','signature','status','taxYear','updatedAt']);
});

test('a pending or suspended reviewer takes no work, and is not published', async () => {
 const store=memoryStore();
 const created=await post(store,'/v1/admin/reviewer',
  {name:'Unchecked Person',firm:'',registration:'',publicKey:reviewerJwk,
   contactEmail:'unchecked@firm.pk'},admin);
 assert.equal(created.status,201);
 const {id,status}=await body<{id:string;status:string}>(created);
 assert.equal(status,'pending','being in the table is not being published');

 const listed=await call(store,'/v1/reviewers');
 const seen=await body<{reviewers:{id:string}[];note:string}>(listed);
 assert.equal(seen.reviewers.length,0);
 assert.match(seen.note,/does not employ these practitioners/);

 const session=await sessionFor(store,'ayesha@example.com');
 const refused=await post(store,'/v1/review/request',
  {reviewerId:id,fingerprint:FINGERPRINT,taxYear:'2026'},auth(session));
 assert.equal(refused.status,404);

 await post(store,'/v1/admin/reviewer/status',{id,status:'active'},admin);
 const published=await body<{reviewers:{registration:string}[]}>(await call(store,'/v1/reviewers'));
 assert.equal(published.reviewers.length,1);
 assert.ok(!('contactEmail' in published.reviewers[0]),
  'a published reviewer is not a published mailbox');
});

test('a reviewer only sees and signs their own jobs', async () => {
 const store=memoryStore();
 const mine=await activeReviewer(store,'first@firm.pk');
 const theirs=await activeReviewer(store,'second@firm.pk');
 const customer=await sessionFor(store,'ayesha@example.com');
 const {jobId}=await body<{jobId:string}>(await post(store,'/v1/review/request',
  {reviewerId:mine,fingerprint:FINGERPRINT,taxYear:'2026'},auth(customer)));

 // A customer is not a reviewer, however they signed in.
 assert.equal((await call(store,'/v1/review/queue',{headers:auth(customer)})).status,403);

 const other=await sessionFor(store,'second@firm.pk');
 const probe=await post(store,'/v1/review/update',
  {jobId,status:'accepted'},auth(other));
 assert.equal(probe.status,404,'another reviewer cannot touch this job');
 const invented=await post(store,'/v1/review/update',{jobId:randomUUID(),status:'accepted'},auth(other));
 assert.equal(await probe.clone().text(),await invented.text(),
  'and cannot tell a job that is not theirs from one that does not exist');

 const ownQueue=await body<{jobs:{id:string}[]}>(
  await call(store,'/v1/review/queue',{headers:auth(other)}));
 assert.equal(ownQueue.jobs.length,0);
 void theirs;

 const reviewer=await sessionFor(store,'first@firm.pk');
 const queue=await body<{jobs:{id:string;fingerprint:string}[]}>(
  await call(store,'/v1/review/queue',{headers:auth(reviewer)}));
 assert.deepEqual(queue.jobs.map(j=>j.id),[jobId]);
 assert.equal(queue.jobs[0].fingerprint,FINGERPRINT);
});

test('a signed review is final, and signing needs a signature', async () => {
 const store=memoryStore();
 const reviewerId=await activeReviewer(store);
 const customer=await sessionFor(store,'ayesha@example.com');
 const reviewer=await sessionFor(store,'reviewer@firm.pk');
 const {jobId}=await body<{jobId:string}>(await post(store,'/v1/review/request',
  {reviewerId,fingerprint:FINGERPRINT,taxYear:'2026'},auth(customer)));

 const unsigned=await post(store,'/v1/review/update',{jobId,status:'signed'},auth(reviewer));
 assert.equal(unsigned.status,400);
 assert.match((await body<{error:string}>(unsigned)).error,/signature produced by your reviewer key/);

 const signature='A'.repeat(88);
 assert.equal((await post(store,'/v1/review/update',
  {jobId,status:'accepted'},auth(reviewer))).status,200);
 assert.equal((await post(store,'/v1/review/update',
  {jobId,status:'signed',signature},auth(reviewer))).status,200);

 const again=await post(store,'/v1/review/update',
  {jobId,status:'declined'},auth(reviewer));
 assert.equal(again.status,409);
 assert.match((await body<{error:string}>(again)).error,/already signed/);
 assert.equal((await store.findReviewJob(jobId))?.signature,signature);

 // The customer sees the outcome, with a name rather than a uuid.
 const jobs=await body<{jobs:{status:string;reviewerName:string}[]}>(
  await call(store,'/v1/review/jobs',{headers:auth(customer)}));
 assert.equal(jobs.jobs[0].status,'signed');
 assert.equal(jobs.jobs[0].reviewerName,'Sana Malik');
});

test('a reviewer key that could not verify a signature is refused up front', async () => {
 const store=memoryStore();
 for(const publicKey of ['not json','{"kty":"RSA","n":"'+'A'.repeat(60)+'","e":"AQAB"}',
  '{"kty":"EC","crv":"P-384","x":"'+'A'.repeat(40)+'","y":"'+'A'.repeat(40)+'"}']){
  const response=await post(store,'/v1/admin/reviewer',
   {name:'X',publicKey,contactEmail:'x@firm.pk'},admin);
  assert.equal(response.status,400,publicKey.slice(0,24));
 }
});

/* ── The document quota and the country gate ─────────────────────────────── */

test("Pakistan's tax year decides when the document allowance resets", () => {
 assert.equal(taxYearOf('2026-07-01'),'2027','July starts the new year');
 assert.equal(taxYearOf('2026-06-30'),'2026');
 assert.equal(taxYearOf('2026-12-31'),'2027');
 assert.equal(taxYearOf('2027-01-01'),'2027');
});

const PDF=Buffer.from('%PDF-1.4 pretend').toString('base64');
const reply=(text:string)=>JSON.stringify({candidates:[{content:{parts:[{text}]}}]});
const stubFetch=(payload:string)=>(async ()=>new Response(payload,{status:200})) as typeof fetch;

test('one licence cannot read documents all year at our expense', async (t) => {
 const store=memoryStore();
 const real=globalThis.fetch;
 globalThis.fetch=stubFetch(reply(JSON.stringify({rows:[]})));
 t.after(()=>{globalThis.fetch=real;});

 const licence=signedLicence();
 const capped={...env,EXTRACT_ANNUAL_CAP:'3'};
 const statuses:number[]=[];
 for(let i=0;i<5;i++){
  // A new IP each time, so this measures the per-licence cap and not the per-IP one.
  const response=await post(store,'/v1/extract',{licence,mime:'application/pdf',data:PDF},{},
   {env:capped,ip:`198.51.100.${i+1}`});
  statuses.push(response.status);
  if(response.status===429){
   const refused=await body<{error:string;cap:number}>(response);
   assert.equal(refused.cap,3);
   assert.match(refused.error,/Import a CSV/,'the way out must be named, not just the limit');
  }
 }
 assert.deepEqual(statuses,[200,200,200,429,429]);

 // A different licence has its own allowance.
 const fresh=await post(store,'/v1/extract',{licence:signedLicence(),mime:'application/pdf',data:PDF},{},
  {env:capped,ip:'198.51.100.200'});
 assert.equal(fresh.status,200);
});

test('the quota can be read without sending a document, and leaks nothing else', async () => {
 const store=memoryStore();
 const licence=signedLicence();
 const response=await post(store,'/v1/extract/quota',{licence});
 assert.equal(response.status,200);
 const seen=await body<Record<string,unknown>>(response);
 assert.deepEqual(Object.keys(seen).sort(),['available','cap','taxYear','used']);
 assert.equal(seen.used,0);
 assert.equal(seen.available,true);

 assert.equal((await post(store,'/v1/extract/quota',{licence:'nonsense'})).status,402);
 const off=await post(store,'/v1/extract/quota',{licence},{},{env:{...env,READER_NAME:undefined}});
 assert.equal((await body<{available:boolean}>(off)).available,false,
  'an unnamed reader is an unavailable reader');
});

test('document reading can be switched off for a country without touching anything else', async () => {
 const store=memoryStore();
 const gated={...env,EXTRACT_BLOCKED_COUNTRIES:'PK, IN'};
 const fromPakistan=await handle(new Request('https://api.test/v1/extract',{method:'POST',
  headers:{origin:ORIGIN,'content-type':'application/json','cf-connecting-ip':'1.2.3.4',
   'cf-ipcountry':'pk'},
  body:JSON.stringify({licence:signedLicence(),mime:'application/pdf',data:PDF})}),gated,store);
 assert.equal(fromPakistan.status,451,'unavailable for legal reasons, which is what this is');
 const refused=await body<{error:string}>(fromPakistan);
 assert.match(refused.error,/outside it/);
 assert.match(refused.error,/never leaves your device/,'the offline path must be offered, not just the refusal');

 // Everything else still works from there, because nothing else leaves the device.
 const elsewhere=await handle(new Request('https://api.test/v1/extract/quota',{method:'POST',
  headers:{origin:ORIGIN,'content-type':'application/json','cf-connecting-ip':'1.2.3.5',
   'cf-ipcountry':'PK'},
  body:JSON.stringify({licence:signedLicence()})}),gated,store);
 assert.equal(elsewhere.status,200);
});

test('nothing is read until this service says who reads it', async () => {
 const store=memoryStore();
 const response=await post(store,'/v1/extract',{licence:signedLicence(),mime:'application/pdf',data:PDF},
  {},{env:{...env,READER_NAME:undefined}});
 assert.equal(response.status,501);
 assert.match((await body<{error:string}>(response)).error,/who reads the document/);
});

test('a licence with no id cannot be metered, so it is refused rather than let through', async () => {
 const store=memoryStore();
 const response=await post(store,'/v1/extract',
  {licence:signedLicence({id:undefined}),mime:'application/pdf',data:PDF});
 assert.equal(response.status,402);
 assert.match((await body<{error:string}>(response)).error,/missing its identifier/);
});

/* ── Erasure ─────────────────────────────────────────────────────────────── */

test('erasure is permanent, needs confirming, and is recorded without the address', async () => {
 const store=memoryStore();
 assert.equal(readErasure({scope:'all'}).ok,false,'permanent means confirm: true');
 assert.match((readErasure({scope:'all'}) as {error:string}).error,/cannot be undone/);
 assert.equal(readErasure({scope:'everything',confirm:true}).ok,false);

 await post(store,'/v1/subscribe',{email:'ayesha@example.com',consent:true});
 await post(store,'/v1/admin/licence',sale({email:'ayesha@example.com'}),admin);
 const reviewerId=await activeReviewer(store);
 const session=await sessionFor(store,'ayesha@example.com');
 await post(store,'/v1/review/request',{reviewerId,fingerprint:FINGERPRINT,taxYear:'2026'},auth(session));

 const response=await post(store,'/v1/portal/erase',{scope:'all',confirm:true},auth(session));
 assert.equal(response.status,200);
 const done=await body<{erased:{subscribers:number;licences:number};message:string}>(response);
 assert.equal(done.erased.subscribers,1);
 assert.equal(done.erased.licences,1);
 assert.match(done.message,/could not revoke them if we wanted to/,
  'the honest limit of an offline licence has to be said out loud');

 assert.deepEqual(await store.licencesByEmail('ayesha@example.com'),[]);
 assert.equal((await store.countSubscribers()).pending,0);
 assert.deepEqual(await store.jobsForCustomer('ayesha@example.com',10),[]);

 // What is left behind is a hash, so "did you honour it" can be answered
 // without keeping the address we were asked to forget.
 const hash=await hashEmail('ayesha@example.com',env.RATE_SECRET);
 const record=await store.findErasure(hash);
 assert.ok(record,'the erasure itself is recorded');
 assert.equal(record!.scope,'all');
 assert.ok(!hash.includes('ayesha'),'and the record cannot be read back as an address');
 assert.match(hash,/^[0-9a-f]{64}$/);
 assert.notEqual(hash,await hashEmail('ayesha@example.com','another-secret'));
});

test('a subscriber-only erasure leaves the sale, which we are required to keep', async () => {
 const store=memoryStore();
 await post(store,'/v1/subscribe',{email:'ayesha@example.com',consent:true});
 await post(store,'/v1/admin/licence',sale({email:'ayesha@example.com'}),admin);
 const session=await sessionFor(store,'ayesha@example.com');
 const response=await post(store,'/v1/portal/erase',{scope:'subscriber',confirm:true},auth(session));
 assert.equal(response.status,200);
 assert.equal((await store.countSubscribers()).pending,0);
 assert.equal((await store.licencesByEmail('ayesha@example.com')).length,1);
});

test('signing out ends the session it was called with', async () => {
 const store=memoryStore();
 const session=await sessionFor(store,'ayesha@example.com');
 assert.equal((await post(store,'/v1/portal/signout',{},auth(session))).status,200);
 assert.equal(await store.findSession(session),null);
 assert.equal((await call(store,'/v1/portal/licences',{headers:auth(session)})).status,401);
});

test('purging clears what expired and nothing that did not', async () => {
 const store=memoryStore();
 const live=await sessionFor(store,'live@example.com');
 const now=new Date().toISOString();
 const dead=randomToken();
 await store.addSession({token:dead,email:'dead@example.com',method:'link',
  createdAt:plusDays(now,-60),expiresAt:plusDays(now,-1)});
 const response=await post(store,'/v1/admin/purge',{},admin);
 assert.equal(response.status,200);
 assert.equal(await store.findSession(dead),null);
 assert.ok(await store.findSession(live),'a live session survives a purge');
});
