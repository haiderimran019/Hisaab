/* Deterministic, read-only analysis. Statement descriptions are never executed or
   interpreted as instructions. Account currencies are never silently combined. */
import Decimal from 'decimal.js';
import {receiptMath,expenseMath,invoiceTotal,reconcile,readiness,estimate,inYear,sum,money,type Workspace} from './core';

export type AnalysisAction={kind:'review-records'|'review-account'|'review-tax';recordIds:string[];accountId?:string};
export type AnalysisGroup={label:string;amountPKR:number;sourceRecordIds:string[];action:AnalysisAction};
const normal=(v:string)=>v.trim().toLocaleLowerCase().replace(/\s+/g,' ');
const action=(ids:string[]):AnalysisAction=>({kind:'review-records',recordIds:ids});
const groups=<T extends {id:string}>(rows:T[],label:(r:T)=>string,value:(r:T)=>number):AnalysisGroup[]=>{
 const grouped=new Map<string,{label:string;rows:T[]}>();
 for(const row of rows){const text=label(row).trim()||'Not specified',key=normal(text);const g=grouped.get(key)??{label:text,rows:[]};g.rows.push(row);grouped.set(key,g);}
 return [...grouped.values()].map(g=>({label:g.label,amountPKR:sum(g.rows.map(value)),sourceRecordIds:g.rows.map(x=>x.id),action:action(g.rows.map(x=>x.id))})).sort((a,b)=>b.amountPKR-a.amountPKR);
};
const previousMonth=(month:string)=>{const [y,m]=month.split('-').map(Number);return `${m===1?y-1:y}-${String(m===1?12:m-1).padStart(2,'0')}`;};
function summary(w:Workspace,month:string){
 const rs=w.receipts.filter(r=>r.date.startsWith(month+'-')),es=w.expenses.filter(e=>e.date.startsWith(month+'-'));
 const receivedPKR=sum(rs.map(r=>receiptMath(r).net)),outPKR=sum(es.map(expenseMath));
 return {period:month,inPKR:sum(rs.map(r=>receiptMath(r).gross)),receivedPKR,outPKR,
  feesPKR:sum(rs.map(r=>receiptMath(r).fees)),withheldPKR:sum(rs.map(r=>receiptMath(r).withheld)),
  // Withholding is not money the user has separately kept aside.
  taxKeptAsidePKR:null as number|null,netPKR:sum([receivedPKR,-outPKR]),
  sourceRecordIds:[...rs,...es].map(r=>r.id),action:action([...rs,...es].map(r=>r.id))};
}
/* Index candidate payments once; a receipt can support at most one Sent invoice.
   A candidate is still explicitly not a confirmed invoice-payment link. */
export function unmatchedInvoices(w:Workspace){
 const key=(client:string,currency:string,amount:Decimal.Value)=>JSON.stringify([normal(client),currency,new Decimal(amount).toString()]);
 const candidates=new Map<string,typeof w.receipts>();
 for(const r of w.receipts){const k=key(r.client,r.currency,r.gross),rows=candidates.get(k)??[];rows.push(r);candidates.set(k,rows);}
 for(const rows of candidates.values())rows.sort((a,b)=>a.date.localeCompare(b.date));
 return [...w.invoices].filter(i=>i.status==='Sent').sort((a,b)=>a.date.localeCompare(b.date)).filter(i=>{
  const rows=candidates.get(key(i.client,i.currency,invoiceTotal(i)));if(!rows)return true;
  while(rows.length&&rows[0].date<i.date)rows.shift();if(rows.length){rows.shift();return false;}return true;
 }).map(i=>({invoiceId:i.id,client:i.client,currency:i.currency,amount:invoiceTotal(i),sourceRecordIds:[i.id],reason:'No matching payment found; invoice references are not linked automatically.',action:action([i.id])}));
}
/* Rolling, date-batched medians avoid rescanning the workspace for each charge.
   Same-day charges never become each other's prior baseline. */
