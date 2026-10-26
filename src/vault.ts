/* The encrypted workspace — and why its shape changed.

   In v1 the AES key *was* the passphrase, stretched through PBKDF2. That is
   sound, and it is also why nothing else could ever unlock a workspace: there
   was one key and one way to arrive at it. Adding a passkey, or ever changing a
   passphrase without re-encrypting megabytes of receipts, needs one step of
   indirection.

   v2 therefore has two layers:

     the workspace  --AES-GCM-->  ciphertext, under a random 32-byte DEK
     the DEK        --AES-GCM-->  wrapped once per "unlocker"

   An unlocker is a way of arriving at a key-encryption key. There are two:

     passphrase  PBKDF2-SHA-256, 600,000 iterations, per-vault salt
     passkey     HKDF-SHA-256 over the WebAuthn PRF output for this credential

   **The passphrase unlocker can never be removed.** A passkey lives in one
   device's secure element; if it were the only way in, a dropped phone would
   destroy the only copy of someone's books. Every function here that touches
   the unlocker list enforces that, and the tests assert it. A passkey makes
   unlocking quicker — it is never the last door.

   What this does not do: it does not make the encryption stronger. A passkey is
   one more lock on the same door, and the passphrase is still the thing a
   determined attacker would go for. The security panel says so too.

   v1 envelopes still open, here and from a backup file, and are migrated to v2
   the first time they are unlocked. Nothing asks the customer to do anything. */
import { z } from 'zod';
import { workspaceSchema, parseWorkspace, type Workspace } from './core';

/** Unchanged: the localStorage key is a location, not a format. The envelope
    stored there declares its own version, so an old browser tab and a new one
    cannot disagree about what they are looking at. */
export const VAULT_KEY='hisaab.encrypted.v1';
export const MAX_BACKUP=8_000_000;
export const ITERATIONS=600000 as const;
/** Domain separation for HKDF, so a PRF output can only ever yield this key. */
const PRF_INFO='hisaab-vault-passkey-v2';

const b64=(b:Uint8Array)=>{let s='';for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode(...b.subarray(i,i+8192));return btoa(s);};
const un64=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export {b64 as toBase64, un64 as fromBase64};

/* ── The envelope ────────────────────────────────────────────────────────── */

const v1Schema=z.object({format:z.literal('hisaab-aesgcm-v1'),iterations:z.literal(ITERATIONS),
 salt:z.string().length(24),iv:z.string().length(16),
 ciphertext:z.string().min(20).max(7500000)}).strict();

/* A wrapped DEK is 32 bytes of key plus a 16-byte GCM tag: exactly 64 base64
   characters. Pinning the length means a truncated or padded envelope is
   refused by the parser rather than failing somewhere less obvious. */
const WRAPPED=z.string().length(64);

const passphraseUnlocker=z.object({kind:z.literal('passphrase'),
 salt:z.string().length(24),iterations:z.literal(ITERATIONS),
 iv:z.string().length(16),wrapped:WRAPPED}).strict();

const passkeyUnlocker=z.object({kind:z.literal('passkey'),
 credentialId:z.string().min(4).max(1024),
 /** Per-credential PRF input. Random, stored in the clear: it is a salt. */
 prfSalt:z.string().length(44),
 iv:z.string().length(16),wrapped:WRAPPED,
 /** Shown in the security panel so a device can be recognised and removed. */
 label:z.string().max(60),addedOn:z.string().max(10)}).strict();

const v2Schema=z.object({format:z.literal('hisaab-aesgcm-v2'),
 iv:z.string().length(16),ciphertext:z.string().min(20).max(7500000),
 unlockers:z.array(z.discriminatedUnion('kind',[passphraseUnlocker,passkeyUnlocker]))
  .min(1).max(11)}).strict();

const envelopeSchema=z.discriminatedUnion('format',[v1Schema,v2Schema]);

export type EnvelopeV1=z.infer<typeof v1Schema>;
export type EnvelopeV2=z.infer<typeof v2Schema>;
export type Envelope=EnvelopeV1|EnvelopeV2;
export type PasskeyUnlocker=z.infer<typeof passkeyUnlocker>;

export function parseEnvelope(raw:string):Envelope{
 if(raw.length>MAX_BACKUP)throw Error('Backup is too large');
 const e=envelopeSchema.parse(JSON.parse(raw));
 if(un64(e.iv).length!==12)throw Error('Invalid backup parameters');
 un64(e.ciphertext);
 if(e.format==='hisaab-aesgcm-v1'){
  if(un64(e.salt).length!==16)throw Error('Invalid backup parameters');
  return e;
 }
 // A v2 envelope with no passphrase unlocker could not be opened on a new
 // device, so treat one as damaged rather than loading it and finding out later.
 if(!e.unlockers.some(u=>u.kind==='passphrase'))
  throw Error('This backup has no passphrase and could not be opened on another device.');
 for(const u of e.unlockers){
  if(un64(u.iv).length!==12||un64(u.wrapped).length!==48)throw Error('Invalid backup parameters');
  if(u.kind==='passphrase'&&un64(u.salt).length!==16)throw Error('Invalid backup parameters');
  if(u.kind==='passkey'&&un64(u.prfSalt).length!==32)throw Error('Invalid backup parameters');
 }
 return e;
}

