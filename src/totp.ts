/* Two-factor codes from an authenticator app (RFC 4648 base32, RFC 6238 TOTP).

   What this protects, stated plainly so nobody is misled:
   - It stops someone who has watched you type your passphrase, or who sits down at
     your unlocked machine, from opening the workspace.
   - It does NOT add strength to the encryption. The shared secret lives inside the
     encrypted workspace, so it can only be checked after the passphrase has already
     decrypted it. Someone holding both your backup file and your passphrase is not
     stopped by this. Your passphrase is still the thing that matters.
   - Nothing leaves the device. There is no phone number, no email address and no
     server: the code is computed from a secret your authenticator app and this
     browser both hold. */

const ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const STEP_SECONDS=30;
export const DIGITS=6;
/** One step either side, so a slightly wrong clock still works. */
export const DRIFT_STEPS=1;

export function randomSecret(bytes=20):string{
 const raw=crypto.getRandomValues(new Uint8Array(bytes));
 return base32Encode(raw);
}
export function base32Encode(bytes:Uint8Array):string{
 let bits=0,value=0,out='';
 for(const byte of bytes){
  value=(value<<8)|byte;bits+=8;
  while(bits>=5){out+=ALPHABET[(value>>>(bits-5))&31];bits-=5;}
 }
 if(bits>0)out+=ALPHABET[(value<<(5-bits))&31];
 return out;
}
export function base32Decode(input:string):Uint8Array{
 const clean=input.toUpperCase().replace(/[\s-]/g,'').replace(/=+$/,'');
 if(!clean||/[^A-Z2-7]/.test(clean))throw Error('That is not a valid authenticator secret.');
 let bits=0,value=0;const out:number[]=[];
 for(const char of clean){
  value=(value<<5)|ALPHABET.indexOf(char);bits+=5;
  if(bits>=8){out.push((value>>>(bits-8))&255);bits-=8;}
 }
 return new Uint8Array(out);
}
/** Grouped in fours so it can be read aloud or typed without losing your place. */
export const formatSecret=(secret:string)=>secret.replace(/(.{4})/g,'$1 ').trim();

export function otpauthUri(secret:string,label:string){
 const account=encodeURIComponent(label||'workspace');
 return `otpauth://totp/Hisaab:${account}?secret=${secret}&issuer=Hisaab&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

async function hotp(secret:Uint8Array,counter:number):Promise<string>{
 const message=new Uint8Array(8);
 // Counters stay well inside 2^53, so splitting into two 32-bit halves is exact.
 const high=Math.floor(counter/0x100000000),low=counter>>>0;
 new DataView(message.buffer).setUint32(0,high);
 new DataView(message.buffer).setUint32(4,low);
 const key=await crypto.subtle.importKey('raw',secret as BufferSource,{name:'HMAC',hash:'SHA-1'},false,['sign']);
 const mac=new Uint8Array(await crypto.subtle.sign('HMAC',key,message as BufferSource));
 const offset=mac[mac.length-1]&0x0f;
 const binary=((mac[offset]&0x7f)<<24)|(mac[offset+1]<<16)|(mac[offset+2]<<8)|mac[offset+3];
 return String(binary%10**DIGITS).padStart(DIGITS,'0');
}
export const counterFor=(atMs:number)=>Math.floor(atMs/1000/STEP_SECONDS);
export const totpCode=(secret:string,atMs=Date.now())=>hotp(base32Decode(secret),counterFor(atMs));
export const secondsRemaining=(atMs=Date.now())=>STEP_SECONDS-Math.floor(atMs/1000)%STEP_SECONDS;

/** Constant-time-ish comparison; both sides are fixed-length digit strings. */
function sameCode(a:string,b:string){
 if(a.length!==b.length)return false;
 let diff=0;
 for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
 return diff===0;
}
export async function verifyCode(secret:string,entered:string,atMs=Date.now()):Promise<boolean>{
 const code=(entered??'').replace(/\s/g,'');
 if(!/^\d{6}$/.test(code))return false;
 const bytes=base32Decode(secret);
 const base=counterFor(atMs);
 for(let drift=-DRIFT_STEPS;drift<=DRIFT_STEPS;drift++){
  if(sameCode(await hotp(bytes,base+drift),code))return true;
 }
 return false;
}

/* Recovery codes: shown once, stored only as SHA-256 hashes, each usable once. */
export const RECOVERY_COUNT=8;
export function makeRecoveryCodes(count=RECOVERY_COUNT):string[]{
 return Array.from({length:count},()=>{
  const raw=base32Encode(crypto.getRandomValues(new Uint8Array(10))).slice(0,10);
  return `${raw.slice(0,5)}-${raw.slice(5,10)}`;
 });
}
export const normalizeRecovery=(code:string)=>(code??'').toUpperCase().replace(/[\s-]/g,'');
export async function hashRecovery(code:string):Promise<string>{
 const bytes=new TextEncoder().encode('hisaab-recovery-v1:'+normalizeRecovery(code));
 const digest=await crypto.subtle.digest('SHA-256',bytes as BufferSource);
 return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export const hashAll=(codes:string[])=>Promise.all(codes.map(hashRecovery));
