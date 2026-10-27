/* The filing features: deadlines, PSEB, pre-filing checks, documents, gateways
   and the prior year.

   Each of these tells somebody something about their tax, so the tests care
   about two things in roughly equal measure: that the arithmetic is right, and
   that the module refuses to claim what it cannot know. The second half is
   easier to break silently, so there is more of it. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import Decimal from 'decimal.js';
import {schedule,nextDue,countdown,dateFor,OBLIGATIONS,DEADLINE_CAVEAT} from '../src/deadlines.ts';
import {assessPseb,savingThrough,PSEB_RATE,OTHER_RATE,CONCESSION_THROUGH} from '../src/pseb.ts';
import {prefile} from '../src/prefile.ts';
import {prcRequest,incomeProof} from '../src/letters.ts';
import {PROVIDERS,detectProvider,providerById,hintsFor,needsRealisationWarning,
 GENERIC_GATEWAY_WARNING} from '../src/providers.ts';
import {priorYear,figuresFor,describe as describeMove,EARLIEST_YEAR} from '../src/prior.ts';
import {hints} from '../src/statements.ts';
import {blankWorkspace,workspaceSchema,type Workspace} from '../src/core.ts';
import {demo} from '../src/demo.ts';

/* ── fixtures ────────────────────────────────────────────────────────────── */

const receipt=(over:Record<string,unknown>={})=>({
 id:randomUUID(),date:'2026-09-15',client:'Orbit Labs',description:'Backend work',
 currency:'USD',gross:'4000.00',fee:'0.00',rate:'280.000000',bankFee:'0.00',
 withheld:'2800.00',rail:'Bank transfer',category:'it-export',
 evidence:'HBL advice 8891',banking:true,taxBase:'1120000.00',baseConfirmed:true,...over});

const expense=(over:Record<string,unknown>={})=>({
 id:randomUUID(),date:'2026-09-20',vendor:'Hosting Co',category:'Software',
 amount:'5000.00',currency:'PKR',rate:'1',businessPct:100,deductible:true,
 evidence:'invoice 44',receipt:null,...over});

/** A workspace that would actually pass a pre-filing check. */
function clean(over:Partial<Workspace>={}):Workspace{
 const w=blankWorkspace();
 w.profile={...w.profile,name:'Ayesha Khan',confirmedYear:2027,pseb:true,returnFiled:true,
  statementsFiled:true,salesReturns:true,noForeignCredit:true,noOptOut:true,
  simpleBusiness:true,deductionsReviewed:true,provinceReviewed:true};
 w.receipts=[receipt()] as never;
 return workspaceSchema.parse({...w,...over});
}

/* ── Deadlines ───────────────────────────────────────────────────────────── */

test('the statutory dates land where FBR publishes them', () => {
 // TY2027 runs 1 July 2026 to 30 June 2027; the return is due 30 September 2027.
 const byId=Object.fromEntries(schedule(2027,'2026-10-27').map(o=>[o.id,o]));
 assert.equal(byId['return'].date,'2027-09-30');
 assert.equal(byId['wealth-statement'].date,'2027-09-30','filed with the return');
 // The section 147 instalments fall inside the tax year, not after it.
 assert.equal(byId['advance-q1'].date,'2026-09-15');
 assert.equal(byId['advance-q2'].date,'2026-12-15');
 assert.equal(byId['advance-q3'].date,'2027-03-15');
 assert.equal(byId['advance-q4'].date,'2027-06-15');
});

test('no deadline states a threshold or a penalty, because the sources disagreed', () => {
 const all=JSON.stringify(OBLIGATIONS)+DEADLINE_CAVEAT;
 for(const forbidden of ['200,000','200000','1,000,000','40,000','penalty of','Rs 10,000'])
  assert.ok(!all.includes(forbidden),`a deadline note states "${forbidden}" as fact`);
 // The advance-tax obligation must say plainly that it is not evaluated.
 const advance=OBLIGATIONS.find(o=>o.id==='advance-q1')!;
 assert.equal(advance.universal,false);
 assert.match(advance.note,/does not evaluate/);
 assert.match(advance.note,/names no threshold/);
});

