/* Passkeys — the only part of unlocking that talks to the platform.

   Everything cryptographic lives in vault.ts and is tested there. This file is
   the thin, untestable-in-Node edge: it asks the browser for a passkey and
   returns the 32 bytes the vault needs. Keeping the boundary here is why the
   wrapping logic can be tested at all.

   How a passkey can hold a secret at all: WebAuthn's **PRF extension** lets a
   credential evaluate a pseudo-random function over an input we choose and
   return 32 bytes that only that authenticator can produce. We use those bytes
   as key material. The private key never leaves the secure element, there is
   nothing to phish, and we store only the credential id and a salt.

   Two things this is not:

   - **Not a login.** No server is involved. There is no relying-party backend,
     nothing is registered with anybody, and the whole exchange happens between
     the browser and the device in the customer's hand. The licence portal's
     Google sign-in is a different thing entirely, on a different page, and it
     cannot reach this.
   - **Not a replacement for the passphrase.** The vault refuses to drop its
     passphrase unlocker, so a lost device is an inconvenience, not a loss.

   PRF is not everywhere yet. Where it is missing we say so plainly and leave
   the passphrase as the only way in, rather than registering a passkey that
   would later fail to unlock anything. */

/** The relying party is this origin. Nothing is sent anywhere. */
const RP_NAME='Hisaab';
/** The PRF input. Constant, so the same credential gives the same material on
    every unlock; the per-vault randomness is the HKDF salt in the envelope. */
const PRF_INPUT=new TextEncoder().encode('hisaab-vault-unlock-v1');

export type PasskeyResult={credentialId:string;prf:Uint8Array};

const b64=(b:Uint8Array)=>{let s='';for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode(...b.subarray(i,i+8192));return btoa(s);};
const un64=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));

/** Is the API present at all? Cheap and synchronous, for deciding whether to
    draw the control. Says nothing about whether PRF works — only a real
    registration can answer that, which is why registration checks and fails. */
export function passkeysPossible(){
 return typeof PublicKeyCredential!=='undefined'
  &&typeof navigator?.credentials?.create==='function';
}

/** Whether this device can do the kind of passkey that is useful here: one with
    a platform authenticator, so unlocking is Face ID or a fingerprint rather
    than hunting for a security key. */
export async function passkeysAvailable(){
 if(!passkeysPossible())return false;
 try{
  const anyCredential=PublicKeyCredential as unknown as
   {isUserVerifyingPlatformAuthenticatorAvailable?:()=>Promise<boolean>};
  return (await anyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.())===true;
 }catch{return false;}
}

function prfBytes(credential:PublicKeyCredential){
 const results=credential.getClientExtensionResults() as
  {prf?:{enabled?:boolean;results?:{first?:ArrayBuffer}}};
 const first=results.prf?.results?.first;
 if(!first)return null;
 const bytes=new Uint8Array(first);
 return bytes.length>=32?bytes:null;
}

const UNSUPPORTED='This browser or device cannot hold a key inside a passkey yet, '
 +'so a passkey could not unlock your workspace. Your passphrase still works, and '
 +'nothing has changed.';

/** Creates a passkey for this workspace and returns its key material.

    `label` is only ever shown to the person: it goes in the credential's user
    name so their own password manager lists something recognisable. No real
    identity is used, because there is no account — the id is random bytes. */
export async function registerPasskey(label:string):Promise<PasskeyResult>{
 if(!passkeysPossible())throw Error(UNSUPPORTED);
 const credential=await navigator.credentials.create({publicKey:{
  challenge:crypto.getRandomValues(new Uint8Array(32)),
  rp:{name:RP_NAME},
  // Random, and not derived from anything about the person: there is no account
  // here to name, and a stable id would be a tracking surface for nothing.
  user:{id:crypto.getRandomValues(new Uint8Array(16)),name:label||'Hisaab workspace',displayName:label||'Hisaab workspace'},
  pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
  authenticatorSelection:{residentKey:'required',userVerification:'required',
   authenticatorAttachment:'platform'},
  // Nothing leaves the device, so there is no attestation worth asking for.
  attestation:'none',
  timeout:120_000,
  extensions:{prf:{eval:{first:PRF_INPUT}}} as AuthenticationExtensionsClientInputs
 }}) as PublicKeyCredential|null;
 if(!credential)throw Error('No passkey was created.');

 const prf=prfBytes(credential);
 // Some authenticators report prf.enabled at creation but only return material
 // on a subsequent assertion. Ask once, rather than storing an unusable slot.
 if(prf)return {credentialId:b64(new Uint8Array(credential.rawId)),prf};
 const assertion=await assertPasskey([b64(new Uint8Array(credential.rawId))]);
 if(!assertion)throw Error(UNSUPPORTED);
 return assertion;
}

/** Asks for one of the given credentials and returns its key material.
    `allow` empty lets the browser offer whatever it has for this origin. */
export async function assertPasskey(allow:string[]):Promise<PasskeyResult|null>{
 if(!passkeysPossible())throw Error(UNSUPPORTED);
 const credential=await navigator.credentials.get({publicKey:{
  challenge:crypto.getRandomValues(new Uint8Array(32)),
  allowCredentials:allow.map(id=>({type:'public-key' as const,id:un64(id)})),
  userVerification:'required',
  timeout:120_000,
  extensions:{prf:{eval:{first:PRF_INPUT}}} as AuthenticationExtensionsClientInputs
 }}) as PublicKeyCredential|null;
 if(!credential)return null;
 const prf=prfBytes(credential);
 if(!prf)throw Error(UNSUPPORTED);
 return {credentialId:b64(new Uint8Array(credential.rawId)),prf};
}

/** A name for the slot in the security panel. The platform does not tell us
    what device this is, so guess from the user agent and say it plainly rather
    than inventing precision. The person can see the date next to it. */
export function deviceLabel(){
 const ua=navigator.userAgent;
 const guess=/iPhone/.test(ua)?'iPhone':/iPad/.test(ua)?'iPad'
  :/Android/.test(ua)?'Android device':/Mac OS X/.test(ua)?'Mac'
  :/Windows/.test(ua)?'Windows PC':/Linux/.test(ua)?'Linux computer':'This device';
 return guess;
}
