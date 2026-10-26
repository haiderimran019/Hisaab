/* The vault's key wrapping.

   This is the one part of Hisaab where a bug destroys data rather than
   displaying it wrongly, so the tests lean on the properties that matter:
   a passphrase always opens a workspace, a passkey never becomes the only way
   in, and nothing re-encrypts the receipts when a key changes.

   WebAuthn cannot run here, which is the reason src/passkey.ts is a separate
   file: everything below works on the 32 bytes a passkey would have returned,
   so the wrapping is genuinely exercised without a browser. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createVault,sealWith,unlock,unlockWithPasskey,addPasskey,removePasskey,
 changePassphrase,passkeySlots,parseEnvelope,envelopeVersion,derive,
 ITERATIONS,toBase64,type EnvelopeV2} from '../src/vault.ts';
import {blankWorkspace,workspaceSchema} from '../src/core.ts';
import {demo} from '../src/demo.ts';

const PASS='correct horse battery staple';
const OTHER='a completely different passphrase';
const prf=()=>crypto.getRandomValues(new Uint8Array(32));
const CRED='Y3JlZGVudGlhbC1pZA==';
const TODAY='2026-10-27';
const raw=(e:unknown)=>JSON.stringify(e);

/** A workspace with real records in it, so a re-wrap is proved not to disturb
    the contents rather than just not to throw. Built once, because demo() mints
    fresh ids on every call and two of them would never compare equal. */
const FILLED=demo();
const filled=()=>structuredClone(FILLED);

/* ── The basics ──────────────────────────────────────────────────────────── */

test('a new workspace is sealed under a random key, wrapped by the passphrase', async () => {
 const {envelope,dek}=await createVault(filled(),PASS);
 assert.equal(envelope.format,'hisaab-aesgcm-v2');
 assert.equal(dek.length,32);
 assert.equal(envelope.unlockers.length,1);
 assert.equal(envelope.unlockers[0].kind,'passphrase');
 assert.equal((envelope.unlockers[0] as {iterations:number}).iterations,ITERATIONS);

 const opened=await unlock(raw(envelope),PASS);
 assert.deepEqual(opened.workspace,filled());
 assert.deepEqual([...opened.dek],[...dek]);
 assert.equal(opened.migrated,false);
});

test('two workspaces with the same passphrase share no key material', async () => {
 const a=await createVault(blankWorkspace(),PASS);
 const b=await createVault(blankWorkspace(),PASS);
 assert.notDeepEqual([...a.dek],[...b.dek],'the data key is random, not derived');
 const saltOf=(e:EnvelopeV2)=>(e.unlockers[0] as {salt:string}).salt;
 assert.notEqual(saltOf(a.envelope),saltOf(b.envelope),'and so is the salt');
 assert.notEqual(a.envelope.ciphertext,b.envelope.ciphertext);
});

test('a wrong passphrase is refused, and says nothing about why', async () => {
 const {envelope}=await createVault(filled(),PASS);
 await assert.rejects(()=>unlock(raw(envelope),OTHER),/Incorrect passphrase or damaged backup/);
 // A damaged file gives the identical message: which it is, is not a caller's business.
 const damaged={...envelope,ciphertext:envelope.ciphertext.slice(0,-8)+'AAAAAAAA'};
 await assert.rejects(()=>unlock(raw(damaged),PASS),/Incorrect passphrase or damaged backup/);
});

test('a short passphrase is refused before anything is encrypted', async () => {
 await assert.rejects(()=>createVault(blankWorkspace(),'short'),/12–256 characters/);
 await assert.rejects(()=>createVault(blankWorkspace(),'x'.repeat(257)),/12–256 characters/);
});

/* ── Passkeys ────────────────────────────────────────────────────────────── */