test('the return date is presented as movable, because it moves', () => {
 const ret=OBLIGATIONS.find(o=>o.id==='return')!;
 assert.match(ret.note,/extended this date/);
 assert.match(ret.note,/does not track extensions/);
 assert.match(DEADLINE_CAVEAT,/No date here is used in any tax calculation/);
});

test('the countdown is in date order and knows what has passed', () => {
 const rows=schedule(2027,'2027-01-01');
 assert.deepEqual([...rows].sort((a,b)=>a.date.localeCompare(b.date)).map(r=>r.id),
  rows.map(r=>r.id));
 assert.equal(rows.find(r=>r.id==='advance-q1')!.state,'past');
 assert.equal(rows.find(r=>r.id==='return')!.state,'ahead');
 const soon=schedule(2027,'2027-09-20').find(r=>r.id==='return')!;
 assert.equal(soon.state,'soon');
 assert.equal(soon.daysAway,10);
 assert.equal(countdown(soon),'due in 10 days');
 assert.equal(countdown({...soon,daysAway:0,state:'today'}),'due today');
 assert.equal(countdown({...soon,daysAway:1,state:'soon'}),'due tomorrow');
 assert.equal(countdown({...soon,daysAway:-3,state:'past'}),'was due 3 days ago');
 assert.match(countdown({...soon,daysAway:200,state:'ahead'}),/about 7 months/);
});

test('the next thing due skips what has passed, and a bad clock throws', () => {
 assert.equal(nextDue(2027,'2027-04-01')!.id,'advance-q4');
 assert.equal(nextDue(2027,'2028-01-01'),null,'nothing left for that year');
 assert.throws(()=>schedule(2027,'not-a-date'),/Invalid date/);
 assert.equal(dateFor(OBLIGATIONS[0],2026),'2026-09-30');
});

/* ── PSEB ────────────────────────────────────────────────────────────────── */

test('the PSEB saving is the exact difference on the real base', () => {
 const w=clean();
 const a=assessPseb(w,2027);
 assert.equal(a.itBase,1120000);
 assert.equal(a.atPseb,2800);     // 0.25%
 assert.equal(a.atOther,11200);   // 1%
 assert.equal(a.saving,8400);
 assert.equal(a.relevant,true);
 assert.equal(a.registered,true);
 assert.equal(PSEB_RATE*4,OTHER_RATE,'the whole point: four times the tax');
});

test('only IT/ITeS receipts count, because the other rate does not change', () => {
 const w=clean({receipts:[receipt(),receipt({category:'service-export'}),
  receipt({category:'domestic',taxBase:'0.00',withheld:'0.00'})] as never});
 const a=assessPseb(w,2027);
 assert.equal(a.itBase,1120000,'service exports are 1% either way; domestic is not 154A at all');
});

test('with no IT export income it says so instead of showing a zero', () => {
 const a=assessPseb(clean({receipts:[] as never}),2027);
 assert.equal(a.relevant,false);
 assert.equal(a.saving,0);
 assert.equal(a.clear,false);
 assert.match(a.headline,/Record an IT or ITeS export receipt/);
});

test('the saving is conditional while any 154A condition is unconfirmed', () => {
 const w=clean();
 w.profile.returnFiled=false;
 const a=assessPseb(w,2027);
 assert.ok(a.unmet.includes('return'));
 assert.equal(a.clear,false);
 assert.match(a.caveat,/assumes every section 154A condition is met/);
 // The money is still shown — a conditional figure is more use than none.
 assert.equal(a.saving,8400);
});

