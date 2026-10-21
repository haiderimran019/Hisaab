/* Statement import: CSV → reviewable statement lines.
   Design rules that must not be relaxed:
   - A layout we cannot read fails loudly with the offending row numbers. It never
     guesses an amount, a date or a sign.
   - Nothing imported is income until a person classifies it.
   - A transfer between the user's own accounts is never income or spending.
   - Every line keeps its import batch, row number and original text. */
import Decimal from 'decimal.js';
import {type Account,type StatementLine,type Workspace,lineSchema} from './core';

export const MAX_FILE_BYTES=4_000_000;
export const MAX_ROWS=8000;

/** RFC 4180 style parser: quoted fields, doubled quotes, CR/LF inside quotes. */
export function parseCsv(input:string):string[][]{
 const text=input.replace(/^﻿/,'');
 const rows:string[][]=[];let row:string[]=[],field='',quoted=false,i=0;
 const endField=()=>{row.push(field);field='';};
 // Blank lines are kept so a row index always matches the line in the file the
 // customer is looking at. Rows with nothing in them are skipped later.
 const endRow=()=>{endField();rows.push(row);row=[];};
 while(i<text.length){
  const c=text[i];
  if(quoted){
   if(c==='"'){if(text[i+1]==='"'){field+='"';i+=2;continue;}quoted=false;i++;continue;}
   field+=c;i++;continue;
  }
  if(c==='"'){quoted=true;i++;continue;}
  if(c===','||c===';'||c==='\t'){endField();i++;continue;}
  if(c==='\r'){if(text[i+1]==='\n')i++;endRow();i++;continue;}
  if(c==='\n'){endRow();i++;continue;}
  field+=c;i++;
 }
 if(field!==''||row.length)endRow();
 return rows;
}

/** Many Pakistani bank exports put a title, account summary and blank lines above
    the real header. Pick the first row that looks like a header for a ledger. */
export function findHeader(rows:string[][]):number{
 const wanted=['date','description','particular','narration','detail','amount','debit','credit','withdraw','deposit','balance','transaction'];
 let best=-1,bestScore=0;
 for(let i=0;i<Math.min(rows.length,40);i++){
  const cells=rows[i].map(c=>c.trim().toLowerCase());
  if(cells.filter(c=>c!=='').length<2)continue;
  const score=cells.filter(c=>wanted.some(w=>c.includes(w))).length;
  if(score>bestScore){bestScore=score;best=i;}
 }
 return bestScore>=2?best:-1;
}

export type FieldName='date'|'description'|'counterparty'|'amount'|'debit'|'credit'|'drcr'|'balance';
export const fieldLabels:Record<FieldName,string>={
 date:'Transaction date',description:'Description / particulars',counterparty:'Client or counterparty',
 amount:'Signed amount (one column)',debit:'Debit / withdrawal',credit:'Credit / deposit',
 drcr:'Debit-or-credit marker',balance:'Balance after transaction'
};
const hints:Record<FieldName,string[]>={
 date:['value date','transaction date','date','posting date','trans date','txn date','paid on'],
 description:['description','particulars','narration','details','detail','remarks','reference','transaction details','memo'],
 counterparty:['counterparty','payer','payee','client','beneficiary','sender','merchant','name','to / from'],
 amount:['signed amount','amount (pkr)','amount','net amount','transaction amount','value'],
 debit:['debit','withdrawal','withdrawals','dr amount','paid out','outflow','money out','debit amount'],
 credit:['credit','deposit','deposits','cr amount','paid in','inflow','money in','credit amount'],
 drcr:['dr/cr','type','transaction type','debit/credit','dr cr','indicator'],
 balance:['balance','running balance','closing balance','balance after','available balance']
};
/** Best-effort column guess. The user confirms or corrects every mapping. */
export function suggestMapping(header:string[]):Partial<Record<FieldName,number>>{
 const cells=header.map(c=>c.trim().toLowerCase());
 const used=new Set<number>();const out:Partial<Record<FieldName,number>>={};
 const order:FieldName[]=['date','debit','credit','amount','drcr','balance','description','counterparty'];
 for(const field of order){
  let found=-1,bestLen=-1;
  for(const hint of hints[field])for(let i=0;i<cells.length;i++){
   if(used.has(i)||!cells[i])continue;
   const exact=cells[i]===hint,partial=cells[i].includes(hint);
   if(!exact&&!partial)continue;
   const score=exact?1000+hint.length:hint.length;
   if(score>bestLen){bestLen=score;found=i;}
  }
  if(found>=0){out[field]=found;used.add(found);}
 }
 // A single "amount" column alongside debit/credit columns is usually redundant.
 if(out.debit!==undefined&&out.credit!==undefined)delete out.amount;
 return out;
}