test('a passkey opens the same workspace as the passphrase, and neither disturbs the other', async () => {
 const {envelope,dek}=await createVault(filled(),PASS);
 const material=prf();
 const unlockers=await addPasskey(envelope.unlockers,dek,CRED,material,'iPhone',TODAY);
 const saved=await sealWith(filled(),dek,unlockers);

 const byPasskey=await unlockWithPasskey(raw(saved),CRED,material);
 assert.deepEqual(byPasskey.workspace,filled());
 assert.deepEqual([...byPasskey.dek],[...dek]);

 const byPassphrase=await unlock(raw(saved),PASS);
 assert.deepEqual([...byPassphrase.dek],[...dek],'both doors open onto the same key');
});

test('a different passkey, or the wrong credential, does not open it', async () => {
 const {envelope,dek}=await createVault(filled(),PASS);
 const material=prf();
 const saved=await sealWith(filled(),dek,
  await addPasskey(envelope.unlockers,dek,CRED,material,'iPhone',TODAY));

 await assert.rejects(()=>unlockWithPasskey(raw(saved),CRED,prf()),
  /did not unlock this workspace. Use your passphrase/);
 await assert.rejects(()=>unlockWithPasskey(raw(saved),'b3RoZXI=',material),
  /not registered for this workspace. Use your passphrase/);
 // Every refusal points at the passphrase, because the data is not gone.
 await assert.rejects(()=>unlockWithPasskey(raw(saved),CRED,prf()),/passphrase/);
});

test('short key material is refused rather than stretched into a key', async () => {
 const {envelope,dek}=await createVault(blankWorkspace(),PASS);
 await assert.rejects(()=>addPasskey(envelope.unlockers,dek,CRED,new Uint8Array(16),'x',TODAY),
  /did not return enough key material/);
});

test('several devices can be registered, and each opens it alone', async () => {
 const {envelope,dek}=await createVault(filled(),PASS);
 let unlockers=envelope.unlockers;
 const devices=[['aXBob25l','iPhone'],['bWFj','Mac'],['YW5kcm9pZA==','Android device']] as const;
 const material=new Map<string,Uint8Array>();
 for(const [id,label] of devices){
  const bytes=prf();
  material.set(id,bytes);
  unlockers=await addPasskey(unlockers,dek,id,bytes,label,TODAY);
 }
 const saved=await sealWith(filled(),dek,unlockers);
 assert.equal(passkeySlots(saved.unlockers).length,3);
 assert.deepEqual(passkeySlots(saved.unlockers).map(s=>s.label),['iPhone','Mac','Android device']);

 for(const [id] of devices){
  const opened=await unlockWithPasskey(raw(saved),id,material.get(id)!);
  assert.deepEqual([...opened.dek],[...dek],id);
 }
});

test('re-registering the same device replaces its slot instead of piling up', async () => {
 const {envelope,dek}=await createVault(blankWorkspace(),PASS);
 const first=prf(),second=prf();
 let unlockers=await addPasskey(envelope.unlockers,dek,CRED,first,'iPhone',TODAY);
 unlockers=await addPasskey(unlockers,dek,CRED,second,'iPhone',TODAY);
 assert.equal(passkeySlots(unlockers).length,1);
 const saved=await sealWith(blankWorkspace(),dek,unlockers);
 await assert.rejects(()=>unlockWithPasskey(raw(saved),CRED,first),/did not unlock/);
 assert.ok(await unlockWithPasskey(raw(saved),CRED,second));
});

test('there is a ceiling on registered passkeys', async () => {
 const {envelope,dek}=await createVault(blankWorkspace(),PASS);
 let unlockers=envelope.unlockers;
 for(let i=0;i<10;i++)unlockers=await addPasskey(unlockers,dek,`ZGV2${i}`,prf(),`Device ${i}`,TODAY);
 await assert.rejects(()=>addPasskey(unlockers,dek,'b25lbW9yZQ==',prf(),'One more',TODAY),
  /as many passkeys as one workspace holds/);
});

