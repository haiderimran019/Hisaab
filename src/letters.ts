/* Two documents a freelancer has to produce, and always writes from scratch.

   **The PRC request.** A Proceeds Realisation Certificate is what proves export
   proceeds were realised through an authorized dealer, and it is the evidence
   section 154A treatment rests on. Banks issue it on request, the request has to
   name the transactions, and most people write it badly once a year. Hisaab
   already holds every detail the bank needs.

   **The proof of income.** A landlord, a visa office or a lender asks a
   freelancer to prove an income that has no payslip behind it. The honest
   version of this document states what it is drawn from and who prepared it,
   and does not pretend to be audited or certified. The dishonest version is
   what people produce in Word when they have nothing better, which is the
   actual harm this replaces.

   Both are plain text, generated on the device, for the customer to send
   themselves. Nothing here touches the network, and neither document is a
   return, a certificate, or anything Hisaab can attest to — each says so in
   its own body, not in small print somewhere else. */
import Decimal from 'decimal.js';
import {receiptMath,inYear,sum,money,escapeHTML as h,type Workspace,type Receipt} from './core';

const pkr=(n:number)=>`PKR ${n.toLocaleString('en-PK',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const wrap=(s:string)=>s.replace(/\s+$/gm,'').replace(/\n{3,}/g,'\n\n').trim()+'\n';

/* ── Proceeds Realisation Certificate request ────────────────────────────── */

export type PrcRequest={
 /** The receipts the certificate is being asked for. */
 receipts:Receipt[];
 total:number;
 /** Plain text, ready to paste into an email or print on a letterhead. */
 text:string;
 /** Why a receipt was left out, so the omission is visible rather than silent. */
 skipped:{client:string;date:string;reason:string}[];
};

/** Only export receipts need a PRC, and only ones recorded as bank-realised
    can honestly be asked about — a bank cannot certify money it never saw. */
export function prcRequest(w:Workspace,year:number,opts:{
 bank?:string;branch?:string;accountRef?:string;today:string}):PrcRequest{
 const all=w.receipts.filter(r=>inYear(r.date,year)
  &&(r.category==='it-export'||r.category==='service-export'));
 const receipts=all.filter(r=>r.banking).sort((a,b)=>a.date.localeCompare(b.date));
 const skipped=all.filter(r=>!r.banking).map(r=>({client:r.client,date:r.date,
  reason:'Not recorded as realised through an authorized dealer, so the bank has nothing to certify yet.'}));
 const total=sum(receipts.map(r=>r.taxBase));
 const name=w.profile.name.trim()||'[your name]';
 const bank=opts.bank?.trim()||'[your bank]';
 const branch=opts.branch?.trim()||'[branch]';
 const ref=opts.accountRef?.trim()||'[your account number or IBAN]';

 const rows=receipts.map((r,i)=>{
  const m=receiptMath(r);
  return `${i+1}. ${r.date} — ${r.client||'client not recorded'}`
   +`\n   Amount received: ${r.currency} ${new Decimal(r.gross).toFixed(2)}`
   +(r.currency==='PKR'?'':` (recorded PKR equivalent ${pkr(m.gross)})`)
   +`\n   Gross PKR credited per your advice: ${pkr(money(r.taxBase))}`
   +(new Decimal(r.withheld).gt(0)?`\n   Tax deducted at source: ${pkr(m.withheld)}`:'')
   +(r.evidence.trim()?`\n   Our reference: ${r.evidence.trim()}`:'')
   +(r.description.trim()?`\n   Nature of service: ${r.description.trim()}`:'');
 }).join('\n\n');

 const text=wrap(`${opts.today}

The Manager
${bank}, ${branch}

Subject: Request for Proceeds Realisation Certificate — tax year ${year}

Dear Sir / Madam,

I maintain account ${ref} with your branch. I am self-employed and export
services from Pakistan, and the proceeds below were realised through your
institution as my authorized dealer.

I request a Proceeds Realisation Certificate covering these realisations, for
the purpose of my income tax return for tax year ${year} and to evidence
treatment under section 154A of the Income Tax Ordinance, 2001.

${receipts.length?`Realisations for which the certificate is requested (${receipts.length}):

${rows}

Total gross PKR realised: ${pkr(total)}`
 :`I do not presently have export realisations recorded for this tax year. Please
treat this as a request for a certificate covering all export proceeds credited
to the above account during tax year ${year}.`}

Please confirm the gross PKR amount credited against each realisation and the
tax, if any, deducted and deposited on my behalf. If any figure above differs
from your records, I would be grateful if the certificate reflected your records
and you let me know, so that I can correct mine before filing.

