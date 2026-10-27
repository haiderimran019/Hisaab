/* Filing reminders.

   The things worth testing here are not "does it send an email" — that is one
   fetch — but the four ways a reminder system hurts people: sending twice,
   sending a conditional obligation as though it were universal, sending on the
   wrong day, and surviving erasure. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {handle,scheduled,type Env} from '../src/index.ts';
import {memoryStore,type Store} from '../src/store.ts';
import {due,runReminders,body as reminderBody,LEAD_DAYS} from '../src/reminders.ts';
import {OBLIGATIONS,dateFor} from '../../src/deadlines.ts';

const ADMIN='admin-token-for-tests';
const ORIGIN='https://app.test';
const base:Env={DB:null,ALLOWED_ORIGIN:ORIGIN,RATE_SECRET:'test-secret-value',ADMIN_TOKEN:ADMIN};
const mailing:Env={...base,RESEND_KEY:'re_test',MAIL_FROM:'Hisaab <hello@test.pk>',
 PUBLIC_BASE:'https://api.test'};

/** The return date for a tax year, which every filer has. */
const returnDate=(taxYear:number)=>
 dateFor(OBLIGATIONS.find(o=>o.id==='return')!,taxYear);
const minus=(dayIso:string,days:number)=>
 new Date(Date.parse(dayIso+'T00:00:00Z')-days*86_400_000).toISOString().slice(0,10);
/** Mirrors the log key in reminders.ts, which is keyed on the date. */
const milestoneId=(taxYear:number,lead:number)=>`${returnDate(taxYear)}-${lead}d`;

async function withConfirmed(emails:string[]){
 const store=memoryStore();
 for(const email of emails){
  const token=`tok-${email}`;
  await store.addSubscriber({email,status:'pending',token,source:'test',
   createdAt:'2026-07-01T00:00:00.000Z',confirmedAt:null});
  await store.setStatus(token,'confirmed','2026-07-01T00:00:00.000Z');
 }
 return store;
}

/** Counts attempts instead of reaching the network. Returns ok so a send that
    the code treats as successful is one the test can count. */
function countingFetch(){
 const calls:{to:string;subject:string;text:string}[]=[];
 const real=globalThis.fetch;
 globalThis.fetch=(async (_url:unknown,init:RequestInit)=>{
  const sent=JSON.parse(String(init.body)) as {to:string[];subject:string;text:string};
  calls.push({to:sent.to[0],subject:sent.subject,text:sent.text});
  return new Response('{}',{status:200});
 }) as typeof fetch;
 return {calls,restore(){globalThis.fetch=real;}};
}

test('a reminder goes out 30 and 7 days before the return deadline, and on no other day', () => {
 const deadline=returnDate(2027);
 for(const lead of LEAD_DAYS){
  const milestones=due(minus(deadline,lead));
  assert.equal(milestones.length,1,
   'obligations sharing a date must share one message, not send two');
  const [found]=milestones;
  assert.equal(found.taxYear,2027);
  assert.equal(found.dueOn,deadline);
  assert.deepEqual(found.obligations.map(o=>o.id),['return','wealth-statement'],
   'the return and the wealth statement are filed together, so they are named together');
 }
 // A day between the two reminders, and one just after the deadline.
 assert.equal(due(minus(deadline,14)).length,0);
 assert.equal(due(minus(deadline,-1)).length,0);
});

test('conditional obligations are never emailed, however close they are', () => {
 const conditional=OBLIGATIONS.filter(o=>!o.universal);
 assert.ok(conditional.length,'the fixture should include obligations that depend on a judgement');
 for(const o of conditional)
  for(const taxYear of [2026,2027,2028])
   for(const lead of LEAD_DAYS){
    const day=minus(dateFor(o,taxYear),lead);
    assert.equal(due(day).filter(m=>m.obligations.some(x=>x.id===o.id)).length,0,
     `${o.id} must not be emailed: ${o.note}`);
   }
});

