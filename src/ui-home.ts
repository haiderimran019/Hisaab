/* Home is a guide, not a dashboard.

   The old overview answered "how much have I earned". The question people actually
   arrive with is "what do I have to do, and am I finished". So Home is six steps in
   the order they must happen, each with one plain sentence and one button, plus the
   three money figures that matter in words people use out loud. */
import {reconcile,readiness,receiptMath,inYear,sum,escapeHTML as h,type Workspace} from './core';
import {icon,pkr,num} from './format';
import type {Ctx} from './ui-statements';

export type Step={
 key:string;title:string;blurb:string;done:boolean;current:boolean;
 action?:{label:string;page?:string;act?:string};detail?:string;
};

export function steps(ctx:Ctx):Step[]{
 const {workspace:w,year}=ctx;
 const pending=w.lines.filter(l=>l.status==='pending').length;
 const recs=w.accounts.map(a=>reconcile(w,a.id));
 const offBalance=recs.filter(r=>r.confirmed&&!r.balanced).length;
 const unconfirmed=recs.filter(r=>!r.confirmed).length;
 const state=readiness(w,year);
 const list:Omit<Step,'current'>[]=[
  {key:'profile',title:'Tell us about your work',
   blurb:`Your province, whether you are PSEB registered, and what kind of income you have. We ask once a year because the rules change each year.`,
   done:w.profile.confirmedYear===year&&!!w.profile.name.trim(),
   action:{label:w.profile.confirmedYear===year?'Review your answers':`Confirm for tax year ${year}`,page:'Settings'},
   detail:w.profile.confirmedYear===year?`Confirmed for TY${year}.`:`Last confirmed for TY${w.profile.confirmedYear}.`},
  {key:'accounts',title:'Add the accounts you get paid into',
   blurb:'One for each bank account or wallet that your work money passes through. You will need the statement in front of you for the opening and closing balance.',
   done:w.accounts.length>0,
   action:{label:w.accounts.length?'Manage accounts':'Add an account',page:'Statements',act:w.accounts.length?undefined:'new-account'},
   detail:w.accounts.length?`${w.accounts.length} account${w.accounts.length===1?'':'s'} added.`:undefined},
  {key:'import',title:'Import your statements',
   blurb:'Download the CSV from your bank portal and drop it in. Hisaab reads the rows so you do not have to type them, and tells you about anything it could not read.',
   done:w.batches.length>0,
   action:{label:w.batches.length?'Import another':'Import a statement',page:'Statements',act:'import-statement'},
   detail:w.batches.length?`${w.batches.length} file${w.batches.length===1?'':'s'} imported · ${w.lines.length} lines.`:undefined},
  {key:'classify',title:'Say what each payment was',
   blurb:'Client payment, business cost, or money you moved between your own accounts. Nothing counts as income until you say so — that decision is always yours, and always reversible.',
   done:w.lines.length>0&&pending===0,
   action:pending?{label:`Decide ${pending} line${pending===1?'':'s'}`,page:'Statements'}:undefined,
   detail:w.lines.length?(pending?`${pending} still waiting.`:'Every line has been decided.'):undefined},
  {key:'balance',title:'Make it balance',
   blurb:'Your lines should add up to the closing balance printed on your statement. If they do not, something is missing — and we will keep showing you the gap rather than quietly closing it.',
   done:w.accounts.length>0&&offBalance===0&&unconfirmed===0,
   action:(offBalance||unconfirmed)?{label:'Check the accounts',page:'Statements'}:undefined,
   detail:!w.accounts.length?undefined
    :unconfirmed?`${unconfirmed} account${unconfirmed===1?'':'s'} ${unconfirmed===1?'needs':'need'} its statement balances confirmed.`
    :offBalance?`${offBalance} account${offBalance===1?' does':'s do'} not balance yet.`
    :'Everything reconciles.'},
  {key:'pack',title:'Get your Filing Pack',
   blurb:'One document for your accountant, or to keep beside you while you file in IRIS. Every figure in it points back at a statement row or something you declared.',
   done:false,
   action:{label:state.ready?'Make the pack':'See what is left',page:'Reports'},
   detail:state.ready?'Nothing is unexplained. You are ready.':`${state.blockers.length} thing${state.blockers.length===1?'':'s'} to resolve first.`}
 ];
 const firstOpen=list.findIndex(s=>!s.done);
 return list.map((s,i)=>({...s,current:i===firstOpen}));
}

