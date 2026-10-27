/* The check you run before you file.

   estimate() already returns `reasons`: the things about a tax *profile* that
   need a person. This is the other half — the things about the *records* that
   would be caught by FBR, by a practitioner, or by arithmetic, and that are
   cheap to find now and expensive to find later.

   The distinction that matters here is between a **stop** and a **look**:

   - A stop means filing from these figures would declare something Hisaab can
     see is wrong or unsupported. Missing bank evidence on an export receipt,
     an unconfirmed tax base, a statement that does not add up.
   - A look means a figure is probably right but rests on a judgement Hisaab did
     not make. Mixed regimes, expense apportionment, a round number that smells
     like an estimate.

   Nothing here is a tax opinion. Every item points at a record you can open and
   a section you can read, and the list is deliberately finite: a checklist that
   cries wolf gets skipped, and a skipped checklist is worse than none. */
import Decimal from 'decimal.js';
import {estimate,receiptMath,inYear,money,type Workspace} from './core';
import {verifyBalances} from './statements';
import {irisStatus,IRIS_DRAFT_WARNING} from './iris';

export type Severity='stop'|'look';

export type Finding={
 id:string;
 severity:Severity;
 title:string;
 detail:string;
 /** Where to go and fix it, as a page the app knows about. */
 page:'Money'|'Tax'|'Pack'|'Settings';
 /** How many records are affected, when that is meaningful. */
 count:number;
 law:string;
};

export type PrefileReport={
 year:number;
 findings:Finding[];
 stops:Finding[];
 looks:Finding[];
 /** True only when nothing is a stop. Never means "correct" — means "nothing
     Hisaab can check is wrong". The wording in `verdict` says so. */
 fileable:boolean;
 verdict:string;
};

const f=(x:Omit<Finding,'count'>&{count?:number}):Finding=>({count:0,...x});

