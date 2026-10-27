/* Filing reminders — the one message this service sends that nobody asked for
   on the day it arrives.

   A freelancer who misses 30 September pays a penalty and loses filer status
   for a year, and the reason is almost never that they did not want to file. So
   a reminder is worth real money to the person receiving it. It is also the
   easiest thing in a product like this to get wrong, in three ways:

   - **Sending something only a practitioner may say.** A reminder that tells
     someone what they owe, or whether a conditional obligation applies to them,
     is advice. So only the **universal** obligations are emailed: everyone
     Hisaab serves has to file a return. Advance tax under section 147 depends on
     a last assessed liability that this service has never seen and the app
     deliberately does not evaluate, so it is never emailed — src/deadlines.ts
     explains why at length.
   - **Sending a figure.** There is none to send. This service holds an address
     and a tax year. It does not know whether the person has filed, what they
     earned, or whether they are even still freelancing. The wording below says
     so rather than implying knowledge it does not have.
   - **Sending it twice.** A cron that retries, or two deployments firing on the
     same day, must not double-send. reminder_log's primary key is
     (email, tax_year, milestone) and recordReminder returns false when the row
     already exists, so idempotency is the database's job, not a flag in here.
     For the same reason a milestone is keyed on the **date**, not on the
     obligation: the return and the wealth statement share 30 September, and two
     emails on one morning about one date is the kind of thing that gets a
     sender filtered into spam for good. One message names both.

   The dates come from ../../src/deadlines — the same table the app's countdown
   reads, imported rather than copied. A legal fact with two homes drifts, and
   the half that drifts is always the one nobody is looking at. */
import {OBLIGATIONS,dateFor} from '../../src/deadlines';
import type {Env} from './env';
import type {Store} from './store';
import {sendFilingReminder} from './mail';

/** How far ahead of a deadline each reminder goes out. Two is deliberate: one
    far enough out to gather documents, one close enough to act on. */
export const LEAD_DAYS=[30,7] as const;

export type Milestone={
 /** Stable key for the log row, keyed on the date so obligations sharing one
     date share one message. Changing the format re-sends to everybody. */
 id:string;
 /** Every universal obligation falling on this date, in table order. */
 obligations:{id:string;label:string;law:string}[];
 /** For the subject line: the first obligation, which is the return. */
 label:string;
 taxYear:number;
 dueOn:string;
 leadDays:number;
};

const DAY=86_400_000;
const shift=(dayIso:string,days:number)=>
 new Date(Date.parse(`${dayIso}T00:00:00Z`)+days*DAY).toISOString().slice(0,10);

/** Which reminders fall due on this exact day.
    Only universal obligations: see the header. Two tax years are considered so
    a deadline either side of a year boundary is never missed. */
export function due(day:string):Milestone[] {
 const year=Number(day.slice(0,4));
 const grouped=new Map<string,Milestone>();
 for(const taxYear of [year,year+1])
  for(const o of OBLIGATIONS){
   if(!o.universal)continue;
   const dueOn=dateFor(o,taxYear);
   for(const leadDays of LEAD_DAYS){
    if(shift(dueOn,-leadDays)!==day)continue;
    const id=`${dueOn}-${leadDays}d`;
    const existing=grouped.get(id);
    if(existing){existing.obligations.push({id:o.id,label:o.label,law:o.law});continue;}
    grouped.set(id,{id,obligations:[{id:o.id,label:o.label,law:o.law}],
     label:o.label,taxYear,dueOn,leadDays});
   }
  }
 return [...grouped.values()];
}

/** The message. No figure, no claim about whether they have filed, and a line
    saying why they are getting it at all. */
export function body(m:Milestone,env:Env){
 const when=m.leadDays===1?'tomorrow':`in ${m.leadDays} days`;
 const opening=m.obligations.length===1
  ? `Your ${m.label.toLowerCase()} for tax year ${m.taxYear} is due on ${m.dueOn} — ${when}.`
  : `Two things are due for tax year ${m.taxYear} on ${m.dueOn} — ${when}:\n`
    +m.obligations.map(o=>`  - ${o.label} (${o.law})`).join('\n')
    +`\n\nThey are filed together.`;
 return `${opening}\n\n`
  +`FBR has extended this date in most recent years, sometimes more `
  +`than once, and Hisaab does not track extensions: file as though it will not `
  +`move.\n\n`
  +`This is a date, not an assessment. Hisaab has no idea whether you have `
  +`already filed, what you earned, or whether this obligation is yours this `
  +`year — your records never leave your device, so this service cannot see `
  +`them. If you have filed, ignore this.\n\n`
  +`Open Hisaab and run the pre-file check before you file.\n\n`
  +`You are getting this because you confirmed this address for Hisaab updates. `
  +`To stop: ${env.PUBLIC_BASE??''}/v1/unsubscribe?token=`;
}

export type RunResult={
 day:string;
 dryRun:boolean;
 milestones:Milestone[];
 recipients:number;
 sent:number;
 skipped:number;
 failed:number;
 reason:string;
};

/** Sends today's reminders to confirmed subscribers.
    `dryRun` answers "what would go out, to how many" without sending or
    writing a log row, which is how this gets checked in production without
    mailing anybody. */
export async function runReminders(env:Env,store:Store,day:string,opts:{
 dryRun?:boolean;limit?:number}={}):Promise<RunResult>{
 const dryRun=opts.dryRun===true;
 const milestones=due(day);
 const base:RunResult={day,dryRun,milestones,recipients:0,sent:0,skipped:0,failed:0,reason:''};
 if(!milestones.length)return {...base,reason:'no reminder falls due today'};

 const people=await store.listConfirmed(opts.limit??1000);
 base.recipients=people.length;
 if(!people.length)return {...base,reason:'no confirmed addresses'};
 if(dryRun)return {...base,reason:'dry run — nothing sent, nothing logged'};
 if(!env.RESEND_KEY||!env.MAIL_FROM)
  return {...base,reason:'no mail provider configured, so nothing was sent and nothing was logged'};

 let sent=0,skipped=0,failed=0;
 for(const m of milestones)
  for(const person of people){
   // Claim the row first. If the claim fails this person already had it, and a
   // retry of a half-finished run therefore picks up where it stopped.
   const first=await store.recordReminder(person.email,String(m.taxYear),m.id,new Date().toISOString());
   if(!first){skipped++;continue;}
   const result=await sendFilingReminder(env,person.email,m,body(m,env)+person.token);
   if(result.sent)sent++;else failed++;
  }
 return {...base,sent,skipped,failed,
  reason:failed?`${failed} message(s) the mail provider would not take`:'sent'};
}
