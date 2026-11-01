import type {Workspace} from './core';
export function redactForAI(text:string,w:Workspace){
 let result=text;const names=[...w.receipts.map(r=>r.client),...w.invoices.map(i=>i.client),...w.accounts.map(a=>a.reference),w.profile.name].filter(s=>s.trim().length>=2).sort((a,b)=>b.length-a.length);
 for(const name of new Set(names))result=result.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'giu'),'[name or account removed]');
 return result.replace(/\bPK\d{2}[A-Z0-9 ]{16,34}\b/gi,'[IBAN removed]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email removed]').replace(/\b\d{5}-\d{7}-\d\b/g,'[identity number removed]').replace(/\b\d[\d -]{8,}\d\b/g,'[account or phone number removed]');
}
export function previewRequest(message:string,history:{role:'user'|'assistant';content:string}[],w:Workspace){return {message:redactForAI(message,w).slice(0,2000),history:history.slice(-6).map(m=>({role:m.role,content:redactForAI(m.content,w).slice(0,600)}))};}
