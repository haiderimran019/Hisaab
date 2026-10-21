import test from 'node:test';
import assert from 'node:assert/strict';
import {createSign,generateKeyPairSync,createPrivateKey} from 'node:crypto';
import {handle,type Env} from '../src/index.ts';
import {memoryStore} from '../src/store.ts';
import {readExtractRequest,licenceAllows,readModelRows,providerFor,PROMPT,MAX_BASE64} from '../src/extract.ts';

const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const publicJwk=JSON.stringify(publicKey.export({format:'jwk'}));
const priv=createPrivateKey({key:privateKey.export({format:'jwk'}),format:'jwk'});
const b64url=(b:Buffer)=>b.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const licence=(over:Record<string,unknown>={})=>{
 const payload={v:1,id:'x',name:'Ayesha',plan:'pro',issued:'2026-01-01',expires:'2027-10-01',...over};
 const bytes=Buffer.from(JSON.stringify(payload),'utf8');
 return `HSB1.${b64url(bytes)}.${b64url(createSign('SHA256').update(bytes).sign({key:priv,dsaEncoding:'ieee-p1363'}))}`;
};
const today='2026-10-21';
const env:Env={DB:null,ALLOWED_ORIGIN:'https://app.test',RATE_SECRET:'s',ADMIN_TOKEN:'a',
 LICENCE_PUBLIC_KEY:publicJwk,MODEL_PROVIDER:'gemini',MODEL_NAME:'test-model',MODEL_KEY:'k'};
const FILE=Buffer.from('%PDF-1.4 pretend').toString('base64');
const post=(e:Env,body:unknown)=>handle(new Request('https://api.test/v1/extract',{method:'POST',
 headers:{origin:'https://app.test','content-type':'application/json','cf-connecting-ip':'1.1.1.1'},
 body:JSON.stringify(body)}),e,memoryStore());

/* ── The endpoint is off unless deliberately switched on ─────────────────── */

test('with no model configured, nothing is read', async () => {
 const response=await post({...env,MODEL_KEY:undefined},{licence:licence(),mime:'application/pdf',data:FILE});
 assert.equal(response.status,501);
 assert.match((await response.json() as {error:string}).error,/not switched on/);
});

/* ── Paid, and checked here rather than taken on trust ───────────────────── */

test('a document is only read for a licence that actually verifies', async () => {
 assert.equal((await licenceAllows(licence(),publicJwk,today)).ok,true);
 const forged=licence().slice(0,-3)+'AAA';
 assert.equal((await licenceAllows(forged,publicJwk,today)).ok,false);
 const other=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 const elsewhere=await licenceAllows(licence(),JSON.stringify(other.publicKey.export({format:'jwk'})),today);
 assert.equal(elsewhere.ok,false);
});

test('an expired licence is refused, and told so kindly', async () => {
 const result=await licenceAllows(licence({expires:'2026-09-01'}),publicJwk,today);
 assert.equal(result.ok,false);
 assert.equal(result.status,402);
 assert.match(result.error,/records are untouched/);
});

test('the free plan cannot reach the reader', async () => {
 const result=await licenceAllows(licence({plan:'free'}),publicJwk,today);
 assert.equal(result.ok,false);
 const response=await post(env,{licence:'nonsense',mime:'application/pdf',data:FILE});
 assert.equal(response.status,402);
});

/* ── What may be sent ────────────────────────────────────────────────────── */

test('only documents go in, and nothing may ride along with them', () => {
 const base={licence:licence(),mime:'application/pdf',data:FILE};
 assert.equal(readExtractRequest(base).ok,true);
 const sneaky=readExtractRequest({...base,income:'450000',client:'Orbit Labs'});
 assert.equal(sneaky.ok,false);
 assert.match((sneaky as {error:string}).error,/does not accept/);
 assert.equal(readExtractRequest({...base,mime:'text/html'}).ok,false,'only pdf, png and jpeg');
 assert.equal(readExtractRequest({...base,mime:'application/zip'}).ok,false);
 assert.equal(readExtractRequest({...base,data:'not base64!!'}).ok,false);
 assert.equal(readExtractRequest({...base,data:'A'.repeat(MAX_BASE64+1)}).ok,false,'size is capped');
});

/* ── The model is treated as a stranger ──────────────────────────────────── */

test('only rows that parse strictly survive; nothing is repaired', () => {
 const rows=readModelRows(JSON.stringify({rows:[
  {date:'2026-07-01',description:'Good',amount:'1000.00',balance:'11000.00'},
  {date:'01/07/2026',description:'Wrong date format',amount:'1000',balance:''},
  {date:'2026-07-03',description:'No amount',amount:'',balance:'12000'},
  {date:'2026-07-04',description:'Amount is prose',amount:'about five thousand',balance:''},
  {date:'2026-07-05',description:'Fine, no balance',amount:'-250.5',balance:''},
  {date:'2026-07-06',description:'Bad balance',amount:'10',balance:'twelve'},
  'not an object',null
 ]}));
 assert.deepEqual(rows.map(r=>r.description),['Good','Fine, no balance']);
 assert.equal(rows[0].amount,'1000.00');
});

