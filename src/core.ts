import Decimal from 'decimal.js';
import { z } from 'zod';
Decimal.set({ precision: 32, rounding: Decimal.ROUND_HALF_UP });
export const RULE_VERSION = 'PK-2026-10-21.1';
export const ORDINANCE = 'https://download1.fbr.gov.pk/Docs/2026724177725705IncomeTaxOrdinanace2001.pdf';
export const SOURCES = [
 {title:'Income Tax Ordinance, amended 30 June 2026',url:ORDINANCE,detail:'Sections 4AB, 18–21, 71, 74, 114, 116, 154A, 154B, 168–169; First and Tenth Schedules. Operative text takes precedence over rate cards.'},
 {title:'FBR withholding rate card · TY2027',url:'https://download1.fbr.gov.pk/Docs/202681113864992WithholdingTaxRatesCard2027.pdf',detail:'Page 9: 154A export services, 0.25% PSEB IT/ITeS through TY2029; 1% other cases. Page 9: 154B social media. Read with Ordinance.'},
 {title:'FBR withholding rate card · TY2026',url:'https://download1.fbr.gov.pk/Docs/20258181281745641WHT-RateCard.pdf',detail:'Cross-check only. Its non-ATL 154A column conflicts with Tenth Schedule rule 10(ca); this app follows the Ordinance and does not double 154A.'},
 {title:'FBR · Filing and income tax guidance',url:'https://www.fbr.gov.pk/income-tax/51147/61148',detail:'Registration, income tax return and wealth statement. Worksheet exports are not official returns.'},
 {title:'Punjab Revenue Authority',url:'https://pra.punjab.gov.pk/',detail:'Service classification, place of supply, export conditions and provincial registration require review.'},
 {title:'Sindh Revenue Board',url:'https://www.srb.gos.pk/',detail:'Sindh service sales tax is separate from federal income tax.'},
 {title:'Khyber Pakhtunkhwa Revenue Authority',url:'https://kpra.kp.gov.pk/',detail:'Check current schedules and notifications for your service.'},
 {title:'Balochistan Revenue Authority',url:'https://bra.gob.pk/',detail:'Check current schedules and notifications for your service.'},
 {title:'FBR · Islamabad Capital Territory services',url:'https://www.fbr.gov.pk/',detail:'ICT service tax requires separate classification and current schedule review.'}
];
const text = z.string().trim().max(400);
const amount = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, 'Use a positive amount with at most 2 decimals');
const rate = z.string().regex(/^\d{1,5}(\.\d{1,6})?$/).refine(v=>new Decimal(v).gt(0),'Rate must be greater than zero');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v,'Invalid date');
export const currencies = ['USD','GBP','EUR','AED','PKR'] as const;
export const categories = ['it-export','service-export','domestic','social-media','other'] as const;
export const receiptSchema = z.object({id:z.string().uuid(),date,client:text.min(1),description:text,currency:z.enum(currencies),gross:amount,fee:amount,rate,bankFee:amount,withheld:amount,rail:z.enum(['Payoneer','Wise','Bank transfer','Upwork','Fiverr','Other']),category:z.enum(categories),evidence:text,banking:z.boolean(),taxBase:amount,baseConfirmed:z.boolean()}).strict().superRefine((v,c)=>{
 if(new Decimal(v.gross).mul(v.rate).mul(100).gt(Number.MAX_SAFE_INTEGER))c.addIssue({code:'custom',message:'Converted amount exceeds safe precision',path:['gross']});
 if(new Decimal(v.fee).gt(v.gross)) c.addIssue({code:'custom',message:'Processor fee cannot exceed gross income',path:['fee']});
 if(v.baseConfirmed&&['it-export','service-export'].includes(v.category)&&new Decimal(v.taxBase).lte(0)) c.addIssue({code:'custom',message:'Confirmed export tax base must exceed zero',path:['taxBase']});
 if(new Decimal(v.gross).eq(0)) c.addIssue({code:'custom',message:'Income must exceed zero',path:['gross']});
 if(v.currency==='PKR'&&!new Decimal(v.rate).eq(1))c.addIssue({code:'custom',message:'PKR rate must be 1',path:['rate']});
 if(new Decimal(v.gross).minus(v.fee).mul(v.rate).minus(v.bankFee).minus(v.withheld).lt(0))c.addIssue({code:'custom',message:'Fees and withholding exceed proceeds',path:['withheld']});
});
const attachment = z.object({name:text,mime:z.enum(['image/png','image/jpeg','application/pdf']),data:z.string().max(2800000).regex(/^data:(image\/(png|jpeg)|application\/pdf);base64,[A-Za-z0-9+/=]+$/)}).strict().nullable();
export const expenseSchema=z.object({id:z.string().uuid(),date,vendor:text.min(1),category:z.enum(['Software','Internet','Equipment','Office','Travel','Other']),amount,currency:z.enum(currencies),rate,businessPct:z.number().min(0).max(100),deductible:z.boolean(),evidence:text,receipt:attachment}).strict().superRefine((v,c)=>{if(v.currency==='PKR'&&!new Decimal(v.rate).eq(1))c.addIssue({code:'custom',message:'PKR rate must be 1',path:['rate']});});
export const invoiceSchema=z.object({id:z.string().uuid(),number:text.min(1),issuer:text.min(1),client:text.min(1),email:z.union([z.literal(''),z.string().email().max(200)]),description:text.min(1),date,due:date,currency:z.enum(currencies),quantity:z.number().positive().max(100000),unitPrice:amount,status:z.enum(['Draft','Sent','Paid']),notes:text}).strict().refine(v=>v.due>=v.date,{message:'Due date cannot precede issue date',path:['due']});
export const profileSchema=z.object({confirmedYear:z.union([z.literal(2026),z.literal(2027)]),name:text,province:z.enum(['Punjab','Sindh','Khyber Pakhtunkhwa','Balochistan','Islamabad','AJK / GB']),resident:z.boolean(),pseb:z.boolean(),returnFiled:z.boolean(),statementsFiled:z.boolean(),salesReturns:z.boolean(),noForeignCredit:z.boolean(),noOptOut:z.boolean(),simpleBusiness:z.boolean(),otherIncome:z.boolean(),deductionsReviewed:z.boolean(),provinceReviewed:z.boolean()}).strict();
export const workspaceSchema=z.object({version:z.literal(1),profile:profileSchema,receipts:z.array(receiptSchema).max(2000),expenses:z.array(expenseSchema).max(2000),invoices:z.array(invoiceSchema).max(2000)}).strict().superRefine((v,c)=>{for(const k of ['receipts','expenses','invoices'] as const){if(new Set(v[k].map(x=>x.id)).size!==v[k].length)c.addIssue({code:'custom',message:'Duplicate record IDs',path:[k]});}const aggregate=[v.receipts.reduce((a,r)=>a.plus(new Decimal(r.gross).mul(r.rate)),new Decimal(0)),v.receipts.reduce((a,r)=>a.plus(r.taxBase),new Decimal(0)),v.expenses.reduce((a,e)=>a.plus(new Decimal(e.amount).mul(e.rate)),new Decimal(0)),v.invoices.reduce((a,i)=>a.plus(new Decimal(i.quantity).mul(i.unitPrice)),new Decimal(0))];if(aggregate.some(a=>a.mul(100).gt(Number.MAX_SAFE_INTEGER)))c.addIssue({code:'custom',message:'Aggregate amount exceeds safe precision',path:[]});if(new Set(v.invoices.map(x=>x.number)).size!==v.invoices.length)c.addIssue({code:'custom',message:'Duplicate invoice number',path:['invoices']});});
export type Receipt=z.infer<typeof receiptSchema>;
export type Expense=z.infer<typeof expenseSchema>;
export type Invoice=z.infer<typeof invoiceSchema>;
export type Workspace=z.infer<typeof workspaceSchema>;
export const blankWorkspace=():Workspace=>({version:1,profile:{confirmedYear:2027,name:'',province:'Punjab',resident:true,pseb:false,returnFiled:false,statementsFiled:false,salesReturns:false,noForeignCredit:false,noOptOut:false,simpleBusiness:false,otherIncome:false,deductionsReviewed:false,provinceReviewed:false},receipts:[],expenses:[],invoices:[]});
export const money=(v:Decimal.Value)=>{const d=new Decimal(v).toDecimalPlaces(2);if(!d.isFinite()||d.mul(100).abs().gt(Number.MAX_SAFE_INTEGER))throw Error('Amount exceeds safe PKR precision. Split or review this workspace.');return d.toNumber();};
export const sum=(values:Decimal.Value[])=>money(values.reduce<Decimal>((a,b)=>a.plus(b),new Decimal(0)));
export function receiptMath(r:Receipt){const gross=new Decimal(r.gross).mul(r.rate),fees=new Decimal(r.fee).mul(r.rate).plus(r.bankFee);return {gross:money(gross),fees:money(fees),withheld:money(r.withheld),net:money(gross.minus(fees).minus(r.withheld))};}
export const expenseMath=(e:Expense)=>money(new Decimal(e.amount).mul(e.rate).mul(e.businessPct).div(100));
export const invoiceTotal=(i:Invoice)=>money(new Decimal(i.quantity).mul(i.unitPrice));
export function taxYear(d:string){if(!date.safeParse(d).success)throw Error('Invalid date');const [y,m]=d.split('-').map(Number);return y+(m>=7?1:0);}
export const inYear=(d:string,y:number)=>taxYear(d)===y;
export function businessTax(profit:Decimal.Value,year:number){if(![2026,2027].includes(year))throw Error('Unsupported Pakistan tax year');const p=Decimal.max(0,new Decimal(profit));const bands=[[600000,0,0],[1200000,600000,0.15],[1600000,1200000,0.20],[3200000,1600000,0.30],[5600000,3200000,0.40],[Infinity,5600000,0.45]];const bases=[0,0,90000,170000,650000,1610000];const idx=bands.findIndex(b=>p.lte(b[0]));const base=money(p.minus(bands[idx][1]).mul(bands[idx][2]).plus(bases[idx]));const surcharge=p.gt(10000000)?money(new Decimal(base).mul(.10)):0;return {base,surcharge,total:sum([base,surcharge])};}
export function estimate(w:Workspace,year:number){
 if(![2026,2027].includes(year))throw Error('Unsupported Pakistan tax year; no rates have been assumed');
 const rows=w.receipts.filter(r=>inYear(r.date,year)), expenses=w.expenses.filter(e=>inYear(e.date,year));const p=w.profile;
 const it=rows.filter(r=>r.category==='it-export'),services=rows.filter(r=>r.category==='service-export'),local=rows.filter(r=>r.category==='domestic'),special=rows.filter(r=>['social-media','other'].includes(r.category));
 const itBase=sum(it.map(r=>r.taxBase)),serviceBase=sum(services.map(r=>r.taxBase)),localBase=sum(local.map(r=>receiptMath(r).gross));
 const exportTax=sum([new Decimal(itBase).mul(p.pseb?.0025:.01),new Decimal(serviceBase).mul(.01)]);
 const expenseDeduction=sum(expenses.filter(e=>e.deductible).map(expenseMath));const localFees=sum(local.map(r=>receiptMath(r).fees));
 const profit=money(Decimal.max(0,new Decimal(localBase).minus(localFees).minus(expenseDeduction)));
 const business=businessTax(profit,year);
 const reasons:string[]=[];
 if(p.confirmedYear!==year)reasons.push('Tax profile was confirmed for a different year. Reconfirm all profile facts for the selected year.');
 if(!p.resident)reasons.push('Non-resident profile: residency, source and treaty rules need review (s.82, s.101).');
 if(p.otherIncome)reasons.push('Salary, investments, property, foreign tax credits or other income need a combined assessment.');
 if(special.length)reasons.push('Social-media or unclassified receipts: separate review required; TY2027 s.154B withholding is 5% ATL / 10% non-ATL, not automatically a final liability.');
 const exports=[...it,...services];
 if(exports.some(r=>!r.banking||!r.evidence||!r.baseConfirmed))reasons.push('Confirm authorized-dealer realization, bank evidence and gross tax-base PKR for every export receipt (s.71, s.154A).');
 if(exports.length&&(!p.returnFiled||!p.statementsFiled||!p.noForeignCredit||!p.noOptOut||((services.length>0||(it.length>0&&!p.pseb))&&!p.salesReturns)))reasons.push('154A final-tax conditions not all confirmed: income return, required WHT statements, applicable sales returns, no foreign tax credit and no opt-out.');
 if(local.length&&(!p.simpleBusiness||!p.deductionsReviewed))reasons.push('Confirm simple individual business, cash basis and tax deductibility/apportionment of expenses (s.18–21, s.32–34).');
 if(exports.length&&local.length)reasons.push('Mixed export and domestic regimes: review expense apportionment, minimum tax and final-tax treatment.');
 if(profit>=100000000||sum(rows.map(r=>receiptMath(r).gross))>=100000000)reasons.push('High income/turnover: super tax and minimum turnover tax need separate review (s.4C, s.113).');
 if(p.province==='AJK / GB')reasons.push('AJK / GB jurisdictions require specialist review; this federal model is not a complete assessment.');
 if(!p.provinceReviewed)reasons.push('Provincial / ICT sales-tax classification and obligations have not been reviewed. Federal estimates exclude sales tax.');
 const paidExport=sum(exports.map(r=>r.withheld)),paidLocal=sum(local.map(r=>r.withheld));
 const reserve=sum([exportTax,business.total]);const balance=sum([Math.max(0,money(new Decimal(exportTax).minus(paidExport))),Math.max(0,money(new Decimal(business.total).minus(paidLocal)))]);
 return {year,ruleVersion:RULE_VERSION,receipts:rows.length,itBase,serviceBase,itRate:p.pseb?.25:1,exportTax,localBase,expenseDeduction,localFees,profit,business,paidExport,paidLocal,reserve,balance,liability:reasons.length?null:reserve,reasons,specialBase:sum(special.map(r=>receiptMath(r).gross)),sources:SOURCES.slice(0,4),note:'Estimate, never advice. No provincial sales tax, wealth reconciliation, penalties, treaty relief, salary aggregation, capital allowances, loss carry-forward or super tax. Confirm with a Pakistani tax practitioner before filing.'};
}
export function csv(rows:unknown[][]){return '\uFEFF'+rows.map(row=>row.map(v=>{let s=String(v??'');if(/^[\s]*[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(',')).join('\r\n');}
export const escapeHTML=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
