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

export function homeView(ctx:Ctx,estimated:{reserve:number;balance:number;reasons:string[];itBase:number;itRate:number}){
 const {workspace:w}=ctx,month=ctx.today.slice(0,7),rows=w.receipts.filter(r=>r.date.startsWith(month));
 const net=sum(rows.map(r=>receiptMath(r).net)),fees=sum(rows.map(r=>receiptMath(r).fees));
 const pending=w.lines.filter(l=>l.status==='pending').length,gaps=w.accounts.map(a=>reconcile(w,a.id)).filter(r=>!r.confirmed||!r.balanced).length;
 const label=new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T00:00:00Z'));
 const amount=(v:number)=>`<strong class="${w.security.blurAmounts?'figure blurred':'figure'}">${h(pkr(v))}</strong>`;
 return `<section class="home-messenger"><div class="home-greeting"><span class="brand-mark" lang="ur" aria-hidden="true">ح</span><h1>Let’s sort out your finances.</h1><p>${h(label)}</p></div><div class="home-cards">
 <button class="home-card money-arrived" data-chat-prompt="Reached you this month"><span>Reached you this month</span>${amount(net)}<small>after ${h(pkr(fees))} lost to fees</small>${icon('arrow-up-right')}</button>
 <button class="home-card" data-chat-prompt="What do I owe in tax?"><span>Keep aside for tax</span>${amount(estimated.balance)}<small>TY ${ctx.year} · ${estimated.itRate}% IT export scenario · estimate</small>${icon('arrow-up-right')}</button>
 <button class="home-card" data-chat-prompt="Show problems needing attention"><span>Needs your attention</span><strong>${pending} unclassified lines</strong><small>${gaps?`${gaps} account balances to check`:'Account balances reconcile'}</small>${icon('arrow-up-right')}</button>
 </div></section>`;
}
