import Decimal from 'decimal.js';
import {blankWorkspace, receiptMath, type Workspace, type StatementLine} from './core';
import {fingerprint} from './statements';
export function demo():Workspace{const w=blankWorkspace();w.profile={...w.profile,name:'Ayesha',pseb:true};
const entries=[['2026-07-08','Linear Studio','Brand system','1800','36','278.5','Payoneer'],['2026-07-22','Orbit Labs','Dashboard design','1200','24','279.1','Wise'],['2026-08-06','Linear Studio','Website development','2200','44','278.8','Payoneer'],['2026-08-19','Forma Digital','Product sprint','1500','30','279.3','Bank transfer'],['2026-09-05','Orbit Labs','Design retainer','2400','48','278.6','Wise'],['2026-09-21','Linear Studio','Frontend development','1900','38','279.8','Payoneer'],['2026-10-04','Forma Digital','Website redesign','2800','56','280.2','Wise'],['2026-10-16','Orbit Labs','October retainer','1600','32','279.4','Bank transfer']];
w.receipts=entries.map(([date,client,description,gross,fee,rate,rail])=>({id:crypto.randomUUID(),date,client,description,currency:'USD',gross,fee,rate,rail:rail as 'Wise',bankFee:'0',withheld:(Number(gross)*Number(rate)*.0025).toFixed(2),category:'it-export',evidence:'DEMO-PRC-'+date,banking:true,taxBase:(Number(gross)*Number(rate)).toFixed(2),baseConfirmed:true}));
w.expenses=[{id:crypto.randomUUID(),date:'2026-10-01',vendor:'Figma',category:'Software',amount:'15',currency:'USD',rate:'279.5',businessPct:100,deductible:false,evidence:'Demo subscription',receipt:null},{id:crypto.randomUUID(),date:'2026-10-02',vendor:'Nayatel',category:'Internet',amount:'6500',currency:'PKR',rate:'1',businessPct:75,deductible:false,evidence:'Demo internet bill',receipt:null}];
w.invoices=[{id:crypto.randomUUID(),number:'INV-2026-009',issuer:'Ayesha Design Studio',client:'Linear Studio',email:'',description:'November design retainer',date:'2026-10-20',due:'2026-11-03',currency:'USD',quantity:1,unitPrice:'2400',status:'Sent',notes:'Demo invoice. No payment information.'},{id:crypto.randomUUID(),number:'INV-2026-008',issuer:'Ayesha Design Studio',client:'Orbit Labs',email:'',description:'October retainer',date:'2026-10-01',due:'2026-10-16',currency:'USD',quantity:1,unitPrice:'1600',status:'Paid',notes:'Payment recorded separately in income.'}];
addDemoStatements(w);
return w;}

/* A worked statement so a first-time visitor can see the paid workflow — lines
   already matched to income, two still waiting for a decision, one own-account
   transfer and one repeat the importer caught. All of it is sample data. */
function addDemoStatements(w:Workspace){
 const bank={id:crypto.randomUUID(),label:'HBL current account',kind:'Bank' as const,currency:'PKR' as const,
  institution:'Habib Bank',reference:'\u2022\u20224821',periodStart:'2026-07-01',periodEnd:'2027-06-30',
  opening:'150000.00',closing:'0.00',balancesConfirmed:true};
 const wallet={id:crypto.randomUUID(),label:'Easypaisa wallet',kind:'Mobile wallet' as const,currency:'PKR' as const,
  institution:'Easypaisa',reference:'\u2022\u20227719',periodStart:'2026-07-01',periodEnd:'2027-06-30',
  opening:'0.00',closing:'25000.00',balancesConfirmed:true};
 const batch=(accountId:string,filename:string,rowCount:number)=>({id:crypto.randomUUID(),accountId,filename,
  importedAt:'2026-10-18T09:12:00.000Z',rowCount,imported:rowCount,skipped:0,digest:'demo-sample-statement',
  mapping:{date:'Value Date',description:'Particulars',debit:'Debit',credit:'Credit',balance:'Balance'}});
 const bankBatch=batch(bank.id,'hbl-statement-jul-oct-2026.csv',12);
 const walletBatch=batch(wallet.id,'easypaisa-oct-2026.csv',1);
 let row=1;
 const line=(accountId:string,batchId:string,date:string,description:string,amount:string,
  status:StatementLine['status'],linkedId='',counterparty='',note=''):StatementLine=>({
  id:crypto.randomUUID(),batchId,accountId,date,description,counterparty,amount,balance:'',
  fingerprint:fingerprint(accountId,date,description,amount),status,linkedId,note,row:++row});

 const lines:StatementLine[]=w.receipts.map(r=>line(bank.id,bankBatch.id,r.date,
  `ONLINE INWARD REMITTANCE ${r.client.toUpperCase()}`,receiptMath(r).net.toFixed(2),'income',r.id,r.client,
  'Classified from this statement line.'));
 lines.push(
  line(bank.id,bankBatch.id,'2026-09-12','ONLINE TRANSFER CR MEHRAN TRADERS','85000.00','pending','','Mehran Traders'),
  line(bank.id,bankBatch.id,'2026-10-05','NAYATEL BILL PAYMENT OCT','-6500.00','pending','','Nayatel'),
  line(bank.id,bankBatch.id,'2026-10-08','IBFT DR TO EASYPAISA 7719','-25000.00','transfer','','',
   'Confirmed as a transfer between your own accounts.'),
  line(bank.id,bankBatch.id,'2026-10-04','ONLINE INWARD REMITTANCE FORMA DIGITAL',
   receiptMath(w.receipts[6]).net.toFixed(2),'duplicate','','','Matches a line already imported for this account.')
 );
 const walletIn=line(wallet.id,walletBatch.id,'2026-10-08','IBFT CR FROM HBL 4821','25000.00','transfer','','',
  'Confirmed as a transfer between your own accounts.');
 const bankTransfer=lines.find(l=>l.description.startsWith('IBFT DR'))!;
 bankTransfer.linkedId=walletIn.id;walletIn.linkedId=bankTransfer.id;
 lines.push(walletIn);

 const movement=lines.filter(l=>l.accountId===bank.id&&l.status!=='duplicate')
  .reduce((a,l)=>a.plus(l.amount),new Decimal(0));
 bank.closing=new Decimal(bank.opening).plus(movement).toFixed(2);
 w.accounts=[bank,wallet];
 w.batches=[bankBatch,walletBatch];
 w.lines=lines;
}
