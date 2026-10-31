/* Estimates from a customer's own receipts, not current market offers.
   No tax rate is introduced here: the PSEB comparison reuses estimate(). */
import {estimate,receiptMath,expenseMath,inYear,sum,type Workspace} from './core';
import {analyzeWorkspace} from './analysis';
export function savingTips(w:Workspace,year:number,month:string){
 const rs=w.receipts.filter(r=>inYear(r.date,year)),es=w.expenses.filter(e=>inYear(e.date,year)),e=estimate(w,year),a=analyzeWorkspace(w,{year,month});
 const routes=[...new Set(rs.map(r=>r.rail))].map(rail=>{const rows=rs.filter(r=>r.rail===rail);return {rail,fees:sum(rows.map(r=>receiptMath(r).fees)),gross:sum(rows.map(r=>receiptMath(r).gross)),ids:rows.map(r=>r.id)};}).sort((a,b)=>b.fees-a.fees);
 const tips:{title:string;amount:number|null;detail:string;ids:string[];action:string}[]=[];
 if(routes.length)tips.push({title:'Fees by receiving method',amount:sum(routes.map(r=>r.fees)),detail:routes.map(r=>`${r.rail}: PKR ${r.fees} fees on PKR ${r.gross} gross`).join(' · ')+'. FX gap is not estimated: dated reference quotes are not stored.',ids:rs.map(r=>r.id),action:'Review receipt fees'});
 if(!w.profile.pseb&&e.itBase>0){const eligible=structuredClone(w);eligible.profile.pseb=true;const other=estimate(eligible,year);tips.push({title:'PSEB registration check',amount:sum([e.exportTax,-other.exportTax]),detail:'Conditional difference using your realized IT/ITeS income. Registration and service certification, tax-year declarations and existing eligibility gates require review. This does not declare you eligible.',ids:rs.filter(r=>r.category==='it-export').map(r=>r.id),action:'Review PSEB evidence'});}
 tips.push({title:'Tax reserve',amount:e.balance,detail:'Additional working estimate after recorded withholding. Actual money kept aside is unknown; no savings account balance has been assumed.',ids:rs.map(r=>r.id),action:'Review tax estimate'});
 const missing=es.filter(x=>!x.evidence&&!x.receipt);if(missing.length)tips.push({title:'Expenses missing evidence',amount:sum(missing.map(expenseMath)),detail:'Keep receipts before asking a practitioner whether these costs are deductible. Export gross proceeds are not reduced by these costs.',ids:missing.map(x=>x.id),action:'Review expense evidence'});
 for(const r of a.recurring)tips.push({title:`Repeat spending · ${r.label}`,amount:r.yearlyTotalPKR,detail:`Recorded total during TY ${year}, across ${r.months.length} months. This is observed spending, not a forecast.`,ids:r.sourceRecordIds,action:'Review repeat payments'});
 return tips;
}
