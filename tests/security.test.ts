import test from 'node:test';
import assert from 'node:assert/strict';
import {createSign,generateKeyPairSync,createPrivateKey} from 'node:crypto';
import {randomSecret,base32Encode,base32Decode,totpCode,verifyCode,otpauthUri,formatSecret,
 makeRecoveryCodes,hashRecovery,normalizeRecovery,STEP_SECONDS,secondsRemaining,RECOVERY_COUNT} from '../src/totp.ts';
import {checkReview,packDigest,packDigestInput,CERT_PREFIX,type Reviewer} from '../src/review.ts';
import {filingPack} from '../src/pack.ts';
import {demo} from '../src/demo.ts';
import {workspaceSchema} from '../src/core.ts';

/* ── Authenticator codes ─────────────────────────────────────────────────── */

test('base32 round-trips, including lengths that need padding', () => {
 for(const length of [1,2,3,5,10,20]){
  const bytes=crypto.getRandomValues(new Uint8Array(length));
  assert.deepEqual([...base32Decode(base32Encode(bytes))],[...bytes],`length ${length}`);
 }
});

test('a secret is rejected when it is not valid base32', () => {
 assert.throws(()=>base32Decode('not-base32-0189'),/valid authenticator secret/);
 assert.throws(()=>base32Decode(''),/valid authenticator secret/);
});

test('RFC 6238 test vector: the standard secret gives the published code', async () => {
 // RFC 6238 appendix B uses ASCII "12345678901234567890" as the SHA-1 seed.
 const secret=base32Encode(new TextEncoder().encode('12345678901234567890'));
 assert.equal(await totpCode(secret,59_000),'287082');
 assert.equal(await totpCode(secret,1111111109_000),'081804');
 assert.equal(await totpCode(secret,1234567890_000),'005924');
});

test('a code is accepted one step either side, and refused beyond that', async () => {
 const secret=randomSecret();
 const now=1_700_000_000_000;
 const code=await totpCode(secret,now);
 assert.equal(await verifyCode(secret,code,now),true);
 assert.equal(await verifyCode(secret,code,now+STEP_SECONDS*1000),true,'a code that just expired still works once');
 assert.equal(await verifyCode(secret,code,now-STEP_SECONDS*1000),true,'a slightly fast clock works');
 assert.equal(await verifyCode(secret,code,now+STEP_SECONDS*3000),false,'an old code stops working');
});

test('malformed codes are refused without throwing', async () => {
 const secret=randomSecret();
 for(const bad of ['','12345','1234567','abcdef','12 34 56 78']){
  assert.equal(await verifyCode(secret,bad,Date.now()),false,bad);
 }
});

test('spaces in a typed code are tolerated', async () => {
 const secret=randomSecret(),now=Date.now();
 const code=await totpCode(secret,now);
 assert.equal(await verifyCode(secret,`${code.slice(0,3)} ${code.slice(3)}`,now),true);
});

test('the otpauth link carries what an authenticator app needs', () => {
 const secret=randomSecret();
 const uri=otpauthUri(secret,'Ayesha Khan');
 assert.match(uri,/^otpauth:\/\/totp\/Hisaab:/);
 assert.match(uri,new RegExp(`secret=${secret}`));
 assert.match(uri,/issuer=Hisaab/);
 assert.match(uri,/digits=6/);
 assert.match(uri,/period=30/);
 assert.ok(!uri.includes(' '),'spaces in a label would break the link');
});

test('the secret is shown in readable groups without changing its value', () => {
 const secret=randomSecret();
 assert.equal(formatSecret(secret).replace(/\s/g,''),secret);
});

test('the countdown stays inside the step', () => {
 for(const at of [0,1_000,29_000,30_000,1_700_000_123_456]){
  const left=secondsRemaining(at);
  assert.ok(left>0&&left<=STEP_SECONDS,`${at} → ${left}`);
 }
});

test('recovery codes are unique, and stored only as hashes', async () => {
 const codes=makeRecoveryCodes();
 assert.equal(codes.length,RECOVERY_COUNT);
 assert.equal(new Set(codes).size,RECOVERY_COUNT);
 const hashes=await Promise.all(codes.map(hashRecovery));
 assert.equal(new Set(hashes).size,RECOVERY_COUNT);
 for(const hash of hashes)assert.match(hash,/^[0-9a-f]{64}$/);
 for(const code of codes)assert.ok(!hashes.includes(code),'a code must never be stored as itself');
});

test('a recovery code matches however it was typed', async () => {
 const [code]=makeRecoveryCodes(1);
 const stored=await hashRecovery(code);
 assert.equal(await hashRecovery(code.toLowerCase()),stored);
 assert.equal(await hashRecovery(code.replace('-',' ')),stored);
 assert.equal(await hashRecovery(code.replace('-','')),stored);
 assert.notEqual(await hashRecovery(code.slice(0,-1)+'X'),stored);
 assert.equal(normalizeRecovery(' ab-cd '),'ABCD');
});

/* ── Practitioner review certificates ────────────────────────────────────── */

const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const reviewer:Reviewer={id:'test-reviewer',name:'Nadeem Akhtar, ACA',registration:'ICAP R-12345',
 publicKey:publicKey.export({format:'jwk'}) as JsonWebKey};