function unusual<T extends {id:string;date:string}>(rows:T[],key:(row:T)=>string,value:(row:T)=>number){
 const grouped=new Map<string,T[]>(),found:{row:T;amount:number;median:number;ids:string[]}[]=[];
 for(const row of rows){const k=key(row),group=grouped.get(k)??[];group.push(row);grouped.set(k,group);}
 for(const group of grouped.values()){
  group.sort((a,b)=>a.date.localeCompare(b.date));const prior:T[]=[],values:number[]=[];
  for(let at=0;at<group.length;){let end=at;while(end<group.length&&group[end].date===group[at].date)end++;
   if(prior.length>=3){const mid=Math.floor(values.length/2),median=values.length%2?values[mid]:money(new Decimal(values[mid-1]).plus(values[mid]).div(2));
    for(let i=at;i<end;i++){const amount=value(group[i]);if(median>0&&new Decimal(amount).gt(new Decimal(median).mul(3)))found.push({row:group[i],amount,median,ids:[group[i].id,...prior.map(r=>r.id)]});}}
   for(let i=at;i<end;i++){const amount=value(group[i]);let lo=0,hi=values.length;while(lo<hi){const mid=(lo+hi)>>>1;if(values[mid]<amount)lo=mid+1;else hi=mid;}values.splice(lo,0,amount);prior.push(group[i]);}at=end;
  }
 }
 return found;
}
export function analyzeWorkspace(w:Workspace,options:{year:number;month:string}){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(options.month))throw Error('Choose a valid month.');
 const {year,month}=options;
 const tax=estimate(w,year),state=readiness(w,year);
 const rs=w.receipts.filter(r=>inYear(r.date,year)),es=w.expenses.filter(e=>inYear(e.date,year));
 const monthly=summary(w,month),previous=summary(w,previousMonth(month));
 const byClient=groups(rs,r=>r.client,r=>receiptMath(r).net),bySource=groups(rs,r=>r.rail,r=>receiptMath(r).net);
 const spendingByCategory=groups(es,e=>e.category,expenseMath);
 const recurring=groups(es,e=>e.vendor,expenseMath).filter(g=>{
  const months=[...new Set(es.filter(e=>g.sourceRecordIds.includes(e.id)).map(e=>e.date.slice(0,7)))].sort();
  return months.some((m,i)=>i>0&&previousMonth(m)===months[i-1]);
 }).map(g=>({...g,months:[...new Set(es.filter(e=>g.sourceRecordIds.includes(e.id)).map(e=>e.date.slice(0,7)))].sort(),yearlyTotalPKR:g.amountPKR,projected:false as const}));
 const cashFlow=w.accounts.map(a=>{
  const rows=w.lines.filter(l=>l.accountId===a.id&&l.status!=='duplicate').sort((a,b)=>a.date.localeCompare(b.date)||a.row-b.row||a.id.localeCompare(b.id));
  let balance=new Decimal(a.opening);
  const trend=rows.map(l=>{balance=balance.plus(l.amount);return {date:l.date,balance:money(balance),recordId:l.id};});
  return {accountId:a.id,label:a.label,currency:a.currency,period:{from:a.periodStart,to:a.periodEnd},opening:money(a.opening),trend,
   closing:money(balance),reconciliation:reconcile(w,a.id),sourceRecordIds:rows.map(l=>l.id),action:{kind:'review-account' as const,recordIds:rows.map(l=>l.id),accountId:a.id}};
 });
 const unusualCharges=unusual(es,e=>normal(e.vendor),expenseMath).map(x=>({vendor:x.row.vendor,amountPKR:x.amount,usualPKR:x.median,sourceRecordIds:x.ids,action:action(x.ids)}));
 const fingerprints=new Map<string,typeof w.lines>();
 for(const line of w.lines){const key=line.accountId+':'+line.fingerprint;const rows=fingerprints.get(key)??[];rows.push(line);fingerprints.set(key,rows);}
 const duplicates=w.lines.filter(line=>line.status==='duplicate'||(fingerprints.get(line.accountId+':'+line.fingerprint)??[]).slice(1).some(l=>l.id===line.id)).map(line=>{
  const ids=(fingerprints.get(line.accountId+':'+line.fingerprint)??[line]).map(l=>l.id);return {recordId:line.id,accountId:line.accountId,sourceRecordIds:ids,action:action(ids)};
 });
 const unusualStatementCharges=unusual(w.lines.filter(l=>new Decimal(l.amount).lt(0)&&l.status!=='duplicate'&&l.status!=='transfer'&&l.counterparty.trim()),l=>JSON.stringify([l.accountId,normal(l.counterparty)]),l=>money(new Decimal(l.amount).abs())).map(x=>({recordId:x.row.id,vendor:x.row.counterparty,amount:x.amount,usual:x.median,currency:w.accounts.find(a=>a.id===x.row.accountId)!.currency,sourceRecordIds:x.ids,action:action(x.ids)}));
 const missingReceiptEvidence=rs.filter(r=>!r.evidence.trim()||(['it-export','service-export'].includes(r.category)&&(!r.banking||!r.baseConfirmed)));
 const missingExpenseEvidence=es.filter(e=>!e.evidence.trim()&&!e.receipt);
 return {period:month,taxYear:year,ruleVersion:tax.ruleVersion,monthly:{...monthly,previous,change:{inPKR:sum([monthly.inPKR,-previous.inPKR]),outPKR:sum([monthly.outPKR,-previous.outPKR]),netPKR:sum([monthly.netPKR,-previous.netPKR])}},
  byClient,bySource,byMonth:Array.from({length:12},(_,i)=>summary(w,`${i<6?year-1:year}-${String((i+6)%12+1).padStart(2,'0')}`)),
  spendingByCategory,recurring,cashFlow,
  problems:{duplicates,
   unexplained:cashFlow.filter(a=>!a.reconciliation.balanced||!a.reconciliation.confirmed),
   unclassified:w.lines.filter(l=>l.status==='pending').map(l=>({recordId:l.id,sourceRecordIds:[l.id],action:action([l.id])})),unmatchedInvoices:unmatchedInvoices(w),unusualCharges,unusualStatementCharges},
  taxReadiness:{ready:state.ready&&tax.liability!==null,blockers:state.blockers,reasons:tax.reasons,missingReceiptEvidence:missingReceiptEvidence.map(r=>r.id),missingExpenseEvidence:missingExpenseEvidence.map(e=>e.id),psebStatus:w.profile.pseb?'Declared, evidence needs review':'Not declared',sourceRecordIds:[...rs,...es,...w.lines,...w.accounts].map(r=>r.id),action:{kind:'review-tax' as const,recordIds:[]}},
  disclaimer:'Estimate, not tax or financial advice. Patterns are suggestions for review.'};
}
export type WorkspaceAnalysis=ReturnType<typeof analyzeWorkspace>;