test('it never claims to have checked PSEB registration or the classification', () => {
 const a=assessPseb(clean(),2027);
 assert.equal(a.clear,true);
 assert.match(a.caveat,/cannot verify your PSEB registration/);
 assert.match(a.caveat,/decide whether your service is IT \/ ITeS/);
 const pseb=a.conditions.find(c=>c.id==='pseb')!;
 assert.match(pseb.note,/checks nothing/);
 // An unrealised receipt cannot satisfy the banking condition.
 const w=clean({receipts:[receipt({banking:false})] as never});
 assert.equal(assessPseb(w,2027).conditions.find(c=>c.id==='banking')!.met,false);
});

test('the multi-year figure stops at the legislated end of the concession', () => {
 const a=assessPseb(clean(),2027);
 const through=savingThrough(a,2027);
 assert.equal(through.years,CONCESSION_THROUGH-2027+1);
 assert.equal(through.total,8400*through.years);
 assert.match(through.note,/not a forecast/);
 assert.equal(savingThrough(a,CONCESSION_THROUGH+1).years,0,'nothing is assumed beyond it');
});

/* ── Pre-filing checks ───────────────────────────────────────────────────── */

test('a clean workspace has nothing to stop it, and still refuses to say "correct"', () => {
 const r=prefile(clean(),2027);
 assert.deepEqual(r.stops.map(s=>s.id),[]);
 assert.equal(r.fileable,true);
 assert.match(r.verdict,/Nothing Hisaab can check is wrong/);
 assert.match(r.verdict,/practitioner/,'fileable must never read as approval');
});

test('unsupported export figures are stops, each naming its records', () => {
 const w=clean({receipts:[receipt({banking:false,baseConfirmed:false,evidence:''})] as never});
 const r=prefile(w,2027);
 const ids=r.stops.map(s=>s.id);
 for(const expected of ['unbanked','base-unconfirmed','no-evidence'])
  assert.ok(ids.includes(expected),`${expected} should stop a filing`);
 assert.equal(r.fileable,false);
 assert.equal(r.stops.find(s=>s.id==='unbanked')!.count,1);
 // The realisation point has to be explained, not just asserted.
 assert.match(r.stops.find(s=>s.id==='unbanked')!.detail,/has not been realised/);
 assert.match(r.stops.find(s=>s.id==='base-unconfirmed')!.detail,/understates the base/);
});

test('arithmetic that cannot be true is a stop', () => {
 const w=clean({receipts:[receipt({withheld:'2800.00',taxBase:'1000.00'})] as never});
 const r=prefile(w,2027);
 assert.ok(r.stops.some(s=>s.id==='withheld-over-base'));
});

test('an empty year, a mismatched profile year and a missing name all stop it', () => {
 assert.ok(prefile(clean({receipts:[] as never}),2027).stops.some(s=>s.id==='no-receipts'));
 const w=clean();w.profile.confirmedYear=2026;
 assert.ok(prefile(w,2027).stops.some(s=>s.id==='profile-year'));
 const n=clean();n.profile.name='';
 assert.ok(prefile(n,2027).stops.some(s=>s.id==='no-name'));
});

test('judgement calls are looks, not stops, and carry the estimate\'s own wording', () => {
 const w=clean();
 w.profile.deductionsReviewed=false;
 w.expenses=[expense({businessPct:100,evidence:''})] as never;
 w.receipts=[receipt(),receipt({category:'domestic',taxBase:'0.00',withheld:'0.00'})] as never;
 const r=prefile(workspaceSchema.parse(w),2027);
 const looks=r.looks.map(l=>l.id);
 assert.ok(looks.includes('full-business-no-evidence'));
 assert.ok(looks.some(id=>id.startsWith('estimate-reason-')),
  'the estimate is the one source for profile-level wording');
 assert.ok(r.looks.some(l=>l.id==='iris-draft'),'a draft IRIS map is a look while it is a draft');
 // None of those should block.
 assert.equal(r.stops.some(s=>s.severity!=='stop'),false);
 assert.ok(r.findings.length===r.stops.length+r.looks.length);
});