const priv=createPrivateKey({key:privateKey.export({format:'jwk'}),format:'jwk'});
const b64url=(b:Buffer)=>b.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const certify=async (w:ReturnType<typeof demo>,year:number,over:Record<string,unknown>={})=>{
 const payload={v:1,reviewer:reviewer.id,name:reviewer.name,registration:reviewer.registration,
  taxYear:year,digest:await packDigest(w,year),reviewedOn:'2026-10-21',note:'',...over};
 const bytes=Buffer.from(JSON.stringify(payload),'utf8');
 const sig=createSign('SHA256').update(bytes).sign({key:priv,dsaEncoding:'ieee-p1363'});
 return `${CERT_PREFIX}.${b64url(bytes)}.${b64url(sig)}`;
};

test('no reviewer is published with this release, so no tick can be shown', async () => {
 const {REVIEWERS}=await import('../src/review.ts');
 assert.deepEqual(REVIEWERS,[],'a tick must not be possible until a real practitioner is engaged');
});

test('a certificate from a published reviewer verifies against the exact pack', async () => {
 const w=demo();
 const status=await checkReview(await certify(w,2027),w,2027,[reviewer]);
 assert.equal(status.state,'verified');
 assert.equal(status.payload.registration,'ICAP R-12345');
});

test('changing one figure turns the tick amber instead of leaving it green', async () => {
 const w=demo();
 const cert=await certify(w,2027);
 assert.equal((await checkReview(cert,w,2027,[reviewer])).state,'verified');
 const edited=workspaceSchema.parse({...w,receipts:[{...w.receipts[0],gross:'9999'},...w.receipts.slice(1)]});
 const after=await checkReview(cert,edited,2027,[reviewer]);
 assert.equal(after.state,'stale');
 assert.match(after.reason,/records have changed/);
});

test('changing a statement line also invalidates the review', async () => {
 const w=demo();
 const cert=await certify(w,2027);
 const edited=workspaceSchema.parse({...w,lines:[{...w.lines[0],status:'excluded',linkedId:''},...w.lines.slice(1)]});
 assert.equal((await checkReview(cert,edited,2027,[reviewer])).state,'stale');
});

test('a certificate for another tax year does not tick this one', async () => {
 const w=demo();
 const cert=await certify(w,2027,{taxYear:2026,digest:await packDigest(w,2026)});
 const status=await checkReview(cert,w,2027,[reviewer]);
 assert.equal(status.state,'stale');
 assert.match(status.reason,/tax year 2026/);
});

test('a reviewer this release does not publish is refused', async () => {
 const w=demo();
 const cert=await certify(w,2027,{reviewer:'someone-else'});
 const status=await checkReview(cert,w,2027,[reviewer]);
 assert.equal(status.state,'invalid');
 assert.match(status.reason,/does not recognise the reviewer/);
});

test('a certificate signed with the wrong key is refused', async () => {
 const w=demo();
 const other=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 const status=await checkReview(await certify(w,2027),w,2027,
  [{...reviewer,publicKey:other.publicKey.export({format:'jwk'}) as JsonWebKey}]);
 assert.equal(status.state,'invalid');
 assert.match(status.reason,/signature/);
});

test('rubbish in the certificate field is explained, not thrown', async () => {
 const w=demo();
 for(const bad of ['nonsense','HSBREV1.a.b','HSB1.x.y']){
  const status=await checkReview(bad,w,2027,[reviewer]);
  assert.equal(status.state,'invalid',bad);
 }
 assert.equal((await checkReview('',w,2027,[reviewer])).state,'none');
});

test('the fingerprint covers every figure, declaration and the name on the pack', async () => {
 const w=demo();
 const before=await packDigest(w,2027);
 // A review is signed for a named person's figures, so the name is in scope too.
 assert.notEqual(await packDigest({...w,profile:{...w.profile,name:'Someone Else'}},2027),before);
 assert.notEqual(await packDigest({...w,profile:{...w.profile,pseb:!w.profile.pseb}},2027),before,
  'a declaration that changes the rate must change the fingerprint');
 assert.equal(await packDigest(structuredClone(w),2027),before,'an identical workspace fingerprints the same');
 // Record order must not matter: a reviewer signs the content, not the array order.
 assert.equal(await packDigest({...w,receipts:[...w.receipts].reverse()},2027),before);
 assert.ok(packDigestInput(w,2027).length>100);
});

test('a reviewed pack says who reviewed it, and an unreviewed one says it is not reviewed', async () => {
 const w=demo();
 const status=await checkReview(await certify(w,2027),w,2027,[reviewer]);
 const reviewed=filingPack(w,2027,'Pro',{digest:await packDigest(w,2027),review:status});
 assert.equal(reviewed.data.reviewed,true);
 assert.equal(reviewed.data.review?.registration,'ICAP R-12345');
 assert.match(reviewed.html,/Reviewed by a practitioner/);
 assert.match(reviewed.html,/not an FBR approval|not a guarantee/);

 const plain=filingPack(w,2027,'Pro');
 assert.equal(plain.data.reviewed,false);
 assert.match(plain.html,/Not reviewed/);
});

test('the pack carries a fingerprint a reviewer can sign', async () => {
 const w=demo();
 const digest=await packDigest(w,2027);
 const {data}=filingPack(w,2027,'Pro',{digest});
 assert.match(data.digest,/^[0-9a-f]{64}$/);
 assert.equal(data.digest,digest);
});
