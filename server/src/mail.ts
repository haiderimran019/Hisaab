/* Outgoing mail. Three messages, no templates engine, no tracking pixel.

   Without RESEND_KEY and MAIL_FROM nothing is sent and every caller is told so
   rather than silently succeeding — server/README.md records what happened last
   time that was quiet: addresses sat as `pending` forever.

   No message here ever contains a figure, a client name or anything from a
   ledger, because this service has none to put in one. */
import type {Env} from './env';

export type Sent={sent:boolean;reason:string};
const notConfigured:Sent={sent:false,reason:'no mail provider configured'};

async function send(env:Env,to:string,subject:string,text:string):Promise<Sent>{
 if(!env.RESEND_KEY||!env.MAIL_FROM)return notConfigured;
 try{
  const response=await fetch('https://api.resend.com/emails',{
   method:'POST',
   headers:{authorization:`Bearer ${env.RESEND_KEY}`,'content-type':'application/json'},
   body:JSON.stringify({from:env.MAIL_FROM,to:[to],subject,text})
  });
  return {sent:response.ok,reason:response.ok?'':`mail provider returned ${response.status}`};
 }catch{
  return {sent:false,reason:'mail provider could not be reached'};
 }
}

const FOOTER=`\n\nHisaab never receives your income, clients or statements — those stay encrypted on your device.`;

export const sendConfirmation=(env:Env,email:string,token:string)=>send(env,email,
 'Confirm your Hisaab email',
 `Someone asked to hear from Hisaab at this address.\n\nIf it was you, confirm here:\n`+
 `${env.PUBLIC_BASE??''}/v1/confirm?token=${token}\n\n`+
 `If it was not you, ignore this and nothing is stored beyond an unconfirmed row that we delete.`+FOOTER);

/** The portal sign-in link. Single-use, and it says so, because a link that
    looks reusable gets forwarded. */
export const sendSignInLink=(env:Env,email:string,token:string,minutes:number)=>send(env,email,
 'Your Hisaab sign-in link',
 `Open this link to sign in to your Hisaab licence page:\n\n`+
 `${env.PORTAL_BASE??env.PUBLIC_BASE??''}/signin?token=${token}\n\n`+
 `It works once and expires in ${minutes} minutes. If you did not ask for it, ignore it — `+
 `nobody can sign in without this email.\n\n`+
 `This page is only for buying and renewing. It cannot open your workspace, and `+
 `nothing in it can see your records.`+FOOTER);

export const sendLicenceKey=(env:Env,email:string,name:string,plan:string,key:string,expires:string)=>send(env,email,
 `Your Hisaab ${plan} key`,
 `Thank you — your licence is ready.\n\n`+
 `Name on the key: ${name}\nPlan: ${plan}\nValid until: ${expires}\n\n`+
 `Key:\n${key}\n\n`+
 `Paste it into Settings in Hisaab. It is checked on your own device, so the app `+
 `never phones home and works offline.\n\n`+
 `Keep this email: you can also fetch the key again from the licence page at any time.`+FOOTER);