test('a statement that does not reconcile stops a filing drawn from it', () => {
 const w=demo();
 const account=w.accounts[0];
 // The demo carries no running balances, so there is no chain to break. Build
 // one that does chain, then corrupt a single balance — which is exactly what a
 // misread digit in an imported PDF looks like.
 let running=new Decimal(account.opening);
 const own:string[]=[];
 const chained=w.lines.map(l=>{
  if(l.accountId!==account.id)return l;
  running=running.plus(l.amount);
  own.push(l.id);
  return {...l,balance:running.toFixed(2)};
 });
 assert.ok(own.length>=2,'the fixture needs at least two lines to form a chain');
 const lines=chained.map(l=>l.id===own[1]
  ?{...l,balance:new Decimal(l.balance).plus(50_000).toFixed(2)}:l);
 const r=prefile(workspaceSchema.parse({...w,lines}),2027);
 assert.ok(r.stops.some(s=>s.id==='balance-breaks'),'a broken chain must block');
 assert.match(r.stops.find(s=>s.id==='balance-breaks')!.detail,/any total drawn from it is wrong/);
});

test('every finding points somewhere the app can actually go', () => {
 const r=prefile(demo(),2027);
 for(const finding of r.findings){
  assert.ok(['Money','Tax','Pack','Settings'].includes(finding.page),finding.id);
  assert.ok(finding.title.length>5&&finding.detail.length>20,finding.id);
 }
 assert.equal(new Set(r.findings.map(f=>f.id)).size,r.findings.length,'ids must be unique');
});

/* ── The PRC request ─────────────────────────────────────────────────────── */