export function prefile(w:Workspace,year:number):PrefileReport{
 const e=estimate(w,year);
 const receipts=w.receipts.filter(r=>inYear(r.date,year));
 const expenses=w.expenses.filter(x=>inYear(x.date,year));
 const exports_=receipts.filter(r=>r.category==='it-export'||r.category==='service-export');
 const findings:Finding[]=[];

 /* ── Stops: things Hisaab can see are unsupported ──────────────────────── */

 if(!receipts.length)
  findings.push(f({id:'no-receipts',severity:'stop',title:'No income recorded for this tax year',
   detail:`There is nothing dated between July ${year-1} and June ${year}. Either the year selector is on the wrong year, or the records have not been entered yet.`,
   page:'Money',law:'s.114'}));

 const unbanked=exports_.filter(r=>!r.banking);
 if(unbanked.length)
  findings.push(f({id:'unbanked',severity:'stop',count:unbanked.length,
   title:'Export receipts not confirmed as realised through a bank',
   detail:'Section 154A taxes the PKR amount realised through an authorized dealer in Pakistan. Until that is confirmed, these are not yet the receipts the section applies to — money in a Payoneer or Wise balance has not been realised.',
   page:'Money',law:'s.154A'}));

 const unconfirmed=exports_.filter(r=>!r.baseConfirmed);
 if(unconfirmed.length)
  findings.push(f({id:'base-unconfirmed',severity:'stop',count:unconfirmed.length,
   title:'Gross PKR tax base not confirmed',
   detail:'The tax base is the gross PKR credited before the bank deducted tax, taken from the credit advice or the PRC. Using the amount that reached your account understates the base and the tax, which is the error FBR is most likely to find.',
   page:'Money',law:'s.154A'}));

 const noEvidence=exports_.filter(r=>!r.evidence.trim());
 if(noEvidence.length)
  findings.push(f({id:'no-evidence',severity:'stop',count:noEvidence.length,
   title:'No bank evidence recorded against export receipts',
   detail:'You need to be able to produce a credit advice, PRC or equivalent for each export receipt. Hisaab only records that you hold it; it cannot check that you do.',
   page:'Money',law:'s.71, s.154A'}));

 // A withheld amount larger than the base is arithmetically impossible.
 const impossible=receipts.filter(r=>new Decimal(r.withheld).gt(0)
  &&new Decimal(r.taxBase).gt(0)&&new Decimal(r.withheld).gt(r.taxBase));
 if(impossible.length)
  findings.push(f({id:'withheld-over-base',severity:'stop',count:impossible.length,
   title:'Tax deducted is larger than the tax base',
   detail:'On these receipts the bank is recorded as deducting more than the whole base. One of the two figures has been entered wrongly, or a foreign-currency amount has been mixed with a PKR one.',
   page:'Money',law:'s.154A, s.168'}));

 // Statement imports that do not reconcile against their own running balance.
 const broken=w.accounts.map(a=>{
  const lines=w.lines.filter(l=>l.accountId===a.id);
  if(!lines.length)return null;
  const chain=verifyBalances(lines);
  return chain.breaks.length?{account:a.label,breaks:chain.breaks.length}:null;
 }).filter(Boolean) as {account:string;breaks:number}[];
 if(broken.length)
  findings.push(f({id:'balance-breaks',severity:'stop',count:broken.reduce((n,b)=>n+b.breaks,0),
   title:'An imported statement does not add up',
   detail:`The running balance breaks in: ${broken.map(b=>b.account).join(', ')}. A break means a row was misread or a row is missing, so any total drawn from it is wrong. Fix the import before filing from it.`,
   page:'Money',law:''}));

 const pending=w.lines.filter(l=>l.status==='pending');
 if(pending.length)
  findings.push(f({id:'pending-lines',severity:'stop',count:pending.length,
   title:'Imported statement lines still unclassified',
   detail:'These rows have been imported but not yet marked as income, expense, transfer or excluded, so they are in no total. Anything genuinely irrelevant should be excluded explicitly rather than left pending.',
   page:'Money',law:''}));

 if(w.profile.confirmedYear!==year)
  findings.push(f({id:'profile-year',severity:'stop',
   title:'Tax profile was confirmed for a different year',
   detail:`The declarations behind the estimate were confirmed for TY${w.profile.confirmedYear}, not TY${year}. Registration, residency and the 154A conditions all have to hold for the year you are filing.`,
   page:'Settings',law:'s.154A'}));

 if(!w.profile.name.trim())
  findings.push(f({id:'no-name',severity:'stop',title:'No name on the workspace',
   detail:'The Filing Pack and any practitioner review are issued in a name. Add yours in Settings.',
   page:'Settings',law:''}));

 /* ── Looks: judgements Hisaab did not make ─────────────────────────────── */

 // estimate()'s own reasons are profile-level judgements; carry them through
 // rather than restating them, so there is one source for that wording.
 for(const [i,reason] of e.reasons.entries())
  findings.push(f({id:`estimate-reason-${i}`,severity:'look',
   title:'The estimate flags something for review',detail:reason,page:'Tax',law:''}));

 const fullBusiness=expenses.filter(x=>x.businessPct===100&&!x.evidence.trim());
 if(fullBusiness.length)
  findings.push(f({id:'full-business-no-evidence',severity:'look',count:fullBusiness.length,
   title:'Expenses claimed at 100% business use with no evidence noted',
   detail:'Wholly-business use is normal for some costs and questioned for others, especially anything that could be personal. Note what supports the apportionment while you still remember it.',
   page:'Money',law:'s.20–21, s.32–34'}));

 // Suspiciously round figures are usually estimates that were never replaced.
 const round=receipts.filter(r=>{
  const g=new Decimal(r.gross);
  return g.gt(10000)&&g.mod(10000).isZero();
 });
 if(round.length>=3)
  findings.push(f({id:'round-numbers',severity:'look',count:round.length,
   title:'Several receipts are exactly round numbers',
   detail:'That happens legitimately with fixed-fee work, and it also happens when a placeholder was typed and never corrected. Worth a glance against the bank.',
   page:'Money',law:''}));

 if(e.specialBase>0)
  findings.push(f({id:'social-media',severity:'look',
   title:'Social media or unclassified receipts are not in the estimate',
   detail:'Hisaab refuses to treat section 154B receipts as automatically final tax and computes no liability for them. These need a practitioner before you file.',
   page:'Tax',law:'s.154B'}));

 if(e.profit>0&&!w.profile.deductionsReviewed)
  findings.push(f({id:'deductions-unreviewed',severity:'look',
   title:'Expense deductibility has not been reviewed',
   detail:'You have domestic business profit, so which expenses are deductible and how they are apportioned changes the tax. Hisaab applies the percentages you entered and judges none of them.',
   page:'Settings',law:'s.20–21'}));

 const iris=irisStatus(year);
 if(!iris.ready)
  findings.push(f({id:'iris-draft',severity:'look',
   title:'IRIS field codes are not confirmed in this build',
   detail:IRIS_DRAFT_WARNING,page:'Pack',law:''}));

 const stops=findings.filter(x=>x.severity==='stop');
 const looks=findings.filter(x=>x.severity==='look');

 return {year,findings,stops,looks,fileable:stops.length===0,
  verdict:stops.length
   ? `${stops.length} thing${stops.length===1?'':'s'} to fix before these figures are safe to file from.`
   : looks.length
    ? `Nothing Hisaab can check is wrong. ${looks.length} item${looks.length===1?'':'s'} still rest on a judgement it did not make — read them, then have a practitioner confirm before filing.`
    : 'Nothing Hisaab can check is wrong. That is not the same as correct: it has not seen your bank, your assets or your service classification, and a practitioner should confirm before you file.'};
}