/** Pakistani exports mix "1,234.56", "(1,234.56)", "1234.56 Dr", "PKR 1,234.56" and "-". */
export function parseAmount(raw:string):Decimal|null{
 let s=(raw??'').toString().trim();
 // An empty cell, a dash or "n/a" means "nothing in this column", not zero.
 if(!s||/^[-–—]+$/.test(s)||/^n\/?a$/i.test(s)||/^nil$/i.test(s))return null;
 let negative=false;
 if(/^\(.*\)$/.test(s)){negative=true;s=s.slice(1,-1);}
 if(/\b(dr|debit)\b\.?$/i.test(s)){negative=true;}
 if(/\b(cr|credit)\b\.?$/i.test(s)){negative=false;}
 s=s.replace(/\b(dr|cr|debit|credit)\b\.?/gi,'');
 s=s.replace(/(pkr|rs\.?|usd|gbp|eur|aed|\$|£|€)/gi,'');
 s=s.replace(/[\s '’]/g,'');
 if(s.startsWith('-')){negative=true;s=s.slice(1);}
 else if(s.startsWith('+'))s=s.slice(1);
 if(/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s))s=s.replace(/\./g,'').replace(',','.'); // 1.234,56
 else s=s.replace(/,/g,'');
 if(!/^\d*(\.\d+)?$/.test(s)||s===''||s==='.')return null;
 const d=new Decimal(s);
 if(!d.isFinite()||d.abs().gt('99999999999'))return null;
 return negative?d.negated():d;
}

/** Accepts ISO, d/m/y, m/d/y when unambiguous, and "12 Aug 2026" style dates. */
const months:Record<string,number>={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12};
export function parseDate(raw:string,dayFirst=true):string|null{
 const s=(raw??'').toString().trim();
 if(!s)return null;
 const iso=s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
 if(iso)return iso8601(Number(iso[1]),Number(iso[2]),Number(iso[3]));
 const named=s.match(/^(\d{1,2})[-\s/]*([A-Za-z]{3,9})[-\s/]*(\d{2,4})/);
 if(named){const m=months[named[2].toLowerCase().slice(0,4)]??months[named[2].toLowerCase().slice(0,3)];
  if(m)return iso8601(fullYear(Number(named[3])),m,Number(named[1]));}
 const named2=s.match(/^([A-Za-z]{3,9})[-\s/]+(\d{1,2}),?[-\s/]+(\d{2,4})/);
 if(named2){const m=months[named2[1].toLowerCase().slice(0,4)]??months[named2[1].toLowerCase().slice(0,3)];
  if(m)return iso8601(fullYear(Number(named2[3])),m,Number(named2[2]));}
 const numeric=s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
 if(numeric){
  const a=Number(numeric[1]),b=Number(numeric[2]),y=fullYear(Number(numeric[3]));
  if(a>12&&b<=12)return iso8601(y,b,a);
  if(b>12&&a<=12)return iso8601(y,a,b);
  return dayFirst?iso8601(y,b,a):iso8601(y,a,b);
 }
 return null;
}
const fullYear=(y:number)=>y>=100?y:y>=70?1900+y:2000+y;
function iso8601(y:number,m:number,d:number):string|null{
 if(!y||!m||!d||m<1||m>12||d<1||d>31||y<1990||y>2100)return null;
 const iso=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
 const parsed=new Date(iso+'T00:00:00Z');
 return parsed.toISOString().slice(0,10)===iso?iso:null;
}

const squash=(s:string)=>s.toLowerCase().replace(/\s+/g,' ').replace(/[^a-z0-9 ./-]/g,'').trim().slice(0,120);
export const fingerprint=(accountId:string,date:string,description:string,amount:string)=>
 `${accountId}|${date}|${squash(description)}|${new Decimal(amount).toFixed(2)}`;

export type RowIssue={row:number;reason:string;raw:string};
/** Marks a row that repeats an earlier row of the same file. Only these can be
    cleared by the running balance; a file imported twice never is. */
export const REPEAT_IN_FILE='Looks like a repeat of an earlier row in this file.';
export type ChainBreak={row:number;expected:string;found:string;description:string};
export type BalanceChain={
 /** false when the file has no balance column to check against. */
 checked:boolean;
 verified:number;
 breaks:ChainBreak[];
 /** Duplicates the running balance proved were real, separate transactions. */
 rescued:number;
};
export type ParsedImport={
 lines:StatementLine[];issues:RowIssue[];duplicates:number;
 rowCount:number;mapping:Record<string,string>;header:string[];chain:BalanceChain;
};

/* The running balance is arithmetic the source document already committed to, so
   it is the one thing in a statement that can check itself. For every row,
   balance should equal the previous balance plus this row's amount.

   Two things fall out of that, and both matter more than they look:

   1. A row whose amount or sign was read wrongly breaks the chain at exactly that
      row. This is what makes it safe to accept rows from an unreliable reader —
      a PDF, a scan, or a language model — because a misread digit cannot satisfy
      arithmetic it did not control.
   2. A row flagged as a duplicate *within one file* is proved genuine when the
      balance still advances through it. Two identical payments on one day are
      real and common; without this they would be silently dropped.

   When a row breaks the chain we continue from the balance the document printed,
   not from our own running total, so one bad row cannot poison every row after it. */
export function verifyBalances(lines:StatementLine[]):BalanceChain{
 const withBalance=lines.filter(l=>l.balance!=='');
 if(withBalance.length<2)return {checked:false,verified:0,breaks:[],rescued:0};
 const ordered=[...lines].sort((a,b)=>a.row-b.row);
 let previous:Decimal|null=null;
 let verified=0,rescued=0;
 const breaks:ChainBreak[]=[];
 for(const line of ordered){
  if(line.balance===''){previous=null;continue;}   // a gap ends the run
  const stated:Decimal=new Decimal(line.balance);
  if(previous!==null){
   const expected:Decimal=previous.plus(line.amount);
   if(expected.equals(stated)){
    verified++;
    if(line.status==='duplicate'&&line.note===REPEAT_IN_FILE){
     // The balance moved through it, so it is a separate transaction after all.
     line.status='pending';
     line.note='Looked like a repeat, but the running balance proves it is a separate payment.';
     rescued++;
    }
   }else{
    breaks.push({row:line.row,expected:expected.toFixed(2),found:stated.toFixed(2),
     description:line.description.slice(0,80)});
   }
  }
  previous=stated;   // trust the document's own figure going forward
 }
 return {checked:true,verified,breaks,rescued};
}

export function buildImport(opts:{
 account:Account;existing:StatementLine[];rows:string[][];headerIndex:number;
 mapping:Partial<Record<FieldName,number>>;batchId:string;dayFirst?:boolean;
}):ParsedImport{
 const {account,existing,rows,headerIndex,mapping,batchId}=opts;
 const header=(rows[headerIndex]??[]).map(c=>c.trim());
 const body=rows.slice(headerIndex+1);
 if(body.length>MAX_ROWS)throw Error(`This file has ${body.length} rows. Hisaab imports up to ${MAX_ROWS} rows per file. Split the statement by month.`);
 if(mapping.date===undefined)throw Error('Choose which column holds the transaction date.');
 const hasSigned=mapping.amount!==undefined,hasPair=mapping.debit!==undefined||mapping.credit!==undefined;
 if(!hasSigned&&!hasPair)throw Error('Choose either one signed amount column, or the debit and credit columns.');
 const seen=new Set(existing.filter(l=>l.accountId===account.id).map(l=>l.fingerprint));
 const withinFile=new Set<string>();
 const lines:StatementLine[]=[];const issues:RowIssue[]=[];let duplicates=0;
 const cell=(r:string[],i?:number)=>i===undefined?'':(r[i]??'').toString().trim();
 body.forEach((raw,index)=>{
  const row=headerIndex+index+2; // 1-based spreadsheet row the user sees
  const joined=raw.join(' | ').slice(0,300);
  if(!raw.some(c=>c.trim()!==''))return;
  const date=parseDate(cell(raw,mapping.date),opts.dayFirst!==false);
  if(!date){issues.push({row,reason:`Could not read a date from "${cell(raw,mapping.date)||'(empty)'}"`,raw:joined});return;}
  let amount:Decimal|null=null;
  if(hasPair){
   const debit=parseAmount(cell(raw,mapping.debit)),credit=parseAmount(cell(raw,mapping.credit));
   const d=debit&&!debit.isZero()?debit.abs().negated():null, c=credit&&!credit.isZero()?credit.abs():null;
   if(d&&c){issues.push({row,reason:'Both a debit and a credit are filled in on the same row',raw:joined});return;}
   amount=d??c??((debit||credit)?new Decimal(0):null);
  }else{
   amount=parseAmount(cell(raw,mapping.amount));
   if(amount&&mapping.drcr!==undefined){
    const marker=cell(raw,mapping.drcr).toLowerCase();
    if(/^(d|dr|debit|withdraw)/.test(marker))amount=amount.abs().negated();
    else if(/^(c|cr|credit|deposit)/.test(marker))amount=amount.abs();
   }
  }
  if(amount===null){issues.push({row,reason:'Could not read an amount from this row',raw:joined});return;}
  if(amount.isZero()){issues.push({row,reason:'Amount is zero — check whether this row is a header, total or carried balance',raw:joined});return;}
  const description=cell(raw,mapping.description)||cell(raw,mapping.counterparty)||'(no description)';
  const fp=fingerprint(account.id,date,description,amount.toFixed(2));
  const alreadyImported=seen.has(fp),repeatedInFile=withinFile.has(fp);
  const isDuplicate=alreadyImported||repeatedInFile;
  if(isDuplicate)duplicates++;
  withinFile.add(fp);
  lines.push(lineSchema.parse({
   id:crypto.randomUUID(),batchId,accountId:account.id,date,
   description:description.slice(0,400),counterparty:cell(raw,mapping.counterparty).slice(0,400),
   amount:amount.toFixed(2),balance:(()=>{const b=parseAmount(cell(raw,mapping.balance));return b?b.toFixed(2):'';})(),
   fingerprint:fp,status:isDuplicate?'duplicate':'pending',linkedId:'',
   note:alreadyImported?'Matches a line already imported for this account.'
    :repeatedInFile?REPEAT_IN_FILE:'',row
  }));
 });
 // Only rows from this file are chained; previously imported lines are not in order here.
 const chain=verifyBalances(lines);
 for(const broken of chain.breaks){
  const index=lines.findIndex(l=>l.row===broken.row);
  if(index<0)continue;
  lines.splice(index,1);
  issues.push({row:broken.row,
   reason:`The running balance does not agree with this row: the statement shows ${broken.found} where ${broken.expected} would follow from the previous line. Check this row on your statement and enter it by hand.`,
   raw:broken.description});
 }
 const mappingRecord:Record<string,string>={};
 for(const [field,index] of Object.entries(mapping))if(index!==undefined)mappingRecord[field]=header[index as number]??`column ${(index as number)+1}`;
 return {lines,issues,duplicates:lines.filter(l=>l.status==='duplicate').length,
  rowCount:body.filter(r=>r.some(c=>c.trim()!=='')).length,mapping:mappingRecord,header,chain};
}

/** Opposite, equal-sized movements close together in time are very likely a
    transfer between the user's own accounts. They are only suggestions. */
export type TransferPair={out:StatementLine;in:StatementLine;days:number;sameAccount:boolean};
export function transferCandidates(w:Workspace,windowDays=4):TransferPair[]{
 const open=w.lines.filter(l=>l.status==='pending');
 const outs=open.filter(l=>new Decimal(l.amount).lt(0)),ins=open.filter(l=>new Decimal(l.amount).gt(0));
 const taken=new Set<string>();const pairs:TransferPair[]=[];
 const keywords=/(transfer|tfr|trf|own account|self|ibft|raast|funds? transfer|to my|withdraw to)/i;
 for(const out of outs){
  const target=new Decimal(out.amount).abs();
  const matches=ins.filter(i=>!taken.has(i.id)&&new Decimal(i.amount).eq(target))
   .map(i=>({i,days:Math.abs(Date.parse(i.date)-Date.parse(out.date))/86400000}))
   .filter(m=>m.days<=windowDays)
   .sort((a,b)=>a.days-b.days||(keywords.test(b.i.description)?1:0)-(keywords.test(a.i.description)?1:0));
  const best=matches[0];
  if(!best)continue;
  taken.add(best.i.id);taken.add(out.id);
  pairs.push({out,in:best.i,days:Math.round(best.days),sameAccount:best.i.accountId===out.accountId});
 }
 return pairs;
}