/* ── The property that matters most ──────────────────────────────────────── */

test('the passphrase can never be taken away, so a lost device is not a lost workspace', async () => {
 const {envelope,dek}=await createVault(filled(),PASS);
 const unlockers=await addPasskey(envelope.unlockers,dek,CRED,prf(),'iPhone',TODAY);

 // Removing the passkey is allowed, and leaves the passphrase.
 const after=removePasskey(unlockers,CRED);
 assert.equal(passkeySlots(after).length,0);
 assert.ok(await unlock(raw(await sealWith(filled(),dek,after)),PASS));

 // Removing the passphrase is not allowed, at any layer.
 const passkeyOnly=unlockers.filter(u=>u.kind==='passkey');
 await assert.rejects(()=>sealWith(filled(),dek,passkeyOnly),
  /must always keep its passphrase/);
 // And an envelope hand-edited to drop it is treated as damaged, not loaded.
 const forged={...await sealWith(filled(),dek,unlockers),unlockers:passkeyOnly};
 assert.throws(()=>parseEnvelope(raw(forged)),
  /no passphrase and could not be opened on another device/);
});

test('removing a passkey that was never registered is an error, not a silent no-op', async () => {
 const {envelope}=await createVault(blankWorkspace(),PASS);
 assert.throws(()=>removePasskey(envelope.unlockers,CRED),/not registered for this workspace/);
});

/* ── Changing a passphrase ───────────────────────────────────────────────── */

test('changing the passphrase re-wraps the key without re-encrypting the records', async () => {
 const {envelope,dek}=await createVault(filled(),PASS);
 const material=prf();
 const withKey=await addPasskey(envelope.unlockers,dek,CRED,material,'iPhone',TODAY);
 const before=await sealWith(filled(),dek,withKey);

 const changed=await changePassphrase(before.unlockers,dek,OTHER);
 const after:EnvelopeV2={...before,unlockers:changed};

 // The body is untouched — that is the whole point of the indirection.
 assert.equal(after.ciphertext,before.ciphertext);
 assert.equal(after.iv,before.iv);

 await assert.rejects(()=>unlock(raw(after),PASS),/Incorrect passphrase/);
 const opened=await unlock(raw(after),OTHER);
 assert.deepEqual([...opened.dek],[...dek]);
 assert.deepEqual(opened.workspace,filled());
 // And the registered passkey still works, because it never wrapped a passphrase.
 assert.ok(await unlockWithPasskey(raw(after),CRED,material));
 assert.equal(passkeySlots(after.unlockers).length,1);
});

test('a new passphrase is checked before it replaces the old one', async () => {
 const {envelope,dek}=await createVault(blankWorkspace(),PASS);
 await assert.rejects(()=>changePassphrase(envelope.unlockers,dek,'tooshort'),/12–256 characters/);
 assert.ok(await unlock(raw(envelope),PASS),'the old passphrase still works');
});

/* ── Reading what older builds wrote ─────────────────────────────────────── */

/** Builds a v1 envelope the way the previous release did: the AES key derived
    straight from the passphrase, with no wrapping layer at all. */
async function v1Envelope(passphrase:string){
 const workspace=filled();
 const salt=crypto.getRandomValues(new Uint8Array(16));
 const key=await derive(passphrase,salt);
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const sealed=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,
  new TextEncoder().encode(JSON.stringify(workspace)));
 return {format:'hisaab-aesgcm-v1',iterations:ITERATIONS,salt:toBase64(salt),
  iv:toBase64(iv),ciphertext:toBase64(new Uint8Array(sealed))};
}