test('no message carries a figure, and each says Hisaab cannot see the books', () => {
 const [m]=due(minus(returnDate(2027),30));
 const text=reminderBody(m,mailing);
 assert.doesNotMatch(text,/PKR|\d{4,}\.\d\d/,'a reminder must contain no money figure');
 assert.match(text,/never leave your device/);
 assert.match(text,/no idea whether you have/);
 assert.match(text,/unsubscribe\?token=/);
});

test('a second run on the same day sends nothing again', async () => {
 const day=minus(returnDate(2027),30);
 const store=await withConfirmed(['one@example.com','two@example.com']);
 const net=countingFetch();
 try{
  const first=await runReminders(mailing,store,day);
  assert.equal(first.sent,2);
  assert.equal(first.skipped,0);
  assert.equal(net.calls.length,2);

  const second=await runReminders(mailing,store,day);
  assert.equal(second.sent,0);
  assert.equal(second.skipped,2,'the log, not a flag, is what stops the second send');
  assert.equal(net.calls.length,2,'no further mail was attempted');
 }finally{net.restore();}
});

test('the scheduled handler is the same path, and logs rather than throwing', async () => {
 const day=minus(returnDate(2027),7);
 const store=await withConfirmed(['one@example.com']);
 const net=countingFetch();
 try{
  const result=await scheduled({scheduledTime:Date.parse(day+'T03:00:00Z')},mailing,store);
  assert.equal(result?.sent,1);
  assert.match(net.calls[0].subject,/Income tax return for tax year 2027 is due/);
 }finally{net.restore();}

 // A store that throws is logged, not propagated: the platform would retry.
 // Fired on a day that does have a milestone, or the run would return before
 // it ever touched the store and the test would prove nothing.
 const broken={...store,listConfirmed(){throw new Error('db down');}} as unknown as Store;
 assert.equal(await scheduled(
  {scheduledTime:Date.parse(day+'T03:00:00Z')},mailing,broken),null);
});

test('with no mail provider nothing is sent and nothing is logged, and it says why', async () => {
 const day=minus(returnDate(2027),30);
 const store=await withConfirmed(['one@example.com']);
 const result=await runReminders(base,store,day);
 assert.equal(result.sent,0);
 assert.match(result.reason,/no mail provider/);
 assert.equal(await store.countReminders('2027',milestoneId(2027,30)),0,
  'nothing may be logged as sent when nothing went out');
});

test('a dry run reports what would go out and writes no log row', async () => {
 const day=minus(returnDate(2027),30);
 const store=await withConfirmed(['one@example.com','two@example.com']);
 const result=await runReminders(mailing,store,day,{dryRun:true});
 assert.equal(result.recipients,2);
 assert.equal(result.sent,0);
 assert.equal(result.milestones.length,1);
 assert.equal(await store.countReminders('2027',milestoneId(2027,30)),0);
});

test('the admin endpoint defaults to a dry run, so a mistyped call mails nobody', async () => {
 const day=minus(returnDate(2027),30);
 const store=await withConfirmed(['one@example.com']);
 const net=countingFetch();
 try{
  const response=await handle(new Request('https://api.test/v1/admin/reminders',{
   method:'POST',headers:{origin:ORIGIN,'content-type':'application/json',
    authorization:`Bearer ${ADMIN}`,'cf-connecting-ip':'203.0.113.9'},
   body:JSON.stringify({day})}),mailing,store);
  const result=await response.json() as {dryRun:boolean;recipients:number};
  assert.equal(response.status,200);
  assert.equal(result.dryRun,true);
  assert.equal(result.recipients,1);
  assert.equal(net.calls.length,0);
 }finally{net.restore();}
});

test('erasing an address removes its reminder log too', async () => {
 const day=minus(returnDate(2027),30);
 const store=await withConfirmed(['gone@example.com']);
 const net=countingFetch();
 try{await runReminders(mailing,store,day);}finally{net.restore();}
 assert.equal(await store.countReminders('2027',milestoneId(2027,30)),1);
 await store.eraseEmail('gone@example.com','hash','all','2026-10-27T00:00:00.000Z');
 assert.equal(await store.countReminders('2027',milestoneId(2027,30)),0,
  'an erased address must leave nothing behind that could be mailed again');
});
