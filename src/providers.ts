/* Payoneer, Wise and the platforms — and the tax point everyone gets wrong.

   The parser in statements.ts is header-driven and generic, which is right: it
   handles any CSV a Pakistani bank exports. What it cannot do is know that a
   Payoneer or Wise export is **not a bank statement**, and that difference is
   not cosmetic — it changes what is taxable and when.

   Section 154A taxes the PKR amount *realised through an authorized dealer in
   Pakistan*. A payment landing in a Payoneer or Wise balance has not been
   realised: no Pakistani bank has seen it, no PKR amount exists yet, and no tax
   has been deducted. The realisation happens later, when that balance is
   withdrawn to a Pakistani account, and the tax base is the gross PKR the bank
   credits — a different number, on a different date, with a different exchange
   rate.

   So importing a gateway export and treating each row as a taxable receipt
   double-counts income and dates it wrongly. This file exists to make that
   impossible to do by accident: every gateway profile carries
   `realisation:'later'`, and the import flow shows its warning rather than
   burying it.

   Header lists below are recognition hints, not a schema. They were written
   from the shape these exports take, and a file that does not match still
   imports — the user confirms every column mapping either way. */
import type {FieldName} from './statements';

export type Realisation=
 /** A Pakistani bank account: a credit here is the realisation event. */
 |'here'
 /** A foreign balance: realisation happens on withdrawal to a Pakistani bank. */
 |'later';

export type Provider={
 id:string;
 label:string;
 /** Matches the `rail` on a receipt, where one applies. */
 rail:'Payoneer'|'Wise'|'Bank transfer'|'Upwork'|'Fiverr'|'Other';
 /** Lowercased header fragments. Two or more matching is treated as a hit. */
 signature:string[];
 /** Extra column hints merged over the generic ones for this provider. */
 hints:Partial<Record<FieldName,string[]>>;
 /** Whether rows are usually already in PKR. */
 pkrNative:boolean;
 realisation:Realisation;
 /** Shown before the import is accepted. The whole point of the file. */
 warning:string;
 note:string;
};

export const PROVIDERS:Provider[]=[
 {id:'payoneer',label:'Payoneer',rail:'Payoneer',
  signature:['payoneer','target id','additional description','transaction type'],
  hints:{date:['transaction date','date'],description:['description','additional description'],
   counterparty:['target id','payer','description'],amount:['amount'],
   credit:['credit amount'],debit:['debit amount'],balance:['running balance','balance']},
  pkrNative:false,realisation:'later',
  warning:'A Payoneer export is not a bank statement. Money in a Payoneer balance has not been realised through an authorized dealer, so it is not yet a section 154A receipt and no PKR tax base exists for it. Import this to see what you earned and when — then record the receipt from the PKR credit your Pakistani bank gives you on withdrawal.',
  note:'Payoneer\'s own fee rows and currency conversions appear as separate lines. They are costs, not income, and should be classified as expenses or excluded rather than netted off by hand.'},

 {id:'wise',label:'Wise',rail:'Wise',
  signature:['transferwise id','wise','exchange rate','payer name','payee name','running balance'],
  hints:{date:['date','created on','finished on'],description:['description','reference','payment reference'],
   counterparty:['payer name','merchant','payee name'],amount:['amount'],
   balance:['running balance'],credit:['amount in','paid in'],debit:['amount out','paid out']},
  pkrNative:false,realisation:'later',
  warning:'A Wise export is not a bank statement. A balance held in Wise has not been realised through an authorized dealer in Pakistan, so it is not yet a section 154A receipt. Import it for the record of what you earned — then record the receipt from your Pakistani bank\'s PKR credit advice.',
  note:'Wise exports carry the exchange rate it used. That rate is not the one your tax base is built on: the base is the gross PKR your bank credits on withdrawal, which will differ.'},

 {id:'upwork',label:'Upwork',rail:'Upwork',
  signature:['upwork','ref id','freelancer','contract','milestone'],
  hints:{date:['date'],description:['description','type','contract'],
   counterparty:['client','team','agency'],amount:['amount'],balance:['balance']},
  pkrNative:false,realisation:'later',
  warning:'An Upwork export is a platform ledger, not a bank statement. Its rows include the platform fee as a separate entry, and nothing here has been realised through an authorized dealer in Pakistan yet, so these are not section 154A receipts. Record those from your bank\'s PKR credit when you withdraw.',
  note:'Upwork\'s service fee is a cost of earning the income and is usually recorded as a fee on the receipt rather than as a separate expense. Pick one and be consistent, or the same cost gets claimed twice.'},

 {id:'fiverr',label:'Fiverr',rail:'Fiverr',
  signature:['fiverr','order id','net amount','gig'],
  hints:{date:['date'],description:['description','type','gig'],counterparty:['from','buyer'],
   amount:['amount','net amount'],balance:['balance']},
  pkrNative:false,realisation:'later',
  warning:'A Fiverr export is a platform ledger, not a bank statement. Nothing here has been realised through an authorized dealer in Pakistan, so these rows are not yet section 154A receipts.',
  note:'Fiverr reports a net amount after its commission. If you record the net as your gross, you understate both income and the fee you are entitled to account for.'},

 {id:'bank',label:'Pakistani bank account',rail:'Bank transfer',
  signature:['iban','account number','value date','particulars','narration','withdrawal','deposit'],
  hints:{},pkrNative:true,realisation:'here',
  warning:'',
  note:'This is where realisation happens. The gross PKR credited here, before any tax deducted, is the section 154A tax base — take it from the credit advice or the PRC rather than from the net figure that reached your balance.'},
];

/** Best guess at which provider a file came from, or null for an unknown
    export, which still imports through the generic mapping. Two signature hits
    are required, so a single common word like "date" cannot decide it. */
export function detectProvider(header:string[]):Provider|null{
 const joined=header.map(c=>c.trim().toLowerCase()).join('|');
 let best:{provider:Provider;hits:number}|null=null;
 for(const provider of PROVIDERS){
  const hits=provider.signature.filter(s=>joined.includes(s)).length;
  if(hits>=2&&(!best||hits>best.hits))best={provider,hits};
 }
 return best?.provider??null;
}

export const providerById=(id:string)=>PROVIDERS.find(p=>p.id===id)??null;

/** Merges a provider's hints over the generic header hints. Provider hints come
    first so they win a tie, and the generic list still catches everything else. */
export function hintsFor(provider:Provider|null,generic:Record<FieldName,string[]>){
 if(!provider)return generic;
 const merged={...generic};
 for(const [field,extra] of Object.entries(provider.hints) as [FieldName,string[]][])
  merged[field]=[...extra,...generic[field].filter(h=>!extra.includes(h))];
 return merged;
}

/** True when rows from this file must not be recorded as export receipts
    directly. The import flow uses this to require an acknowledgement. */
export const needsRealisationWarning=(provider:Provider|null)=>
 provider!==null&&provider.realisation==='later';

/** The general version, for an unrecognised foreign export. */
export const GENERIC_GATEWAY_WARNING=
 'If this file came from a payment platform rather than a Pakistani bank, the rows '
 +'are not section 154A receipts: the money has not been realised through an '
 +'authorized dealer yet. Record export receipts from your bank\'s PKR credit advice.';