/* ── Keys ────────────────────────────────────────────────────────────────── */

/** The passphrase-derived key-encryption key. The iteration count is pinned by
    the schema, so an envelope cannot ask us to stretch a passphrase less. */
export async function derive(passphrase:string,salt:Uint8Array){
 if(passphrase.length<12||passphrase.length>256)throw Error('Use a passphrase of 12–256 characters');
 const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(passphrase),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:salt as BufferSource,iterations:ITERATIONS},
  material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}

/** The passkey-derived key-encryption key. The PRF output is already uniform
    32 bytes; HKDF is here for domain separation, so the same authenticator used
    by something else could never produce this key. */
async function derivePasskeyKey(prf:Uint8Array,prfSalt:Uint8Array){
 if(prf.length<32)throw Error('That passkey did not return enough key material.');
 const material=await crypto.subtle.importKey('raw',prf as BufferSource,'HKDF',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:prfSalt as BufferSource,
  info:new TextEncoder().encode(PRF_INFO)},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}

/** The data-encryption key, as raw bytes.

    Raw rather than a non-extractable CryptoKey on purpose: adding a passkey
    later means wrapping this same key again, so it has to be readable while the
    workspace is open. It lives in memory only while unlocked, which is exactly
    as long as the decrypted workspace does, so it widens nothing. */
export type Dek=Uint8Array;
const dekKey=(dek:Dek)=>crypto.subtle.importKey('raw',dek as BufferSource,'AES-GCM',false,['encrypt','decrypt']);

async function wrap(dek:Dek,kek:CryptoKey){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const sealed=await crypto.subtle.encrypt({name:'AES-GCM',iv},kek,dek as BufferSource);
 return {iv:b64(iv),wrapped:b64(new Uint8Array(sealed))};
}

async function unwrap(u:{iv:string;wrapped:string},kek:CryptoKey,wrongKey:string):Promise<Dek>{
 try{
  const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(u.iv)},kek,un64(u.wrapped));
  return new Uint8Array(raw);
 }catch{throw Error(wrongKey);}
}

/* ── Sealing ─────────────────────────────────────────────────────────────── */

/** Encrypts the workspace under the DEK, keeping the unlockers as they are.
    This is what every save goes through, and it never re-derives anything from
    a passphrase — which is why saving is instant however slow PBKDF2 is. */
export async function sealWith(w:Workspace,dek:Dek,unlockers:EnvelopeV2['unlockers']):Promise<EnvelopeV2>{
 workspaceSchema.parse(w);
 if(!unlockers.some(u=>u.kind==='passphrase'))
  throw Error('A workspace must always keep its passphrase.');
 const plaintext=new TextEncoder().encode(JSON.stringify(w));
 if(plaintext.length>3_000_000)throw Error('Workspace exceeds 3 MB. Export a backup and remove large receipt attachments.');
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const result=await crypto.subtle.encrypt({name:'AES-GCM',iv},await dekKey(dek),plaintext as BufferSource);
 return {format:'hisaab-aesgcm-v2',iv:b64(iv),ciphertext:b64(new Uint8Array(result)),unlockers};
}

/** A brand-new workspace: a random DEK, wrapped under the passphrase alone.
    A passkey can be added afterwards; it is never the only way in. */
export async function createVault(w:Workspace,passphrase:string){
 const dek=crypto.getRandomValues(new Uint8Array(32));
 const salt=crypto.getRandomValues(new Uint8Array(16));
 const kek=await derive(passphrase,salt);
 const unlockers:EnvelopeV2['unlockers']=[
  {kind:'passphrase',salt:b64(salt),iterations:ITERATIONS,...await wrap(dek,kek)}];
 return {envelope:await sealWith(w,dek,unlockers),dek};
}

/* ── Unlocking ───────────────────────────────────────────────────────────── */

export type Unlocked={workspace:Workspace;dek:Dek;unlockers:EnvelopeV2['unlockers'];
 /** True when a v1 envelope was just read. The caller must save, which writes
     it back as v2. Nothing is lost if that save never happens — the v1
     envelope on disk still opens with the same passphrase. */
 migrated:boolean};

const WRONG='Incorrect passphrase or damaged backup. Try again.';

/** Opens an envelope of either version with a passphrase, migrating v1 as it
    goes. The error message is the same for a wrong passphrase and a damaged
    file on purpose: the difference is not something a caller should learn. */