test('the PRC request names each realisation and totals the gross PKR base', () => {
 const w=clean({receipts:[receipt(),receipt({date:'2026-11-02',taxBase:'560000.00'})] as never});
 const r=prcRequest(w,2027,{bank:'HBL',branch:'Gulberg',accountRef:'PK00HABB0000',today:'2026-10-27'});
 assert.equal(r.receipts.length,2);
 assert.equal(r.total,1680000);
 assert.match(r.text,/Proceeds Realisation Certificate/);
 assert.match(r.text,/section 154A/);
 assert.match(r.text,/PKR 1,680,000\.00/);
 assert.match(r.text,/HBL, Gulberg/);
 assert.match(r.text,/PK00HABB0000/);
 assert.match(r.text,/Ayesha Khan/);
 // It must invite correction rather than assert the figures at the bank.
 assert.match(r.text,/reflected your records/);
 assert.match(r.text,/figures above are mine, not the\s+bank's/);
 // Dated order, so the bank can follow it.
 assert.deepEqual(r.receipts.map(x=>x.date),['2026-09-15','2026-11-02']);
});

test('a receipt the bank never saw is left out visibly, not silently', () => {
 const w=clean({receipts:[receipt(),receipt({banking:false,client:'Unrealised Ltd'})] as never});
 const r=prcRequest(w,2027,{today:'2026-10-27'});
 assert.equal(r.receipts.length,1);
 assert.equal(r.skipped.length,1);
 assert.equal(r.skipped[0].client,'Unrealised Ltd');
 assert.match(r.skipped[0].reason,/nothing to certify yet/);
});

test('missing details become obvious placeholders rather than blank gaps', () => {
 const w=blankWorkspace();
 w.receipts=[receipt()] as never;
 const r=prcRequest(workspaceSchema.parse(w),2027,{today:'2026-10-27'});
 for(const placeholder of ['[your name]','[your bank]','[branch]','[your account number or IBAN]'])
  assert.ok(r.text.includes(placeholder),`${placeholder} should be visibly unfilled`);
 assert.match(r.text,/\[sign here\]/);
});

test('with no export receipts it asks for a blanket certificate instead of an empty list', () => {
 const r=prcRequest(clean({receipts:[] as never}),2027,{today:'2026-10-27'});
 assert.equal(r.receipts.length,0);
 assert.match(r.text,/all export proceeds credited/);
});

/* ── Proof of income ────────────────────────────────────────────────────── */

test('the income statement adds up and shows its months', () => {
 const w=clean({receipts:[
  receipt({date:'2026-07-10'}),
  receipt({date:'2026-07-20'}),
  receipt({date:'2026-08-05',gross:'2000.00',taxBase:'560000.00',withheld:'1400.00'})] as never});
 const p=incomeProof(w,2027,{purpose:'Tenancy application',today:'2026-10-27'});
 // gross = 4000*280 + 4000*280 + 2000*280
 assert.equal(p.total,2800000);
 assert.equal(p.months,2);
 assert.equal(p.monthlyAverage,1400000);
 assert.equal(p.clients,1);
 assert.ok(p.netTotal<p.total,'net is after fees and tax deducted');
 assert.match(p.text,/Tenancy application/);
 assert.match(p.text,/2026-07/);
 assert.match(p.text,/2026-08/);
});

test('the income statement refuses to look audited', () => {
 const p=incomeProof(clean(),2027,{today:'2026-10-27'});
 for(const body of [p.text,p.html]){
  assert.match(body,/not audited/);
  assert.match(body,/not certified by any accountant or authority/);
  assert.match(body,/not a tax\s+return or an FBR document|not a tax return or an FBR document/);
  assert.match(body,/prepared by me from my own records/);
 }
 assert.match(p.html,/<h1>Statement of income<\/h1>/);
});

test('the proof escapes anything typed into it', () => {
 const w=clean();
 w.profile.name='<script>alert(1)</script>';
 const p=incomeProof(workspaceSchema.parse(w),2027,{purpose:'<img onerror=x>',today:'2026-10-27'});
 assert.ok(!p.html.includes('<script>'),'a name must not become markup');
 assert.ok(!p.html.includes('<img onerror'));
 assert.match(p.html,/&lt;script&gt;/);
});

test('an empty year produces a statement that says so rather than zeroes', () => {
 const p=incomeProof(clean({receipts:[] as never}),2027,{today:'2026-10-27'});
 assert.equal(p.total,0);
 assert.equal(p.monthlyAverage,0,'no division by zero months');
 assert.match(p.text,/No receipts recorded/);
});

/* ── Gateways and the realisation point ──────────────────────────────────── */

test('every gateway warns that its rows are not yet 154A receipts', () => {
 for(const p of PROVIDERS.filter(p=>p.realisation==='later')){
  assert.ok(p.warning.length>80,`${p.id} needs a real warning`);
  assert.match(p.warning,/not a bank statement|platform ledger/,p.id);
  assert.match(p.warning,/realised|realisation/,p.id);
  assert.equal(needsRealisationWarning(p),true,p.id);
 }
 const bank=providerById('bank')!;
 assert.equal(bank.realisation,'here');
 assert.equal(needsRealisationWarning(bank),false);
 assert.match(bank.note,/is the section 154A tax base/);
 assert.equal(needsRealisationWarning(null),false);
 assert.match(GENERIC_GATEWAY_WARNING,/authorized dealer/);
});

test('a provider is recognised from its own export headers', () => {
 assert.equal(detectProvider(['Transaction Date','Transaction Type','Description',
  'Amount','Currency','Target ID'])?.id,'payoneer');
 assert.equal(detectProvider(['TransferWise ID','Date','Amount','Currency',
  'Running Balance','Exchange Rate','Payer Name'])?.id,'wise');
 assert.equal(detectProvider(['Value Date','Particulars','Withdrawal','Deposit',
  'Balance','Account Number'])?.id,'bank');
});

test('one coincidental column never decides a provider', () => {
 assert.equal(detectProvider(['Date','Amount','Balance']),null,
  'generic headers must stay generic');
 assert.equal(detectProvider(['Date','Description','Amount']),null);
 assert.equal(detectProvider([]),null);
 assert.equal(providerById('nope'),null);
});

test('provider hints extend the generic ones rather than replacing them', () => {
 const merged=hintsFor(providerById('wise'),hints);
 assert.ok(merged.counterparty.includes('payer name'),'the provider hint is there');
 assert.ok(merged.counterparty.includes('counterparty'),'and the generic ones survive');
 assert.equal(merged.counterparty.indexOf('payer name')<merged.counterparty.indexOf('counterparty'),
  true,'the provider hint wins a tie');
 assert.deepEqual(hintsFor(null,hints),hints,'an unknown file keeps the generic mapping');
});

test('platform fees are called out, because they are the double-count trap', () => {
 assert.match(providerById('upwork')!.note,/claimed twice|Pick one and be consistent/);
 assert.match(providerById('fiverr')!.note,/understate both income and the fee/);
 assert.match(providerById('wise')!.note,/not the one your tax base is built on/);
});

/* ── Prior year ─────────────────────────────────────────────────────────── */

test('two years in one workspace produce a comparison', () => {
 const w=clean({receipts:[
  receipt({date:'2025-09-01',taxBase:'500000.00'}),   // TY2026
  receipt({date:'2026-09-01',taxBase:'1000000.00'})] as never}); // TY2027
 const r=priorYear(w,2027);
 assert.equal(r.current.present,true);
 assert.equal(r.prior.present,true);
 assert.equal(r.prior.year,2026);
 const base=r.movements.find(m=>m.key==='itBase')!;
 assert.equal(base.before,500000);
 assert.equal(base.now,1000000);
 assert.equal(base.change,500000);
 assert.equal(base.percent,100);
 assert.equal(describeMove(base),'up 100%');
});

test('a missing prior year is explained rather than shown as a fall to zero', () => {
 const r=priorYear(clean(),2027);
 assert.equal(r.prior.present,false);
 assert.deepEqual(r.movements,[],'no movements rather than everything down 100%');
 assert.match(r.summary,/No TY2026 records/);
 assert.match(r.summary,/have to come from that return/);
});

test('the earliest covered year says so instead of inventing a comparison', () => {
 const w=clean({receipts:[receipt({date:'2025-09-01'})] as never});
 const r=priorYear(w,EARLIEST_YEAR);
 assert.equal(r.prior.present,false);
 assert.match(r.summary,/earliest tax year this build's rules cover/);
});

test('a prior-year loss is flagged and never applied', () => {
 const w=clean({
  receipts:[receipt({date:'2025-09-01',category:'domestic',gross:'1000.00',rate:'1',
   taxBase:'0.00',withheld:'0.00',banking:false,evidence:''}),
   receipt({date:'2026-09-01'})] as never,
  expenses:[expense({date:'2025-09-20',amount:'50000.00'})] as never});
 const r=priorYear(workspaceSchema.parse(w),2027);
 assert.ok(r.possibleLoss>0,'the loss has to be surfaced');
 assert.match(r.lossNote,/Section 57/);
 assert.match(r.lossNote,/does not carry it forward/);
 assert.match(r.lossNote,/may be worth real money/);
 // And this year's figures must be untouched by it.
 const alone=figuresFor(workspaceSchema.parse(w),2027);
 assert.equal(alone.reserve,r.current.reserve);
});

test('with no loss it still says no loss is applied, so the absence is deliberate', () => {
 const r=priorYear(clean(),2027);
 assert.equal(r.possibleLoss,0);
 assert.match(r.lossNote,/No carried-forward loss is applied/);
 assert.match(r.lossNote,/outside what Hisaab models/);
});

test('describe avoids false precision on an empty base', () => {
 const m={label:'x',key:'profit' as const,now:0,before:0,change:0,percent:null};
 assert.equal(describeMove(m),'unchanged at nothing');
 assert.equal(describeMove({...m,now:100}),'new this year');
 assert.equal(describeMove({...m,before:100}),'nothing this year');
 assert.equal(describeMove({...m,now:50,before:100,change:-50,percent:-50}),'down 50%');
});
