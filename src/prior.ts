/* Last year, next to this year — and the loss Hisaab will not carry for you.

   Two different things get called "carry-forward", and conflating them is how a
   tool ends up filing something wrong.

   **The comparison.** IRIS asks for prior-year figures, and a filer with last
   year's records in the same workspace should not have to re-derive them. That
   is arithmetic over records Hisaab already holds, and it is safe.

   **The loss.** Carrying a business loss forward against future income is
   section 57, with its own ordering rules, its own six-year limit and its own
   interaction with the final-tax regime. estimate() already says in its own
   note that it does not do this. This file does not quietly start: when last
   year shows a loss, it says there may be something to carry and that a
   practitioner has to handle it.

   The difference matters because the honest version is still useful. "Your
   domestic business ran at a loss last year and that may be worth something
   this year — ask" is a real piece of help. Computing it wrongly is not. */
import Decimal from 'decimal.js';
import {estimate,receiptMath,inYear,money,sum,type Workspace} from './core';

export type YearFigures={
 year:number;
 /** True when the workspace holds any record dated in that year at all. */
 present:boolean;
 receipts:number;
 grossReceipts:number;
 itBase:number;
 serviceBase:number;
 exportTax:number;
 localBase:number;
 expenseDeduction:number;
 profit:number;
 businessTax:number;
 withheld:number;
 reserve:number;
};

export function figuresFor(w:Workspace,year:number):YearFigures{
 const rows=w.receipts.filter(r=>inYear(r.date,year));
 const present=rows.length>0||w.expenses.some(e=>inYear(e.date,year));
 if(!present)
  return {year,present:false,receipts:0,grossReceipts:0,itBase:0,serviceBase:0,exportTax:0,
   localBase:0,expenseDeduction:0,profit:0,businessTax:0,withheld:0,reserve:0};
 const e=estimate(w,year);
 return {year,present:true,receipts:e.receipts,
  grossReceipts:sum(rows.map(r=>receiptMath(r).gross)),
  itBase:e.itBase,serviceBase:e.serviceBase,exportTax:e.exportTax,
  localBase:e.localBase,expenseDeduction:e.expenseDeduction,profit:e.profit,
  businessTax:e.business.total,withheld:sum([e.paidExport,e.paidLocal]),reserve:e.reserve};
}

export type Movement={label:string;key:keyof YearFigures;now:number;before:number;
 change:number;percent:number|null};

const MOVEMENTS:[string,keyof YearFigures][]=[
 ['Gross receipts','grossReceipts'],
 ['IT / ITeS export base','itBase'],
 ['Other export services base','serviceBase'],
 ['Domestic receipts','localBase'],
 ['Deductible expenses','expenseDeduction'],
 ['Business profit','profit'],
 ['Tax already deducted','withheld'],
 ['Modelled reserve','reserve'],
];

export type PriorYearReport={
 current:YearFigures;
 prior:YearFigures;
 /** Only populated when both years hold records. */
 movements:Movement[];
 /** A loss that section 57 might allow against this year. Hisaab never applies
     it; this is the flag that one exists. */
 possibleLoss:number;
 lossNote:string;
 /** What to say when there is no prior year in this workspace. */
 summary:string;
};

/** Tax years are named for the year they end in, so the prior year is simply
    one less. TY2026 is the earliest the rules in this build cover. */
export const EARLIEST_YEAR=2026;

export function priorYear(w:Workspace,year:number):PriorYearReport{
 const current=figuresFor(w,year);
 const before=year-1;
 const prior=before<EARLIEST_YEAR
  ? {...figuresFor(w,year),year:before,present:false,receipts:0,grossReceipts:0,itBase:0,
     serviceBase:0,exportTax:0,localBase:0,expenseDeduction:0,profit:0,businessTax:0,
     withheld:0,reserve:0}
  : figuresFor(w,before);

 const movements:Movement[]=prior.present&&current.present
  ? MOVEMENTS.map(([label,key])=>{
     const now=current[key] as number,was=prior[key] as number;
     const change=money(new Decimal(now).minus(was));
     return {label,key,now,before:was,change,
      percent:was?Number(new Decimal(change).div(was).mul(100).toDecimalPlaces(1)):null};
    })
  : [];

 /* A loss only arises on the domestic side: export receipts are taxed on their
    gross base under the final regime, so no loss can arise there to carry. */
 const priorDomesticLoss=prior.present
  ? money(Decimal.max(0,new Decimal(prior.expenseDeduction)
     .minus(prior.localBase).plus(0)))
  : 0;

 const lossNote=priorDomesticLoss>0
  ? `Your TY${before} domestic expenses exceeded domestic receipts by PKR `
    +`${priorDomesticLoss.toLocaleString('en-PK')}. Section 57 may allow a business loss `
    +`to be carried forward, with its own ordering rules and time limit, and its `
    +`interaction with the section 154A final regime is not straightforward. `
    +`**Hisaab does not carry it forward and no figure in this year's estimate `
    +`includes it.** Take this number to a practitioner; it may be worth real money.`
  : `No carried-forward loss is applied to any figure in this estimate. Section 57 `
    +`losses are outside what Hisaab models, so if you believe you have one, it has `
    +`to be handled outside the app.`;

 const summary=!current.present
  ? `No records dated in TY${year}.`
  : !prior.present
   ? before<EARLIEST_YEAR
     ? `TY${year} is the earliest tax year this build's rules cover, so there is nothing to compare it with.`
     : `No TY${before} records in this workspace, so there is nothing to compare TY${year} with. If you filed last year elsewhere, the prior-year figures IRIS asks for have to come from that return.`
   : `TY${year} against TY${before}, from the records in this workspace.`;

 return {current,prior,movements,possibleLoss:priorDomesticLoss,lossNote,summary};
}

/** Plain words for one movement, avoiding false precision on small bases. */
export function describe(m:Movement){
 if(m.before===0&&m.now===0)return 'unchanged at nothing';
 if(m.before===0)return 'new this year';
 if(m.now===0)return 'nothing this year';
 if(m.percent===null)return m.change>=0?'higher':'lower';
 const direction=m.change>=0?'up':'down';
 return `${direction} ${Math.abs(m.percent)}%`;
}
