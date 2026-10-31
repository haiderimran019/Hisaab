import {reportTable,reportCsv,reportXlsx,type ExportKind,type ReportTable} from './exports';
import {filingPack} from './pack';
import {analyzeWorkspace} from './analysis';
import {invoiceTotal,inYear,RULE_VERSION,type Workspace} from './core';
import type {ChatMessage} from './conversation';
import {dateLabel} from './format';
export function fileRequest(text:string,w:Workspace,year:number,month:string):ChatMessage['file']|null{
 if(!/excel|xlsx|csv|pdf|export|json|فائل/i.test(text))return null;
 const format=/pdf/i.test(text)?'pdf':/csv/i.test(text)?'csv':/json/i.test(text)?'json':'xlsx';
 const kind:ExportKind=/expense|kharch|خرچ/i.test(text)?'expenses':/statement|اسٹیٹمنٹ/i.test(text)?'statements':/tax|worksheet|ٹیکس/i.test(text)?'tax-worksheet':'income';
 if(/pack|پیک/i.test(text))return {name:`hisaab-filing-pack-TY${year}.pdf`,format:'pdf',snapshot:JSON.stringify({type:'pack',data:filingPack(w,year,'Free preview').data,note:w.conversation.packNotes[String(year)]||''})};
 let table:ReportTable=reportTable(w,year,kind);
 if(/invoice/i.test(text)){
 const invoices=w.invoices.filter(i=>inYear(i.date,year));if(invoices.length!==1)return null;
 const i=invoices[0];table={...table,title:`Invoice ${i.number}`,headers:['Number','Issuer','Client','Issue date','Due','Description','Currency','Quantity','Unit price','Total','Status','Notes'],rows:[[i.number,i.issuer,i.client,dateLabel(i.date),dateLabel(i.due),i.description,i.currency,i.quantity,Number(i.unitPrice),invoiceTotal(i),i.status,i.notes]]};
 }
 if(/monthly summary|is mahine|ماہانہ/i.test(text)){const a=analyzeWorkspace(w,{year,month}).monthly;table={...table,title:`Monthly summary ${month}`,headers:['Metric','PKR'],rows:[['Gross in',a.inPKR],['Received',a.receivedPKR],['Business out',a.outPKR],['Fees',a.feesPKR],['Withheld',a.withheldPKR],['Net cash',a.netPKR],['Tax kept aside',null]]};}
 return {name:`hisaab-${table.title.toLowerCase().replace(/[^a-z0-9-]/g,'-')}-TY${year}.${format}`,format,snapshot:JSON.stringify({type:'table',table})};
}
export async function generateChatFile(f:NonNullable<ChatMessage['file']>,signal?:AbortSignal):Promise<File>{
 signal?.throwIfAborted();const value=JSON.parse(f.snapshot);let blob:Blob;
 if(value.type==='json')return new File([JSON.stringify(value.data,null,2)],f.name,{type:'application/json'});
 if(value.type==='pack'){const {makePackPDF}=await import('./pack-pdf');return (await makePackPDF(value.data,value.note,signal)).file;}
 const t=value.table as ReportTable;
 if(f.format==='xlsx')blob=await reportXlsx(t);
 else if(f.format==='csv')blob=new Blob([reportCsv(t)],{type:'text/csv;charset=utf-8'});
 else if(f.format==='json')blob=new Blob([JSON.stringify(t,null,2)],{type:'application/json'});
 else{const {makeTextPDF}=await import('./pack-pdf');return (await makeTextPDF([t.title,`Tax year ${t.year} · ${t.ruleVersion||RULE_VERSION}`,'Not reviewed / not a filed return',...t.rows.map(row=>row.map((v,i)=>`${t.headers[i]}: ${v===null?'Not recorded':v}`).join(' · '))],f.name,t.title,`${t.ruleVersion} · not reviewed / not a filed return`,t.year,signal)).file;}
 signal?.throwIfAborted();return new File([blob],f.name,{type:blob.type});
}
