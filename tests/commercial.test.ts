import test from 'node:test';
import assert from 'node:assert/strict';
import {createSign,generateKeyPairSync,createPrivateKey} from 'node:crypto';
import {checkLicense,trialStatus,limitsFor,planLabel,normalizeKey,importsThisMonth,LIMITS,PUBLIC_KEY_JWK,TRIAL_DAYS} from '../src/license.ts';
import {migrateWorkspace,parseWorkspace,workspaceSchema,blankWorkspace,workspaceV1Schema} from '../src/core.ts';
import {filingPack} from '../src/pack.ts';
import {demo} from '../src/demo.ts';

/* An ephemeral signing key, so these tests never need the publisher's real one. */
const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const pub=publicKey.export({format:'jwk'}) as JsonWebKey;
const priv=createPrivateKey({key:privateKey.export({format:'jwk'}),format:'jwk'});
const b64url=(b:Buffer)=>b.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const issue=(over:Record<string,unknown>={})=>{
 const payload={v:1,id:'11111111-2222-3333-4444-555555555555',name:'Ayesha Khan',plan:'pro',issued:'2026-10-01',expires:'2027-10-01',...over};
 const bytes=Buffer.from(JSON.stringify(payload),'utf8');
 const sig=createSign('SHA256').update(bytes).sign({key:priv,dsaEncoding:'ieee-p1363'});
 return `HSB1.${b64url(bytes)}.${b64url(sig)}`;
};

test('this build ships a licence verification key', () => {
 assert.ok(PUBLIC_KEY_JWK&&PUBLIC_KEY_JWK.kty==='EC','without a public key no key could ever be checked');
});

test('a correctly signed key activates for its plan and term', async () => {
 const s=await checkLicense(issue(),'2026-10-21',pub);
 assert.equal(s.state,'active');
 assert.equal(s.plan,'pro');
 assert.equal(planLabel(s),'Pro');
 assert.equal(limitsFor(s).filingPack,true);
});

test('a key signed by someone else is rejected', async () => {
 const other=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 const s=await checkLicense(issue(),'2026-10-21',other.publicKey.export({format:'jwk'}) as JsonWebKey);
 assert.equal(s.state,'invalid');
 assert.match(s.reason,/signature/i);
});