export async function unlock(raw:string,passphrase:string):Promise<Unlocked>{
 const e=parseEnvelope(raw);

 if(e.format==='hisaab-aesgcm-v1'){
  const salt=un64(e.salt);
  const key=await derive(passphrase,salt);
  let plain:ArrayBuffer;
  try{plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(e.iv)},key,un64(e.ciphertext));}
  catch{throw Error(WRONG);}
  const workspace=parseWorkspace(JSON.parse(new TextDecoder().decode(plain)));
  // Migrate: a fresh DEK, wrapped under the same passphrase with a fresh salt.
  const dek=crypto.getRandomValues(new Uint8Array(32));
  const newSalt=crypto.getRandomValues(new Uint8Array(16));
  const unlockers:EnvelopeV2['unlockers']=[{kind:'passphrase',salt:b64(newSalt),
   iterations:ITERATIONS,...await wrap(dek,await derive(passphrase,newSalt))}];
  return {workspace,dek,unlockers,migrated:true};
 }

 const slot=e.unlockers.find(u=>u.kind==='passphrase')!;
 const dek=await unwrap(slot,await derive(passphrase,un64(slot.salt)),WRONG);
 return {...await open(e,dek),migrated:false};
}

/** Opens an envelope with a passkey's PRF output. Only ever a shortcut: a
    workspace that has no matching passkey slot still opens with its passphrase,
    and the message says so rather than implying the data is gone. */
export async function unlockWithPasskey(raw:string,credentialId:string,prf:Uint8Array):Promise<Unlocked>{
 const e=parseEnvelope(raw);
 if(e.format!=='hisaab-aesgcm-v2')
  throw Error('This workspace has not been opened since passkeys were added. Unlock it with your passphrase once first.');
 const slot=e.unlockers.find(u=>u.kind==='passkey'&&u.credentialId===credentialId);
 if(!slot)throw Error('That passkey is not registered for this workspace. Use your passphrase.');
 const dek=await unwrap(slot as PasskeyUnlocker,
  await derivePasskeyKey(prf,un64((slot as PasskeyUnlocker).prfSalt)),
  'That passkey did not unlock this workspace. Use your passphrase.');
 return {...await open(e,dek),migrated:false};
}

async function open(e:EnvelopeV2,dek:Dek){
 let plain:ArrayBuffer;
 try{plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(e.iv)},await dekKey(dek),un64(e.ciphertext));}
 catch{throw Error(WRONG);}
 return {workspace:parseWorkspace(JSON.parse(new TextDecoder().decode(plain))),dek,unlockers:e.unlockers};
}

/* ── Managing the ways in ────────────────────────────────────────────────── */

/** Wraps the open workspace's DEK under a new passkey. Needs the workspace
    already unlocked, so registering a passkey always requires the passphrase
    first — somebody who finds an unattended unlocked screen is the only other
    way, and that is what auto-lock is for. */
export async function addPasskey(unlockers:EnvelopeV2['unlockers'],dek:Dek,
 credentialId:string,prf:Uint8Array,label:string,addedOn:string):Promise<EnvelopeV2['unlockers']>{
 if(unlockers.filter(u=>u.kind==='passkey').length>=10)
  throw Error('That is as many passkeys as one workspace holds. Remove one first.');
 const prfSalt=crypto.getRandomValues(new Uint8Array(32));
 const slot:PasskeyUnlocker={kind:'passkey',credentialId,prfSalt:b64(prfSalt),
  label:label.slice(0,60),addedOn,
  ...await wrap(dek,await derivePasskeyKey(prf,prfSalt))};
 // Re-registering the same credential replaces its slot rather than adding a
 // second one, so a key re-enrolled after a browser reset does not pile up.
 return [...unlockers.filter(u=>!(u.kind==='passkey'&&u.credentialId===credentialId)),slot];
}

/** Removing a passkey is always safe, because the passphrase is still there. */
export function removePasskey(unlockers:EnvelopeV2['unlockers'],credentialId:string){
 const next=unlockers.filter(u=>!(u.kind==='passkey'&&u.credentialId===credentialId));
 if(next.length===unlockers.length)throw Error('That passkey is not registered for this workspace.');
 return next;
}

/** Changes the passphrase by re-wrapping the DEK — the receipts are not
    re-encrypted, so this is instant on a large workspace. Every registered
    passkey keeps working, because none of them wrapped the passphrase. */
export async function changePassphrase(unlockers:EnvelopeV2['unlockers'],dek:Dek,next:string){
 const salt=crypto.getRandomValues(new Uint8Array(16));
 const slot={kind:'passphrase' as const,salt:b64(salt),iterations:ITERATIONS,
  ...await wrap(dek,await derive(next,salt))};
 return [slot,...unlockers.filter(u=>u.kind!=='passphrase')];
}

export const passkeySlots=(unlockers:EnvelopeV2['unlockers']) =>
 unlockers.filter((u):u is PasskeyUnlocker=>u.kind==='passkey');

/** v1 envelopes are still written by nothing, but a backup file from an older
    build is still read. Kept so a caller can tell the customer which it is. */
export const envelopeVersion=(e:Envelope)=>e.format==='hisaab-aesgcm-v1'?1:2;
