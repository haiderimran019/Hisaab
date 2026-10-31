/* Record mutations use existing schemas. A proposal is an encrypted snapshot,
   never executable model output. Conflicts require a fresh user decision. */
import {receiptSchema,expenseSchema,invoiceSchema,workspaceSchema,type Workspace} from './core';
import type {ChatMessage} from './conversation';
export const parseRecord=(table:'receipts'|'expenses'|'invoices',raw:string)=>({receipts:receiptSchema,expenses:expenseSchema,invoices:invoiceSchema}[table]).parse(JSON.parse(raw));
export function decideRecord(w:Workspace,messageId:string,decision:'confirmed'|'rejected'|'undone',on:string){
 const m=w.conversation.messages.find(x=>x.id===messageId);if(!m?.record)throw Error('This record proposal is no longer available.');
 const r=m.record,record=parseRecord(r.table,r.after),rows=w[r.table] as {id:string}[],idx=rows.findIndex(x=>x.id===record.id),actual=idx<0?null:JSON.stringify(parseRecord(r.table,JSON.stringify(rows[idx])));
 if(r.before&&parseRecord(r.table,r.before).id!==record.id)throw Error('Proposal record identity mismatch. Make a fresh proposal.');
 if(decision==='undone'){
  if(m.decision!=='confirmed')throw Error('Only a confirmed change can be undone.');
  if(actual!==r.after)throw Error('This record changed after confirmation. Review it before undoing.');
  if(!r.before&&w.lines.some(l=>l.linkedId===record.id))throw Error('This record is linked to a statement line. Review that link before undoing.');
  if(r.before)rows[idx]=parseRecord(r.table,r.before);else rows.splice(idx,1);
 }else{
  if(m.decision!=='pending')throw Error('This proposal has already been decided.');
  if(decision==='confirmed'){
   if(actual!==r.before)throw Error('This record changed. Make a fresh proposal before confirming.');
   if(idx<0)rows.push(record);else rows[idx]=record;
  }
 }
 m.decision=decision;
 w.conversation.activity.push({id:crypto.randomUUID(),proposalId:m.id,recordId:record.id,decision,on});
 workspaceSchema.parse(w);
}
export function draftRecordMessage(w:Workspace,table:'receipts'|'expenses'|'invoices',record:unknown,base:Pick<ChatMessage,'month'|'year'|'language'>):ChatMessage{
 const parsed=parseRecord(table,JSON.stringify(record)),after=JSON.stringify(parsed),old=w[table].find(x=>x.id===parsed.id);
 return {...base,id:crypto.randomUUID(),role:'assistant',kind:'proposal',text:`${old?'Update':'Add'} ${table==='receipts'?'income':table==='expenses'?'expense':'invoice'}`,sourceIds:old?[old.id]:[],decision:'pending',record:{table,before:old?JSON.stringify(parseRecord(table,JSON.stringify(old))):null,after}};
}
