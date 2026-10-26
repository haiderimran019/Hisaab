/* Portal sign-in — and a boundary worth stating before the code.

   This authenticates a *buyer*, never a vault. The encrypted workspace has no
   account, no password on any server and no sync; it is unlocked on the device
   by a passkey or a passphrase and nothing here can open it. What a session
   grants is narrow: see which licence keys this email bought, re-send one, renew,
   and ask a practitioner for a review. If every table in this service were
   leaked tomorrow, the worst anyone would learn is who bought the software.

   Two ways in, both ending at a verified email address:

   - **An emailed link.** Single-use, 20 minutes, invalidated on use. No password
     exists to be reused, phished or breached.
   - **Google.** The ID token is verified here against Google's published keys —
     signature, issuer, audience, expiry and email_verified. We never take the
     browser's word for who it is, and no Google script runs in the vault.

   Tokens are opaque 48-hex random strings compared in constant time. Sessions
   last 30 days and can be revoked by deleting the row. */
import {err,ok,type Result} from './validate';

export const AUTH_TOKEN_MINUTES=20;
export const SESSION_DAYS=30;
export const TOKEN_SHAPE=/^[0-9a-f]{48}$/;

export const plusMinutes=(iso:string,minutes:number)=>
 new Date(Date.parse(iso)+minutes*60_000).toISOString();
export const plusDays=(iso:string,days:number)=>plusMinutes(iso,days*24*60);

/** Keyed by a hash so an erasure record does not retain the address it erased. */
export async function hashEmail(email:string,secret:string){
 const data=new TextEncoder().encode(`erasure:${secret}:${email.trim().toLowerCase()}`);
 const digest=await crypto.subtle.digest('SHA-256',data);
 return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

/* ---------------------------------------------------------------- Google ---- */

type Jwk={kid?:string;alg?:string;[k:string]:unknown};
let jwksCache:{fetchedAt:number;keys:Jwk[]}|null=null;
const JWKS_URL='https://www.googleapis.com/oauth2/v3/certs';
const JWKS_TTL_MS=60*60*1000;
const GOOGLE_ISSUERS=['accounts.google.com','https://accounts.google.com'];

/** Exposed so a test can inject keys and never reach the network. */
export function primeGoogleKeys(keys:Jwk[],fetchedAt=Date.now()){jwksCache={fetchedAt,keys};}
export function clearGoogleKeys(){jwksCache=null;}

async function googleKeys(fetchImpl:typeof fetch):Promise<Jwk[]>{
 if(jwksCache&&Date.now()-jwksCache.fetchedAt<JWKS_TTL_MS)return jwksCache.keys;
 const response=await fetchImpl(JWKS_URL);
 if(!response.ok)throw new Error(`jwks ${response.status}`);
 const body=await response.json() as {keys?:Jwk[]};
 const keys=Array.isArray(body.keys)?body.keys:[];
 jwksCache={fetchedAt:Date.now(),keys};
 return keys;
}

const b64urlToBytes=(s:string)=>{
 const padded=s.replace(/-/g,'+').replace(/_/g,'/')+'=='.slice(0,(4-s.length%4)%4);
 const binary=atob(padded);
 return Uint8Array.from(binary,c=>c.charCodeAt(0));
};
const b64urlToText=(s:string)=>new TextDecoder().decode(b64urlToBytes(s));

export type GoogleIdentity={email:string};

/** Verifies a Google ID token properly: signature first, then every claim.
    A token that fails any check is refused with one generic message, because a
    caller has no business learning which claim was wrong. */
export async function verifyGoogleIdToken(
 idToken:unknown,clientId:string,nowMs:number,fetchImpl:typeof fetch=fetch
):Promise<Result<GoogleIdentity>>{
 if(!clientId)return err(501,'Google sign-in is not switched on for this service.');
 if(typeof idToken!=='string'||idToken.length<40||idToken.length>4096)
  return err(400,'That Google sign-in could not be read.');
 const parts=idToken.split('.');
 if(parts.length!==3)return err(400,'That Google sign-in could not be read.');

 let header:{kid?:string;alg?:string};
 let claims:{iss?:string;aud?:string;exp?:number;iat?:number;email?:string;email_verified?:boolean|string};
 try{
  header=JSON.parse(b64urlToText(parts[0]));
  claims=JSON.parse(b64urlToText(parts[1]));
 }catch{return err(400,'That Google sign-in could not be read.');}
 if(header.alg!=='RS256')return err(400,'That Google sign-in could not be read.');

 let keys:Jwk[];
 try{keys=await googleKeys(fetchImpl);}
 catch{return err(503,'Google could not be reached to check that sign-in. Try the email link instead.');}
 const jwk=keys.find(k=>k.kid===header.kid);
 if(!jwk)return err(401,'That Google sign-in could not be verified.');

 let verified=false;
 try{
  const key=await crypto.subtle.importKey('jwk',jwk as JsonWebKey,
   {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  verified=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,
   b64urlToBytes(parts[2]) as BufferSource,
   new TextEncoder().encode(`${parts[0]}.${parts[1]}`) as BufferSource);
 }catch{return err(401,'That Google sign-in could not be verified.');}
 if(!verified)return err(401,'That Google sign-in could not be verified.');

 const nowSeconds=Math.floor(nowMs/1000);
 if(typeof claims.iss!=='string'||!GOOGLE_ISSUERS.includes(claims.iss))
  return err(401,'That Google sign-in could not be verified.');
 // Audience must be *our* client id, or a token minted for another site would work here.
 if(claims.aud!==clientId)return err(401,'That Google sign-in was not issued for Hisaab.');
 if(typeof claims.exp!=='number'||claims.exp<=nowSeconds)
  return err(401,'That Google sign-in has expired. Try again.');
 // A small allowance for a clock that is behind, but never a token from the future.
 if(typeof claims.iat==='number'&&claims.iat>nowSeconds+300)
  return err(401,'That Google sign-in could not be verified.');
 const confirmed=claims.email_verified===true||claims.email_verified==='true';
 if(!confirmed)return err(401,'That Google account has no verified email address.');
 if(typeof claims.email!=='string'||!claims.email.includes('@'))
  return err(401,'That Google sign-in carried no email address.');

 return ok({email:claims.email.trim().toLowerCase()});
}

/* --------------------------------------------------------------- Bearer ---- */

export const bearer=(request:Request)=>
 (request.headers.get('authorization')??'').replace(/^Bearer\s+/i,'').trim();
