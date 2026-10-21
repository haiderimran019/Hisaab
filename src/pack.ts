/* The Filing Pack: the thing a paying customer actually receives.
   One document a practitioner can review without asking for anything else, or that
   the customer can sit beside IRIS and type from.

   Two promises hold this together, and both are structural, not cosmetic:
   1. Every figure states where it came from — a statement line, an uploaded
      document reference, or an explicit declaration the customer made.
   2. Anything unexplained is printed on the front page, not buried. The pack is
      never made to look finished by hiding a difference. */
import Decimal from 'decimal.js';
import {estimate,reconcile,readiness,receiptMath,expenseMath,inYear,sum,money,escapeHTML as h,RULE_VERSION,SOURCES,type Workspace} from './core';

const fmt=(n:number)=>new Intl.NumberFormat('en-PK',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
const dateLabel=(d:string)=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(d));
const catLabel:Record<string,string>={'it-export':'IT / IT-enabled export','service-export':'Other service export',domestic:'Domestic freelance business','social-media':'Social media',other:'Unclassified'};

export function filingPack(w:Workspace,year:number,planLabel:string){
 const e=estimate(w,year);
 const state=readiness(w,year);
 const receipts=w.receipts.filter(r=>inYear(r.date,year));
 const expenses=w.expenses.filter(x=>inYear(x.date,year));
 const accounts=w.accounts.map(a=>reconcile(w,a.id));
 const sourceFor=(receiptId:string)=>w.lines.filter(l=>l.linkedId===receiptId).map(l=>{
  const account=w.accounts.find(a=>a.id===l.accountId);
  return `${account?.label??'account'} row ${l.row} · ${l.date} · ${fmt(money(l.amount))} ${account?.currency??''}`;
 });
 const byCategory=Object.entries(catLabel).map(([key,label])=>{
  const rows=receipts.filter(r=>r.category===key);
  if(!rows.length)return null;
  return {key,label,count:rows.length,
   grossPkr:sum(rows.map(r=>receiptMath(r).gross)),
   feesPkr:sum(rows.map(r=>receiptMath(r).fees)),
   withheldPkr:sum(rows.map(r=>r.withheld)),
   netPkr:sum(rows.map(r=>receiptMath(r).net)),
   taxBasePkr:sum(rows.map(r=>r.taxBase))};
 }).filter(Boolean) as {key:string;label:string;count:number;grossPkr:number;feesPkr:number;withheldPkr:number;netPkr:number;taxBasePkr:number}[];

 const checklist=[
  {item:'Bank statements covering the whole tax year for every account used for work',done:accounts.length>0&&accounts.every(a=>a.confirmed)},
  {item:'Every imported statement line classified',done:state.pending===0},
  {item:'Each account reconciles to its closing balance',done:accounts.length>0&&accounts.every(a=>a.balanced)},
  {item:'Export receipts marked as realized through an authorized dealer',done:receipts.filter(r=>['it-export','service-export'].includes(r.category)).every(r=>r.banking)},
  {item:'Gross realized tax base in PKR entered and confirmed for each export receipt',done:receipts.filter(r=>['it-export','service-export'].includes(r.category)).every(r=>r.baseConfirmed)},
  {item:'Withholding certificates collected for every deduction recorded',done:false,manual:true},
  {item:'Expense receipts attached or referenced for claimed deductions',done:expenses.filter(x=>x.deductible).every(x=>!!x.receipt||!!x.evidence.trim())},
  {item:'Wealth statement figures prepared (opening and closing assets)',done:false,manual:true},
  {item:'Tax profile reconfirmed for this tax year',done:w.profile.confirmedYear===year}
 ];

 const data={
  pack:'hisaab-filing-pack',packVersion:1,ruleVersion:RULE_VERSION,
  generatedAt:new Date().toISOString(),taxYear:year,period:`1 July ${year-1} to 30 June ${year}`,
  plan:planLabel,
  preparedFor:w.profile.name||'(name not entered)',
  reviewed:false,
  readiness:state,accounts,byCategory,
  estimate:e,
  profile:w.profile,
  receipts:receipts.map(r=>{const m=receiptMath(r);
   return {...r,grossPkr:m.gross,feesPkr:m.fees,withheldPkr:m.withheld,netPkr:m.net,sources:sourceFor(r.id)};}),
  expenses:expenses.map(x=>({...x,receipt:undefined,businessCostPkr:expenseMath(x),attachment:x.receipt?x.receipt.name:''})),
  statementSummary:w.accounts.map(a=>({account:a.label,lines:w.lines.filter(l=>l.accountId===a.id).length,
   batches:w.batches.filter(b=>b.accountId===a.id).map(b=>({file:b.filename,importedAt:b.importedAt,rows:b.rowCount,imported:b.imported,digest:b.digest}))})),
  unresolvedLines:w.lines.filter(l=>l.status==='pending').map(l=>({date:l.date,description:l.description,amount:l.amount,account:w.accounts.find(a=>a.id===l.accountId)?.label??'',row:l.row})),
  checklist,
  boundaries:[
   'Produced by software from records the customer entered or confirmed. It is not a tax return and not professional advice.',
   'No part of this pack has been reviewed by a Pakistani tax practitioner unless a signed review page is attached.',
   'Federal income tax only. No provincial or ICT sales tax, wealth reconciliation arithmetic, penalties, treaty relief, salary aggregation, capital allowances, loss carry-forward or super tax.',
   'Withholding shown is what the customer recorded. It is not confirmed against FBR records and is not automatically a refundable credit.',
   'Figures are rounded to two decimals for presentation.'
  ],
  sources:SOURCES
 };

 const statusClass=state.ready?'ok':'warn';
 const html=`<div class="invoice-paper pack">
  <div class="pack-head">
   <div><h1>Filing Pack</h1><p>${h(data.preparedFor)} · Tax year ${year} · ${h(data.period)}</p></div>
   <div class="pack-stamp"><b>Not reviewed</b><small>Software output · ${h(RULE_VERSION)}</small></div>
  </div>
  <p class="pack-meta">Generated ${h(new Date(data.generatedAt).toUTCString())} · Plan: ${h(planLabel)} · Pack format 1</p>

  <section class="pack-block ${statusClass}">
   <h2>${state.ready?'Nothing is unexplained in these records':'Resolve these before anyone relies on this pack'}</h2>
   ${state.blockers.length?`<ul>${state.blockers.map(b=>`<li>${h(b)}</li>`).join('')}</ul>`:'<p>Every imported line is classified and every account reconciles to its closing balance.</p>'}
   ${state.notes.length?`<p class="pack-note">Also worth knowing: ${state.notes.map(h).join(' ')}</p>`:''}
  </section>

  ${accounts.length?`<section class="pack-block"><h2>Accounts and reconciliation</h2>
   <table><thead><tr><th>Account</th><th>Opening</th><th>Movement</th><th>Closing on statement</th><th>Unexplained</th><th>Lines</th></tr></thead><tbody>
   ${accounts.map(a=>`<tr><td>${h(a.label)} <small>${h(a.currency)}</small></td><td>${fmt(a.opening)}</td><td>${fmt(a.movement)}</td><td>${fmt(a.closing)}</td><td class="${a.balanced?'':'bad'}">${a.balanced?'—':fmt(a.difference)}</td><td>${a.lines} <small>${a.pending} unclassified</small></td></tr>`).join('')}
   </tbody></table></section>`:'<section class="pack-block"><h2>Accounts and reconciliation</h2><p>No statements were imported. Income below is self-reported and has not been checked against a bank statement.</p></section>'}

  <section class="pack-block"><h2>Income received in TY${year}</h2>
   <table><thead><tr><th>Classification</th><th>Payments</th><th>Gross PKR</th><th>Fees PKR</th><th>Withheld PKR</th><th>Take-home PKR</th><th>Declared tax base PKR</th></tr></thead><tbody>
   ${byCategory.map(c=>`<tr><td>${h(c.label)}</td><td>${c.count}</td><td>${fmt(c.grossPkr)}</td><td>${fmt(c.feesPkr)}</td><td>${fmt(c.withheldPkr)}</td><td>${fmt(c.netPkr)}</td><td>${c.taxBasePkr?fmt(c.taxBasePkr):'—'}</td></tr>`).join('')||'<tr><td colspan="7">No income recorded for this tax year.</td></tr>'}
   </tbody></table>
   <p class="pack-note">Gross proceeds, fees, the declared tax base and net settlement are different quantities and are kept apart deliberately. The export tax base is the gross realized amount, not the net after fees.</p>
  </section>

  <section class="pack-block"><h2>Payment-by-payment detail</h2>
   <table><thead><tr><th>Date</th><th>Client</th><th>Received</th><th>Rate</th><th>Gross PKR</th><th>Take-home PKR</th><th>Evidence</th></tr></thead><tbody>
   ${data.receipts.map(r=>`<tr><td>${h(dateLabel(r.date))}</td><td>${h(r.client)}<br><small>${h(catLabel[r.category])} · ${h(r.rail)}</small></td><td>${h(r.currency)} ${fmt(Number(r.gross))}</td><td>${h(r.rate)}</td><td>${fmt(r.grossPkr)}</td><td>${fmt(r.netPkr)}</td><td><small>${r.sources.length?r.sources.map(h).join('<br>'):h(r.evidence||'declared without a statement reference')}</small></td></tr>`).join('')||'<tr><td colspan="7">No income recorded.</td></tr>'}
   </tbody></table></section>

  ${expenses.length?`<section class="pack-block"><h2>Business expenses claimed</h2>
   <table><thead><tr><th>Date</th><th>Vendor</th><th>Category</th><th>Amount</th><th>Business use</th><th>Business cost PKR</th><th>Deduction claimed</th></tr></thead><tbody>
   ${data.expenses.map(x=>`<tr><td>${h(dateLabel(x.date))}</td><td>${h(x.vendor)}</td><td>${h(x.category)}</td><td>${h(x.currency)} ${fmt(Number(x.amount))}</td><td>${x.businessPct}%</td><td>${fmt(x.businessCostPkr)}</td><td>${x.deductible?'Yes · domestic business':'No'}${x.attachment?` · receipt attached`:''}</td></tr>`).join('')}
   </tbody></table></section>`:''}

  <section class="pack-block"><h2>Tax scenario · ${h(RULE_VERSION)}</h2>
   <table><tbody>
    <tr><th>IT / ITeS export base</th><td>${fmt(e.itBase)}</td><th>Rate applied</th><td>${e.itRate}%${w.profile.pseb?' · PSEB registered declared':''}</td></tr>
    <tr><th>Other service export base</th><td>${fmt(e.serviceBase)}</td><th>Rate applied</th><td>1%</td></tr>
    <tr><th>Export tax at those rates</th><td>${fmt(e.exportTax)}</td><th>Export withholding recorded</th><td>${fmt(e.paidExport)}</td></tr>
    <tr><th>Domestic business receipts</th><td>${fmt(e.localBase)}</td><th>Reviewed deductions</th><td>${fmt(e.expenseDeduction)}</td></tr>
    <tr><th>Domestic taxable profit</th><td>${fmt(e.profit)}</td><th>Slab tax + surcharge</th><td>${fmt(e.business.total)}</td></tr>
    <tr><th>Total estimated federal tax</th><td><b>${fmt(e.reserve)}</b></td><th>Still to pay after recorded withholding</th><td><b>${fmt(e.balance)}</b></td></tr>
   </tbody></table>
   ${e.reasons.length?`<div class="pack-block warn inner"><h3>Why this is an estimate and not a liability</h3><ul>${e.reasons.map(r=>`<li>${h(r)}</li>`).join('')}</ul></div>`:'<p>No unsupported condition was detected for this profile. It remains an estimate, not advice.</p>'}
  </section>

  ${data.unresolvedLines.length?`<section class="pack-block warn"><h2>Unclassified statement lines (${data.unresolvedLines.length})</h2>
   <table><thead><tr><th>Account</th><th>Row</th><th>Date</th><th>Description</th><th>Amount</th></tr></thead><tbody>
   ${data.unresolvedLines.slice(0,120).map(l=>`<tr><td>${h(l.account)}</td><td>${l.row}</td><td>${h(l.date)}</td><td>${h(l.description)}</td><td>${fmt(money(l.amount))}</td></tr>`).join('')}
   </tbody></table>${data.unresolvedLines.length>120?`<p class="pack-note">${data.unresolvedLines.length-120} further lines are in the JSON export.</p>`:''}</section>`:''}

  <section class="pack-block"><h2>Document checklist</h2>
   <ul class="pack-check">${checklist.map(c=>`<li>${c.done?'☑':'☐'} ${h(c.item)}${(c as {manual?:boolean}).manual?' <small>(check yourself — Hisaab cannot confirm this)</small>':''}</li>`).join('')}</ul></section>

  <section class="pack-block"><h2>Declarations made by ${h(data.preparedFor)}</h2>
   <p>These are the customer's own statements, recorded in the app. They are not checks against FBR records.</p>
   <ul>${Object.entries(w.profile).filter(([k])=>!['name','province','confirmedYear'].includes(k)).map(([k,v])=>`<li>${h(k.replace(/([A-Z])/g,' $1').toLowerCase())}: <b>${v?'yes':'no'}</b></li>`).join('')}</ul>
   <p>Province / territory: <b>${h(w.profile.province)}</b> · Profile confirmed for TY${w.profile.confirmedYear}</p></section>

  <section class="pack-block"><h2>What this pack is not</h2>
   <ul>${data.boundaries.map(b=>`<li>${h(b)}</li>`).join('')}</ul>
   <h3>Sources relied on</h3>
   <ul>${SOURCES.slice(0,4).map(s=>`<li>${h(s.title)} — ${h(s.url)}</li>`).join('')}</ul></section>

  <section class="pack-block sign"><h2>Review and sign-off</h2>
   <div class="sign-grid">
    <div><p>Prepared by (customer)</p><div class="sign-line"></div><small>Name, date</small></div>
    <div><p>Reviewed by (practitioner)</p><div class="sign-line"></div><small>Name, NTN / registration, date</small></div>
   </div>
   <p class="pack-note">Until a practitioner signs above, this pack is unreviewed software output.</p></section>
 </div>`;
 return {data,html};
}
