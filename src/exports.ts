/* Local report tables. Every financial value comes from existing functions. */
import {receiptMath,expenseMath,estimate,inYear,csv,RULE_VERSION,type Workspace} from './core';
import {dateLabel} from './format';
export const exportKinds=['income','expenses','statements','tax-worksheet'] as const;
export type ExportKind=typeof exportKinds[number];
export type ReportTable={title:string;year:number;ruleVersion:string;headers:string[];rows:(string|number|boolean|null)[][]};
export function reportTable(w:Workspace,year:number,kind:ExportKind):ReportTable{
 const base={year,ruleVersion:RULE_VERSION};
 if(kind==='income')return {...base,title:'Income',headers:['Date','Client','Currency','Gross','Processor fee','PKR rate','Bank fee PKR','Withheld PKR','Net received PKR','Tax base PKR','Route','Evidence','Record ID'],rows:w.receipts.filter(r=>inYear(r.date,year)).map(r=>[dateLabel(r.date),r.client,r.currency,Number(r.gross),Number(r.fee),Number(r.rate),Number(r.bankFee),receiptMath(r).withheld,receiptMath(r).net,Number(r.taxBase),r.rail,r.evidence,r.id])};
 if(kind==='expenses')return {...base,title:'Expenses',headers:['Date','Vendor','Category','Currency','Amount','PKR rate','Business use %','Business cost PKR','Deduction claimed','Evidence','Record ID'],rows:w.expenses.filter(e=>inYear(e.date,year)).map(e=>[dateLabel(e.date),e.vendor,e.category,e.currency,Number(e.amount),Number(e.rate),e.businessPct,expenseMath(e),e.deductible,e.evidence||e.receipt?.name||'',e.id])};
 if(kind==='statements')return {...base,title:'Statements',headers:['Date','Account','Currency','Description','Signed amount','Status','Original row','Linked record','Record ID'],rows:w.lines.filter(l=>inYear(l.date,year)).map(l=>{const account=w.accounts.find(a=>a.id===l.accountId)!;return [dateLabel(l.date),account.label,account.currency,l.description,Number(l.amount),l.status,l.row,l.linkedId,l.id];})};
 const e=estimate(w,year);return {...base,title:'Tax worksheet',headers:['Metric','Amount PKR','Status / limitation'],rows:[['IT export base',e.itBase,'Bank evidence required'],['Other service export base',e.serviceBase,'Eligibility needs review'],['Modeled export tax',e.exportTax,'Estimate'],['Domestic gross',e.localBase,'Domestic business scenario'],['Claimed domestic expenses',e.expenseDeduction,'Deductibility needs review'],['Domestic taxable profit',e.profit,'Scenario'],['Business tax',e.business.base,'Estimate'],['Surcharge',e.business.surcharge,'Estimate'],['Modeled reserve',e.reserve,'Estimate'],['Export withholding',e.paidExport,'User-recorded'],['Domestic withholding',e.paidLocal,'User-recorded'],['Additional reserve',e.balance,'Estimate'],['Final liability',e.liability,e.liability===null?'Not finalized; review the eligibility gates':'Inputs confirmed; practitioner review still needed'],...e.reasons.map(r=>['Needs review',null,r])]};
}
export function reportCsv(table:ReportTable){
 return csv([['Hisaab report',table.title],['Tax year',table.year],['Rule version',table.ruleVersion],['Review status','Not reviewed / not a filed return'],[],table.headers,...table.rows]);
}
export async function reportXlsx(table:ReportTable):Promise<Blob>{
 const {default:writeExcelFile}=await import('write-excel-file/universal');
 const raw=[['Hisaab · '+table.title],['Tax year','TY '+table.year],['Rule version',table.ruleVersion],['Not reviewed / not a filed return'],[],table.headers,...table.rows];
 const cells=raw.map((row,i)=>row.map((value,column)=>value===null?null:{value,type:typeof value==='number'?Number:typeof value==='boolean'?Boolean:String,fontWeight:i===0||i===5?'bold' as const:undefined,...(typeof value==='number'?{format:table.headers[column]?.toLowerCase().includes('rate')?'0.000000':table.headers[column]==='Original row'?'0':'#,##0.00'}:{})}));
 return writeExcelFile(cells,{sheet:table.title,columns:table.headers.map((_,i)=>({width:i===0?26:22}))},{fontFamily:'Arial',fontSize:11}).toBlob();
}
