/* PSEB registration: what it is worth, and what Hisaab is allowed to say.

   This is the largest single number in the product. The same export receipts
   are taxed at 0.25% with a PSEB IT/ITeS registration and 1% without — four
   times the tax, on an identical base. A freelancer billing PKR 6,000,000 a
   year is deciding whether to spend an afternoon on a registration that is
   worth PKR 45,000 a year, and nobody has ever put that number in front of
   them.

   So: compute the difference exactly, from their own records. And refuse to do
   the three things that would make it a lie.

   1. **It does not check registration.** PSEB keeps its own register. Hisaab
      has no connection to it, holds a declaration, and verifies nothing.
   2. **It does not decide whether a service is IT or ITeS.** That is a
      classification question with real money on it and it belongs to a
      practitioner. Hisaab asks which category a receipt is and uses the answer.
   3. **It does not promise the saving.** The 0.25% rate carries the whole
      section 154A condition set with it. Failing any one of those conditions
      changes the answer, so the conditions are listed beside the figure rather
      than assumed away. */
import Decimal from 'decimal.js';
import {money,sum,inYear,type Workspace} from './core';

export const PSEB_RATE=0.0025;
export const OTHER_RATE=0.01;
export const PSEB_URL='https://www.pseb.org.pk/';

export type PsebCondition={id:string;label:string;met:boolean;law:string;note:string};

export type PsebAssessment={
 /** The IT/ITeS base the lower rate could apply to, from their own receipts. */
 itBase:number;
 /** What that base costs at each rate. */
 atPseb:number;
 atOther:number;
 /** The annual difference. Zero when there is no IT/ITeS base to apply it to. */
 saving:number;
 /** What they have declared today. */
 registered:boolean;
 /** True when there is an IT/ITeS base, so the question is live at all. */
 relevant:boolean;
 /** Section 154A conditions, each as declared. Not a judgement of whether the
     declaration is true — only of whether it has been made. */
 conditions:PsebCondition[];
 /** Conditions not yet confirmed. While this is non-empty the saving is
     conditional and the app must say so. */
 unmet:string[];
 /** Safe to present the saving as the likely outcome. */
 clear:boolean;
 headline:string;
 caveat:string;
};

/** Receipts in scope: IT/ITeS exports only. Other service exports are taxed at
    1% whether or not PSEB registration exists, so they are not part of this. */
const itReceipts=(w:Workspace,year:number)=>
 w.receipts.filter(r=>r.category==='it-export'&&inYear(r.date,year));

export function assessPseb(w:Workspace,year:number):PsebAssessment{
 const rows=itReceipts(w,year);
 const itBase=sum(rows.map(r=>r.taxBase));
 const atPseb=money(new Decimal(itBase).mul(PSEB_RATE));
 const atOther=money(new Decimal(itBase).mul(OTHER_RATE));
 const saving=money(new Decimal(atOther).minus(atPseb));
 const p=w.profile;
 const relevant=rows.length>0;

 /* The section 154A condition set. Hisaab already collects every one of these
    as a declaration on the tax profile; this gathers them where the money is,
    because a condition is easier to care about next to what it is worth. */
 const conditions:PsebCondition[]=[
  {id:'pseb',label:'Registered with PSEB as an IT / ITeS exporter',met:p.pseb,
   law:'TY2027 rate card p.9',
   note:`Registration is with PSEB, not FBR, at ${PSEB_URL}. Hisaab records what you tell it and checks nothing.`},
  {id:'banking',label:'Every export receipt realised through an authorized dealer',
   met:rows.every(r=>r.banking),law:'s.154A',
   note:'The tax point is the PKR realisation through a bank in Pakistan. Money sitting in a Payoneer or Wise balance has not been realised yet.'},
  {id:'base',label:'Gross PKR tax base confirmed for every receipt',
   met:rows.every(r=>r.baseConfirmed),law:'s.154A',
   note:'From the bank credit advice or the PRC — the gross before the bank deducted tax, not the amount that reached your account.'},
  {id:'evidence',label:'Bank evidence held for every export receipt',
   met:rows.every(r=>r.evidence.trim().length>0),law:'s.71, s.154A',
   note:'A credit advice, PRC or equivalent you could produce if asked.'},
  {id:'return',label:'Income tax return filed',met:p.returnFiled,law:'s.114',
   note:'Filing the return is itself one of the final-tax conditions.'},
  {id:'statements',label:'Required withholding statements filed',met:p.statementsFiled,law:'s.165',
   note:''},
  {id:'sales',label:'Applicable sales tax returns filed',met:p.salesReturns,law:'provincial / ICT',
   note:'Which authority applies depends on your province and your service classification.'},
  {id:'no-credit',label:'No foreign tax credit claimed',met:p.noForeignCredit,law:'s.154A',
   note:''},
  {id:'no-opt-out',label:'Not opted out of the final tax regime',met:p.noOptOut,law:'s.154A',
   note:''},
 ];

 const unmet=conditions.filter(c=>!c.met).map(c=>c.id);
 // "Clear" means every condition is declared and the registration is in place.
 const clear=relevant&&unmet.length===0;

 const headline=!relevant
  ? 'Record an IT or ITeS export receipt and Hisaab will show what PSEB registration is worth to you.'
  : p.pseb
   ? `You have declared PSEB registration, which models your IT export tax at ${PSEB_RATE*100}% instead of ${OTHER_RATE*100}% — a difference of PKR ${saving.toLocaleString('en-PK')} on this year's base.`
   : `PSEB registration would model your IT export tax at ${PSEB_RATE*100}% instead of ${OTHER_RATE*100}%. On this year's base that is PKR ${saving.toLocaleString('en-PK')}.`;

 const caveat=unmet.length
  ? 'This figure assumes every section 154A condition is met. '
    +`${unmet.length} ${unmet.length===1?'is':'are'} not confirmed yet, and the lower rate depends on all of them.`
  : 'Hisaab cannot verify your PSEB registration or decide whether your service is IT / ITeS. Both are declarations you are responsible for, and a practitioner should confirm the classification.';

 return {itBase,atPseb,atOther,saving,registered:p.pseb,relevant,conditions,unmet,clear,headline,caveat};
}

/** What registering is worth over the remaining life of the concession, for
    somebody deciding whether it is worth the afternoon. The extension to 2029
    is in docs/TAX-RULES.md; beyond it nothing is assumed. */
export const CONCESSION_THROUGH=2029;

export function savingThrough(assessment:PsebAssessment,fromYear:number){
 const years=Math.max(0,CONCESSION_THROUGH-fromYear+1);
 return {years,total:money(new Decimal(assessment.saving).mul(years)),
  note:years
   ?`At this year's base, over the ${years} tax year${years===1?'':'s'} the 0.25% rate is legislated to run (through TY${CONCESSION_THROUGH}). Your base will change; this is arithmetic on today's figures, not a forecast.`
   :`The 0.25% rate is legislated through TY${CONCESSION_THROUGH}. Nothing is assumed beyond it.`};
}