Yours faithfully,

${name}
${w.profile.name.trim()?'':'[sign here]'}

---
Prepared from my own records using Hisaab. The figures above are mine, not the
bank's, and are stated so that your records can be checked against them.`);

 return {receipts,total,text,skipped};
}

/* ── Proof of income ─────────────────────────────────────────────────────── */

export type IncomeProof={
 total:number;netTotal:number;months:number;monthlyAverage:number;
 clients:number;text:string;html:string;
};

/** A statement of income drawn from recorded receipts, for a landlord, a visa
    application or a lender. Says what it is and what it is not, in its body. */
export function incomeProof(w:Workspace,year:number,opts:{
 purpose?:string;today:string}):IncomeProof{
 const rows=w.receipts.filter(r=>inYear(r.date,year)).sort((a,b)=>a.date.localeCompare(b.date));
 const total=sum(rows.map(r=>receiptMath(r).gross));
 const netTotal=sum(rows.map(r=>receiptMath(r).net));
 const months=new Set(rows.map(r=>r.date.slice(0,7))).size;
 const monthlyAverage=months?money(new Decimal(total).div(months)):0;
 const clients=new Set(rows.map(r=>r.client.trim().toLowerCase()).filter(Boolean)).size;
 const name=w.profile.name.trim()||'[your name]';
 const purpose=opts.purpose?.trim();

 const byMonth=[...new Set(rows.map(r=>r.date.slice(0,7)))].sort().map(m=>{
  const inMonth=rows.filter(r=>r.date.startsWith(m));
  return {month:m,gross:sum(inMonth.map(r=>receiptMath(r).gross)),count:inMonth.length};
 });

 const basis=`Drawn from ${rows.length} receipt${rows.length===1?'':'s'} recorded across `
  +`${months} month${months===1?'':'s'} of tax year ${year} (1 July ${year-1} to 30 June ${year})`
  +(clients?`, from ${clients} client${clients===1?'':'s'}`:'')+'.';

 const disclaimer=`This statement was prepared by me from my own records. It is not `
  +`audited, it is not certified by any accountant or authority, and it is not a tax `
  +`return or an FBR document. Gross receipts are amounts invoiced and received before `
  +`platform fees, bank charges and tax deducted at source; the net figure is after `
  +`those. Supporting bank credit advices can be provided on request.`;

 const text=wrap(`STATEMENT OF INCOME
${name}
Tax year ${year} (1 July ${year-1} – 30 June ${year})
Prepared ${opts.today}
${purpose?`Purpose: ${purpose}`:''}

Gross receipts:            ${pkr(total)}
Net after fees and tax:    ${pkr(netTotal)}
Months with income:        ${months}
Average monthly gross:     ${pkr(monthlyAverage)}

Month by month
${byMonth.map(m=>`  ${m.month}   ${pkr(m.gross).padStart(22)}   ${m.count} receipt${m.count===1?'':'s'}`).join('\n')||'  No receipts recorded for this tax year.'}

Basis
${basis}

Declaration
${disclaimer}

Signed: ______________________        Date: ______________
${name}`);

 const html=`<article class="income-proof">
 <h1>Statement of income</h1>
 <p class="who"><b>${h(name)}</b><br>Tax year ${year} (1 July ${year-1} – 30 June ${year})<br>
 Prepared ${h(opts.today)}${purpose?`<br>Purpose: ${h(purpose)}`:''}</p>
 <table><tbody>
  <tr><th>Gross receipts</th><td>${h(pkr(total))}</td></tr>
  <tr><th>Net after fees and tax</th><td>${h(pkr(netTotal))}</td></tr>
  <tr><th>Months with income</th><td>${months}</td></tr>
  <tr><th>Average monthly gross</th><td>${h(pkr(monthlyAverage))}</td></tr>
 </tbody></table>
 <h2>Month by month</h2>
 <table><thead><tr><th>Month</th><th>Gross</th><th>Receipts</th></tr></thead><tbody>
 ${byMonth.map(m=>`<tr><td>${h(m.month)}</td><td>${h(pkr(m.gross))}</td><td>${m.count}</td></tr>`).join('')
  ||'<tr><td colspan="3">No receipts recorded for this tax year.</td></tr>'}
 </tbody></table>
 <h2>Basis</h2><p>${h(basis)}</p>
 <h2>Declaration</h2><p>${h(disclaimer)}</p>
 <p class="sign">Signed: ______________________ &nbsp;&nbsp; Date: ______________<br>${h(name)}</p>
</article>`;

 return {total,netTotal,months,monthlyAverage,clients,text,html};
}