test('editing the plan inside a key invalidates it', async () => {
 const key=issue();
 const [prefix,payload,sig]=key.split('.');
 const edited=Buffer.from(payload.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8').replace('"pro"','"accountant"');
 const forged=`${prefix}.${b64url(Buffer.from(edited,'utf8'))}.${sig}`;
 const s=await checkLicense(forged,'2026-10-21',pub);
 assert.equal(s.state,'invalid');
});

test('an expired key drops to Free and says so without blaming the customer', async () => {
 const s=await checkLicense(issue({expires:'2026-09-30'}),'2026-10-21',pub);
 assert.equal(s.state,'expired');
 assert.equal(s.plan,'free');
 assert.equal(limitsFor(s).filingPack,false);
 assert.match(s.reason,/records are untouched/i);
});

test('an unknown plan name in a validly signed key is refused rather than assumed', async () => {
 const s=await checkLicense(issue({plan:'enterprise'}),'2026-10-21',pub);
 assert.equal(s.state,'invalid');
 assert.match(s.reason,/plan/i);
});

test('rubbish in the key field is explained, not thrown', async () => {
 for(const bad of ['nonsense','HSB1.a.b','HSB2.x.y','HSB1.only-two-parts']){
  const s=await checkLicense(bad,'2026-10-21',pub);
  assert.equal(s.state,'invalid',bad);
  assert.ok(s.reason.length>10,bad);
 }
 assert.equal((await checkLicense('','2026-10-21',pub)).state,'none');
});

test('keys survive being pasted with spaces and newlines', async () => {
 const key=issue();
 const messy=key.slice(0,20)+' \n '+key.slice(20);
 assert.equal(normalizeKey(messy),key);
 assert.equal((await checkLicense(messy,'2026-10-21',pub)).state,'active');
});

test('the trial runs for its stated length and then stops', () => {
 assert.equal(trialStatus('2026-10-21','2026-10-21').state,'trial');
 const mid=trialStatus('2026-10-21','2026-10-28');
 assert.equal(mid.state,'trial');
 assert.equal(mid.plan,'pro');
 const after=new Date(Date.parse('2026-10-21T00:00:00Z')+TRIAL_DAYS*86400000).toISOString().slice(0,10);
 assert.equal(trialStatus('2026-10-21',after).state,'none','the trial ends the day it runs out');
 assert.equal(trialStatus('','2026-10-21').state,'none');
});

test('free limits are the ones the plan panel promises', () => {
 assert.equal(LIMITS.free.importsPerMonth,1);
 assert.equal(LIMITS.free.accounts,1);
 assert.equal(LIMITS.free.filingPack,false);
 assert.equal(LIMITS.pro.filingPack,true);
 assert.equal(LIMITS.accountant.multiClient,true);
});

test('the monthly import count only counts this calendar month', () => {
 const batches=[{importedAt:'2026-10-02T10:00:00Z'},{importedAt:'2026-10-20T10:00:00Z'},{importedAt:'2026-09-30T10:00:00Z'}];
 assert.equal(importsThisMonth(batches,'2026-10-21'),2);
 assert.equal(importsThisMonth(batches,'2026-11-01'),0);
});

test('a version 1 workspace migrates without losing a single record', () => {
 const v1={...blankWorkspace(),version:1} as Record<string,unknown>;
 delete v1.accounts;delete v1.batches;delete v1.lines;delete v1.license;delete v1.security;delete v1.review;
 const old=workspaceV1Schema.parse(v1);
 const legacy={...old,receipts:demo().receipts,expenses:demo().expenses,invoices:demo().invoices};
 const migrated=parseWorkspace(legacy);
 assert.equal(migrated.version,3);
 assert.equal(migrated.receipts.length,legacy.receipts.length);
 assert.equal(migrated.expenses.length,legacy.expenses.length);
 assert.equal(migrated.invoices.length,legacy.invoices.length);
 assert.deepEqual(migrated.profile,legacy.profile);
 assert.deepEqual(migrated.accounts,[]);
 assert.equal(migrated.license.key,'');
 assert.equal(migrated.security.twoFactor,false,'a migrated workspace is not silently given security settings it never had');
 assert.equal(migrated.review.certificate,'');
});

test('a version 2 workspace gains security and review state, keeping its statements', () => {
 const current=demo();
 const v2={...current,version:2} as Record<string,unknown>;
 delete v2.security;delete v2.review;
 const migrated=parseWorkspace(v2);
 assert.equal(migrated.version,3);
 assert.equal(migrated.lines.length,current.lines.length);
 assert.equal(migrated.accounts.length,current.accounts.length);
 assert.equal(migrated.security.autoLockMinutes,5);
});

test('a current workspace passes through migration untouched', () => {
 const current=demo();
 assert.deepEqual(parseWorkspace(current),workspaceSchema.parse(current));
});

test('a workspace from an unknown future version is refused, not guessed at', () => {
 assert.throws(()=>parseWorkspace({...demo(),version:99}));
 assert.throws(()=>parseWorkspace({version:1,receipts:'not an array'}));
});

test('the filing pack states its rule version, its limits and that it is unreviewed', () => {
 const {data,html}=filingPack(demo(),2027,'Pro');
 assert.equal(data.reviewed,false);
 assert.equal(data.taxYear,2027);
 assert.ok(data.ruleVersion.startsWith('PK-'));
 assert.ok(data.boundaries.some(b=>/not a tax return/i.test(b)));
 assert.ok(data.checklist.length>=8);
 assert.match(html,/Not reviewed/);
 assert.match(html,/What this pack is not/);
 assert.ok(!/<script/i.test(html),'the pack must never carry script');
});

test('the pack prints unresolved items instead of presenting a tidy total', () => {
 const w=demo();
 w.accounts.push({id:crypto.randomUUID(),label:'HBL',kind:'Bank',currency:'PKR',institution:'HBL',reference:'1',
  opening:'0.00',closing:'50000.00',periodStart:'2026-07-01',periodEnd:'2027-06-30',balancesConfirmed:true});
 const {data,html}=filingPack(workspaceSchema.parse(w),2027,'Pro');
 assert.equal(data.readiness.ready,false);
 assert.ok(data.readiness.blockers.some(b=>/does not reconcile/.test(b)));
 assert.match(html,/Resolve these before anyone relies on this pack/);
});

test('text from a statement cannot inject markup into the pack', () => {
 const w=demo();
 w.receipts[0]={...w.receipts[0],client:'<img src=x onerror="alert(1)">',description:'</table><script>bad()</script>'};
 const {html}=filingPack(workspaceSchema.parse(w),2027,'Pro');
 assert.ok(!/<script>bad/.test(html));
 assert.ok(!/onerror="alert/.test(html));
 assert.match(html,/&lt;img src=x/);
});
