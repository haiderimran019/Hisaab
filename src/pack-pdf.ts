/* Local-only PDF generation. Text is painted using the installed app font so
   Urdu names remain intact; no untrusted HTML is evaluated. Loaded on demand. */
import type {filingPack} from './pack';
import {fmt,dateLabel} from './format';
export type PackData=ReturnType<typeof filingPack>['data'];
export function packText(data:PackData,note=''){
 const e=data.estimate;
 return [`Hisaab · Filing Pack · TY ${data.taxYear}`,`01/07/${data.taxYear-1} – 30/06/${data.taxYear}`,`For: ${data.preparedFor}`,`${data.reviewed?'Reviewed':'Not reviewed'} · ${data.unresolvedLines.length} unresolved statement lines`,
 `Rule version: ${data.ruleVersion}`,`Generated: ${dateLabel(data.generatedAt.slice(0,10))}`,
 'A worksheet for your accountant or IRIS, not a filed return.',...(note?['Your note: '+note]:[]),'',
 'FEDERAL WORKSHEET · estimate, not tax advice',
 `IT/ITeS export base: ${fmt(e.itBase)} · scenario rate: ${e.itRate}%`,
 `Other service export base: ${fmt(e.serviceBase)} · modeled export tax: ${fmt(e.exportTax)}`,
 `Domestic gross: ${fmt(e.localBase)} · processing fees: ${fmt(e.localFees)}`,
 `Claimed expenses: ${fmt(e.expenseDeduction)} · taxable-profit scenario: ${fmt(e.profit)}`,
 `Business tax: ${fmt(e.business.base)} · surcharge: ${fmt(e.business.surcharge)}`,
 `Modeled reserve: ${fmt(e.reserve)}`,`Withheld export: ${fmt(e.paidExport)} · domestic: ${fmt(e.paidLocal)}`,`Additional reserve: ${fmt(e.balance)}`,
 `Liability: ${e.liability===null?'Not finalized; review the eligibility gates':fmt(e.liability)}`,e.note,...e.reasons.map(r=>'Check: '+r),'',
 'ACCOUNT RECONCILIATION · each account in its own currency',
 ...data.accounts.flatMap(a=>[`${a.label} · ${a.currency} · ${a.confirmed?'Balances confirmed':'Balances not confirmed'}`,`Opening ${fmt(a.opening,a.currency)} · computed closing ${fmt(a.computedClosing,a.currency)} · statement closing ${fmt(a.closing,a.currency)} · difference ${fmt(a.difference,a.currency)}`,`${a.lines} lines · ${a.pending} pending · ${a.duplicates} duplicates excluded`]),'',
 'INCOME RECORDS · received payments only',
 ...data.receipts.flatMap(r=>[`${dateLabel(r.date)} · ${r.client||r.rail} · ${r.description}`,`Gross ${fmt(Number(r.gross),r.currency)} · processor fee ${fmt(Number(r.fee),r.currency)} · actual rate ${r.rate} PKR/${r.currency}`,`Bank fee ${fmt(Number(r.bankFee))} · withheld ${fmt(r.withheldPkr)} · received ${fmt(r.netPkr)}`,`Tax base ${fmt(Number(r.taxBase))} · ${r.category} · banking ${r.banking?'declared':'not confirmed'} · base ${r.baseConfirmed?'confirmed':'not confirmed'}`,`Evidence: ${r.evidence||'Not recorded'} · ID ${r.id}`,...r.sources.map(source=>'Statement: '+source)]),'',
 'BUSINESS EXPENSES',...data.expenses.flatMap(x=>[`${dateLabel(x.date)} · ${x.vendor} · ${x.category}`,`${fmt(Number(x.amount),x.currency)} × rate ${x.rate} · ${x.businessPct}% business use · cost ${fmt(x.businessCostPkr)}`,`Domestic deduction claimed: ${x.deductible?'yes':'no'} · evidence ${x.evidence||x.attachment||'not recorded'} · ID ${x.id}`]),'',
 'UNRESOLVED STATEMENT LINES',...data.unresolvedLines.map(l=>`${dateLabel(l.date)} · ${l.account} · row ${l.row} · ${l.amount} (account currency) · ${l.description}`),'',
 'DECLARATIONS · supplied by the customer',...Object.entries(data.profile).map(([key,value])=>`${key}: ${value}`),'',
 'CHECKLIST',...data.checklist.map(c=>`${c.done?'Done':'Needs review'}: ${c.item}`),'',
 'BOUNDARIES',...data.boundaries,'',
 'RULE SOURCES',...data.sources.flatMap(source=>[source.title,source.detail,source.url]),
 ...(data.review?[`Reviewed by ${data.review.name} · ${data.review.registration} · ${dateLabel(data.review.reviewedOn)}`,data.review.note]:[]),`Pack fingerprint: ${data.digest||'Not available'}`];
}
export async function makePackPDF(data:PackData,note='',signal?:AbortSignal){return makeTextPDF(packText(data,note),`hisaab-filing-pack-TY${data.taxYear}.pdf`,`Hisaab Filing Pack TY ${data.taxYear}`,`${data.ruleVersion} · ${data.reviewed?'Reviewed':'Not reviewed'} · Not a filed return`,data.taxYear,signal);}
export async function makeTextPDF(lines:string[],filename:string,title:string,subject:string,taxYear:number,signal?:AbortSignal){
 signal?.throwIfAborted();const {jsPDF}=await import('jspdf');await document.fonts.ready;signal?.throwIfAborted();
 const doc=new jsPDF({unit:'pt',format:'a4',compress:true});
 doc.setProperties({title:title,subject:subject,creator:'Hisaab · local browser export'});
 const canvas=document.createElement('canvas');canvas.width=900;canvas.height=1273;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('This browser cannot prepare a PDF. Use the print worksheet instead.');
 ctx.font='18px "Figtree Variable", sans-serif';
 const wrapped:string[]=[];
 for(const line of lines){
  let pending='';for(const word of line.split(/\s+/)){
   if(pending&&ctx.measureText(pending+' '+word).width>788){wrapped.push(pending);pending='';}
   if(ctx.measureText(word).width>788){for(const char of word){if(ctx.measureText(pending+char).width>788){wrapped.push(pending);pending='';}pending+=char;}}
   else pending+=(pending?' ':'')+word;
  }wrapped.push(pending);
 }
 const perPage=46,pages=Math.max(1,Math.ceil(wrapped.length/perPage));
 if(pages>300)throw Error('This pack is too large for a phone PDF. Export the worksheet JSON from Records → Export.');
 const tokens=getComputedStyle(document.documentElement),paper=tokens.getPropertyValue('--paper').trim(),ink=tokens.getPropertyValue('--paper-ink').trim();
 for(let page=0;page<pages;page++){
  signal?.throwIfAborted();
  if(page)doc.addPage();ctx.fillStyle=paper;ctx.fillRect(0,0,900,1273);ctx.fillStyle=ink;ctx.font='18px "Figtree Variable", sans-serif';
  wrapped.slice(page*perPage,(page+1)*perPage).forEach((line,i)=>ctx.fillText(line,56,64+i*24));
  ctx.font='16px "Figtree Variable", sans-serif';ctx.fillText(`Hisaab · TY ${taxYear} · ${page+1} / ${pages}`,56,1224);
  doc.addImage(canvas.toDataURL('image/jpeg',0.9),'JPEG',0,0,595.28,841.89,undefined,'FAST');
  await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
 }
 return {file:new File([doc.output('arraybuffer')],filename,{type:'application/pdf'}),pages};
}
