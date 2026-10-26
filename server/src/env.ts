/* Configuration, and what happens when a thing is not configured.

   Every optional capability here is **off** until its variables are set, and off
   means a clear refusal rather than a half-working feature. A service deployed
   with nothing but DB, ALLOWED_ORIGIN, RATE_SECRET and ADMIN_TOKEN sends no
   mail, reads no documents, accepts no Google sign-in and still works. */
export type Env={
 DB:unknown;
 ALLOWED_ORIGIN:string;       // e.g. https://haiderimran019.github.io
 RATE_SECRET:string;          // any long random string
 ADMIN_TOKEN:string;          // bearer token for the admin endpoints

 RESEND_KEY?:string;          // optional: without it, no mail is sent at all
 MAIL_FROM?:string;           // e.g. Hisaab <hello@yourdomain.pk>
 PUBLIC_BASE?:string;         // where /v1/confirm and the sign-in link live
 PORTAL_BASE?:string;         // where the buying portal lives, for emailed links

 LICENCE_PUBLIC_KEY?:string;  // the JWK from src/license.ts, so paid features are checked here
 GOOGLE_CLIENT_ID?:string;    // unset = Google sign-in is off; the email link still works

 MODEL_PROVIDER?:string;      // 'gemini' or 'anthropic'. Unset = document reading is off
 MODEL_NAME?:string;
 MODEL_KEY?:string;
 READER_NAME?:string;         // shown on the consent screen. Consent needs a name
 EXTRACT_ANNUAL_CAP?:string;  // documents per licence per tax year. Default below
 /* Country codes where document reading is refused, e.g. "PK".
    Pakistan has no enacted data protection act today, and the pending bill would
    restrict sending sensitive data abroad. This is the switch that honours that
    the day it passes, without a rebuild or a redeploy of the app. */
 EXTRACT_BLOCKED_COUNTRIES?:string;
};

export const DEFAULT_EXTRACT_ANNUAL_CAP=40;

export const extractAnnualCap=(env:Env)=>{
 const parsed=Number(env.EXTRACT_ANNUAL_CAP);
 return Number.isSafeInteger(parsed)&&parsed>0?parsed:DEFAULT_EXTRACT_ANNUAL_CAP;
};

export const extractConfigured=(env:Env)=>
 Boolean(env.MODEL_PROVIDER&&env.MODEL_KEY&&env.MODEL_NAME);

export const blockedCountries=(env:Env)=>
 (env.EXTRACT_BLOCKED_COUNTRIES??'').split(',').map(c=>c.trim().toUpperCase()).filter(Boolean);