test('a model that returns prose, markdown or nonsense yields nothing rather than guesses', () => {
 assert.deepEqual(readModelRows('Here is your statement, I think.'),[]);
 assert.deepEqual(readModelRows(''),[]);
 assert.deepEqual(readModelRows('{"rows":"not an array"}'),[]);
 assert.deepEqual(readModelRows('{broken json'),[]);
 const fenced=readModelRows('```json\n{"rows":[{"date":"2026-07-01","description":"A","amount":"5","balance":""}]}\n```');
 assert.equal(fenced.length,1,'a fenced code block is still read');
});

test('commas in figures are normalised but never re-interpreted', () => {
 const rows=readModelRows(JSON.stringify({rows:[{date:'2026-07-01',description:'A',amount:'1,234.56',balance:'2,00,000'}]}));
 assert.equal(rows[0].amount,'1234.56');
 assert.equal(rows[0].balance,'200000');
});

test('an absurd number of rows is capped', () => {
 const many=Array.from({length:900},(_,i)=>({date:'2026-07-01',description:'r'+i,amount:'1',balance:''}));
 assert.ok(readModelRows(JSON.stringify({rows:many})).length<=600);
});

/* ── The instruction we give the model ───────────────────────────────────── */

test('the prompt forbids the model from inventing or correcting anything', () => {
 assert.match(PROMPT,/Never compute, correct, round or infer/);
 assert.match(PROMPT,/rather than guessing/);
 assert.match(PROMPT,/Do not add rows/);
});

test('both providers are wired, and the file is sent as a document, not as text', () => {
 const gemini=providerFor('gemini','m','k','application/pdf','DATA')!;
 assert.match(gemini.url,/generativelanguage/);
 assert.equal(gemini.headers['x-goog-api-key'],'k');
 assert.equal(JSON.stringify(gemini.body).includes('"data":"DATA"'),true);
 const anthropic=providerFor('anthropic','m','k','application/pdf','DATA')!;
 assert.match(anthropic.url,/api\.anthropic\.com/);
 assert.equal(anthropic.headers['x-api-key'],'k');
 assert.match(JSON.stringify(anthropic.body),/"type":"document"/);
 const image=providerFor('anthropic','m','k','image/png','DATA')!;
 assert.match(JSON.stringify(image.body),/"type":"image"/);
 assert.equal(providerFor('something-else','m','k','application/pdf','D'),null);
});

/* ── Upstream behaviour ──────────────────────────────────────────────────── */

/** Builds the shape a Gemini response has, without nesting it inline. */
function geminiReply(text:string){
 return JSON.stringify({candidates:[{content:{parts:[{text}]}}]});
}
const fakeFetch=(body:string,status=200)=>(async ()=>new Response(body,{status})) as typeof fetch;

test('the rows come back labelled as unchecked, and an upstream failure leaks nothing', async () => {
 const realFetch=globalThis.fetch;
 const rows=JSON.stringify({rows:[{date:'2026-07-01',description:'Client payment',amount:'45000',balance:'145000'}]});
 globalThis.fetch=fakeFetch(geminiReply(rows));
 try{
  const response=await post(env,{licence:licence(),mime:'application/pdf',data:FILE});
  assert.equal(response.status,200);
  const body=await response.json() as {rows:unknown[];read:number;note:string};
  assert.equal(body.read,1);
  assert.match(body.note,/nothing here has been checked/);
  assert.match(body.note,/running balance/);
  assert.match(body.note,/Nothing was stored/);
 }finally{globalThis.fetch=realFetch;}

 globalThis.fetch=fakeFetch('upstream said: ACCOUNT 1234 BALANCE 500000',500);
 try{
  const response=await post(env,{licence:licence(),mime:'application/pdf',data:FILE});
  assert.equal(response.status,502);
  const text=await response.text();
  assert.ok(!text.includes('ACCOUNT 1234'),'an upstream body can echo the document and must never be relayed');
  assert.ok(!text.includes('500000'));
 }finally{globalThis.fetch=realFetch;}
});

test('one place cannot feed documents through all day', async () => {
 const store=memoryStore();
 const realFetch=globalThis.fetch;
 globalThis.fetch=fakeFetch(JSON.stringify({candidates:[]}));
 try{
  let limited=0;
  for(let i=0;i<16;i++){
   const response=await handle(new Request('https://api.test/v1/extract',{method:'POST',
    headers:{origin:'https://app.test','content-type':'application/json','cf-connecting-ip':'9.9.9.9'},
    body:JSON.stringify({licence:licence(),mime:'application/pdf',data:FILE})}),env,store);
   if(response.status===429)limited++;
  }
  assert.ok(limited>0);
 }finally{globalThis.fetch=realFetch;}
});