test('a workspace from the previous release opens, and is migrated as it opens', async () => {
 const old=await v1Envelope(PASS);
 assert.equal(envelopeVersion(parseEnvelope(raw(old))),1);

 const opened=await unlock(raw(old),PASS);
 assert.deepEqual(opened.workspace,filled());
 assert.equal(opened.migrated,true,'the caller is told to save, which writes v2');
 assert.equal(opened.unlockers.length,1);
 assert.equal(opened.unlockers[0].kind,'passphrase');

 // Saving it produces a v2 envelope that opens with the same passphrase.
 const migrated=await sealWith(opened.workspace,opened.dek,opened.unlockers);
 assert.equal(envelopeVersion(migrated),2);
 assert.deepEqual((await unlock(raw(migrated),PASS)).workspace,filled());

 // The old file still works if that save never happened. Nothing is stranded.
 assert.ok(await unlock(raw(old),PASS));
});

test('a v1 backup with the wrong passphrase fails the same way a v2 one does', async () => {
 const old=await v1Envelope(PASS);
 await assert.rejects(()=>unlock(raw(old),OTHER),/Incorrect passphrase or damaged backup/);
});

test('a passkey cannot be used on a workspace that has not been migrated yet', async () => {
 const old=await v1Envelope(PASS);
 await assert.rejects(()=>unlockWithPasskey(raw(old),CRED,prf()),
  /Unlock it with your passphrase once first/);
});

/* ── What the parser refuses ─────────────────────────────────────────────── */

test('a tampered or nonsensical envelope is refused by the parser', async () => {
 const {envelope,dek}=await createVault(filled(),PASS);
 const good=await sealWith(filled(),dek,
  await addPasskey(envelope.unlockers,dek,CRED,prf(),'iPhone',TODAY));

 assert.throws(()=>parseEnvelope('not json'));
 assert.throws(()=>parseEnvelope(raw({...good,format:'hisaab-aesgcm-v3'})));
 // An empty list is refused by the shape before the passphrase rule is reached;
 // the passphrase-specific message is asserted where a passkey-only list is used.
 assert.throws(()=>parseEnvelope(raw({...good,unlockers:[]})));
 assert.throws(()=>parseEnvelope(raw({...good,extra:'field'})),'an unknown field is refused');

 // A lowered iteration count would weaken the passphrase, so the schema pins it.
 const weakened={...good,unlockers:good.unlockers.map(u=>
  u.kind==='passphrase'?{...u,iterations:1000}:u)};
 assert.throws(()=>parseEnvelope(raw(weakened)));

 // Truncated key material cannot be unwrapped, so it is refused up front.
 const truncated={...good,unlockers:good.unlockers.map(u=>
  u.kind==='passphrase'?{...u,wrapped:u.wrapped.slice(0,60)}:u)};
 assert.throws(()=>parseEnvelope(raw(truncated)));

 assert.throws(()=>parseEnvelope('{"format":"hisaab-aesgcm-v2"}'));
 assert.throws(()=>parseEnvelope(raw(good)+' '.repeat(9_000_000)),/too large/);
});

test('a workspace that fails validation is never written, encrypted or not', async () => {
 const {dek,envelope}=await createVault(blankWorkspace(),PASS);
 const nonsense={...blankWorkspace(),receipts:[{gross:'not a number'}]} as never;
 await assert.rejects(()=>sealWith(nonsense,dek,envelope.unlockers));
 await assert.rejects(()=>createVault(nonsense,PASS));
});

test('a workspace bigger than the storage ceiling is refused with a way out', async () => {
 const {dek,envelope}=await createVault(blankWorkspace(),PASS);
 // A scanned receipt is what actually fills a workspace, so that is what this
 // uses — the message has to name the cause people will really hit.
 const base=filled();
 const scan=(n:number)=>({...base.expenses[0],id:crypto.randomUUID(),
  receipt:{name:`big-scan-${n}.png`,mime:'image/png' as const,
   data:'data:image/png;base64,'+'A'.repeat(1_600_000)}});
 const huge=workspaceSchema.parse({...base,expenses:[scan(1),scan(2)]});
 await assert.rejects(()=>sealWith(huge,dek,envelope.unlockers),/Export a backup/);
});