export function homeView(ctx:Ctx,estimated:{reserve:number;balance:number;reasons:string[]}){
 const {workspace:w,year}=ctx;
 const rows=w.receipts.filter(r=>inYear(r.date,year));
 const gross=sum(rows.map(r=>receiptMath(r).gross));
 const fees=sum(rows.map(r=>receiptMath(r).fees));
 const net=sum(rows.map(r=>receiptMath(r).net));
 const list=steps(ctx);
 const doneCount=list.filter(s=>s.done).length;
 const now=list.find(s=>s.current);
 const blur=w.security.blurAmounts?' blurred':'';
 const money=(v:number)=>`<b class="figure${blur}">${h(pkr(v))}</b>`;
 const unpaid=w.invoices.filter(i=>i.status==='Sent');

 return `<section class="hero">
  <div class="hero-main">
   <p class="hero-eyebrow">Tax year ${year} · 1 July ${year-1} to 30 June ${year}</p>
   <h2>${now?h(now.title):'You are ready to file'}</h2>
   <p class="hero-blurb">${now?h(now.blurb):'Every line is decided, every account balances, and your Filing Pack is ready to print.'}</p>
   ${now?.action?`<button class="btn primary big" ${now.action.act?`data-action="${now.action.act}"`:`data-page="${now.action.page}"`}>${h(now.action.label)} ${icon('arrow-right')}</button>`
    :`<button class="btn primary big" data-page="Reports">Make the pack ${icon('arrow-right')}</button>`}
  </div>
  <div class="hero-progress">
   <div class="rail" role="img" aria-label="${doneCount} of ${list.length} steps done">
    ${list.map(s=>`<i class="${s.done?'on':''}"></i>`).join('')}
   </div>
   <p><b>${doneCount} of ${list.length}</b> steps done</p>
  </div>
 </section>

 <div class="money-row">
  <div class="money-card"><span>${icon('arrow-down-left')}What reached you</span>${money(net)}
   <small>After the processor's cut and bank charges${w.security.blurAmounts?'':`, from ${rows.length} payment${rows.length===1?'':'s'}`}</small></div>
  <div class="money-card"><span>${icon('arrow-up-right')}Lost to fees</span>${money(fees)}
   <small>${gross>0?`${(fees/gross*100).toFixed(1)}% of what clients paid`:'Nothing recorded yet'}</small></div>
  <div class="money-card accent"><span>${icon('landmark')}Keep aside for tax</span>${money(estimated.reserve)}
   <small>${estimated.reasons.length?'An estimate with open questions — see Tax':`Still to pay: ${pkr(estimated.balance)}`}</small></div>
 </div>

 <section class="panel steps-panel">
  <div class="panel-head"><div><h2>Your tax year, step by step</h2>
   <p>Work down the list. You can stop anywhere and come back — nothing is submitted to anyone.</p></div></div>
  <ol class="steps">
   ${list.map((s,i)=>`<li class="step ${s.done?'done':s.current?'now':'later'}">
    <span class="step-mark">${s.done?icon('check'):i+1}</span>
    <div class="step-body">
     <h3>${h(s.title)}${s.current?'<span class="step-tag">do this next</span>':''}</h3>
     <p>${h(s.blurb)}</p>
     ${s.detail?`<p class="step-detail">${h(s.detail)}</p>`:''}
    </div>
    ${s.action?`<button class="btn ${s.current?'primary':'ghost'} step-btn" ${s.action.act?`data-action="${s.action.act}"`:`data-page="${s.action.page}"`}>${h(s.action.label)}</button>`:''}
   </li>`).join('')}
  </ol>
 </section>

 ${unpaid.length?`<section class="panel"><div class="panel-head"><div><h2>Waiting to be paid</h2>
  <p>Sent invoices that have not arrived yet. These are not income until the money lands.</p></div>
  <button class="text-link" data-page="Invoices">All invoices ${icon('arrow-right')}</button></div>
  <div class="table-scroll"><table class="cards"><thead><tr><th>Invoice</th><th>Client</th><th>Due</th><th>Amount</th></tr></thead><tbody>
  ${unpaid.slice(0,5).map(i=>`<tr><td data-label="Invoice">${h(i.number)}</td><td data-label="Client">${h(i.client)}</td>
   <td data-label="Due">${h(i.due)}</td><td data-label="Amount">${h(i.currency)} ${num(Number(i.quantity)*Number(i.unitPrice))}</td></tr>`).join('')}
  </tbody></table></div>
  <p class="muted small">${unpaid.length} invoice${unpaid.length===1?'':'s'} unpaid. Amounts are shown in the currency each was invoiced in — they are not converted here, because what you actually receive depends on the rate and fees on the day it settles.</p></section>`:''}`;
}
