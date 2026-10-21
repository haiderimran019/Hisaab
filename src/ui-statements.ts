/* Views for the paid workflow: accounts, statement import, the review queue,
   reconciliation and the plan panel. Pure string builders — every event is wired
   in main.ts, which owns application state. */
import Decimal from 'decimal.js';
import {reconcile,readiness,escapeHTML as h,type Workspace,type StatementLine,accountKinds,currencies} from './core';
import {fieldLabels,type FieldName,type ParsedImport,transferCandidates} from './statements';
import {icon,num,dateLabel} from './format';
import {LIMITS,planLabel,importsThisMonth,type LicenseStatus,type Limits} from './license';
import {PLANS,PAYMENT_RAILS,LAUNCH_PRICE,LAUNCH_NOTE,SUPPORT_EMAIL,BUY_URL,KEY_TURNAROUND,REFUND_WINDOW_DAYS} from './pricing';
import {serviceConfigured,readerConfigured,READER_NAME} from './service';

export type Ctx={
 workspace:Workspace;year:number;license:LicenseStatus;limits:Limits;today:string;
 draft:ImportDraft|null;lineFilter:string;accountFilter:string;demo:boolean;
};
export type ImportDraft={
 accountId:string;filename:string;rows:string[][];headerIndex:number;
 mapping:Partial<Record<FieldName,number>>;dayFirst:boolean;digest:string;
 preview:ParsedImport|null;error:string;
 /** 'document' rows were transcribed by a reader, so there is no column mapping. */
 kind:'csv'|'document';readerNote:string;
};

const signClass=(v:string)=>new Decimal(v).gte(0)?'in':'out';
const amountCell=(v:string,currency:string)=>`<span class="amt ${signClass(v)}">${new Decimal(v).gte(0)?'+':'−'}${num(Math.abs(Number(v)))} <small>${h(currency)}</small></span>`;
const statusChip=(s:string)=>`<span class="chip ${s}">${({pending:'Needs a decision',income:'Income',expense:'Expense',transfer:'Own transfer',excluded:'Not business',duplicate:'Duplicate'} as Record<string,string>)[s]??s}</span>`;

export function statementsView(ctx:Ctx){
 const {workspace:w,license,limits}=ctx;
 const accounts=w.accounts;
 const used=importsThisMonth(w.batches,ctx.today);
 const quota=limits.importsPerMonth===Infinity?'Unlimited imports':`${Math.max(0,limits.importsPerMonth-used)} of ${limits.importsPerMonth} imports left this month`;
 if(!accounts.length)return `<section class="panel empty-panel">
  <span class="empty-mark">${icon('landmark')}</span>
  <h2>Turn a bank statement into reviewed records</h2>
  <p>Add the account you get paid into, then import its CSV statement. Hisaab reads the rows, flags repeats and likely transfers between your own accounts, and asks you to decide the rest. Nothing becomes income until you say so.</p>
  <div class="empty-actions"><button class="btn primary" data-action="new-account">${icon('plus')}Add an account</button></div>
  <p class="muted small">Supported today: CSV exports from Pakistani bank portals, Payoneer and Wise. PDF statements are not read — export CSV, or enter those rows by hand.</p>
 </section>`;

 const pending=w.lines.filter(l=>l.status==='pending');
 const transfers=transferCandidates(w);
 const filtered=w.lines.filter(l=>
  (ctx.accountFilter==='all'||l.accountId===ctx.accountFilter)&&
  (ctx.lineFilter==='all'?l.status!=='duplicate':ctx.lineFilter===l.status));

 return `<div class="toolbar statements-bar">
  <div class="seg">${[['pending',`Needs a decision (${pending.length})`],['all','All lines'],['income','Income'],['expense','Expenses'],['transfer','Transfers'],['excluded','Not business'],['duplicate',`Duplicates (${w.lines.filter(l=>l.status==='duplicate').length})`]]
   .map(([v,label])=>`<button class="seg-btn ${ctx.lineFilter===v?'active':''}" data-line-filter="${v}">${h(label)}</button>`).join('')}</div>
  <div class="bar-right">
   <label class="year-picker"><span class="sr-only">Account</span><select id="account-filter"><option value="all">All accounts</option>${accounts.map(a=>`<option value="${a.id}" ${ctx.accountFilter===a.id?'selected':''}>${h(a.label)}</option>`).join('')}</select>${icon('chevron-down')}</label>
   <button class="btn secondary" data-action="new-account">${icon('plus')}Account</button>
   <button class="btn primary" data-action="import-statement">${icon('upload')}Import CSV</button>
   ${readerConfigured()&&limits.filingPack?`<button class="btn secondary" data-action="read-document">${icon('file-text')}Read a PDF</button>`:''}
  </div>
 </div>
 <p class="quota">${icon('clock')}${h(quota)} · ${h(ctx.demo?'Demo — paid steps unlocked on sample data':planLabel(license))}${limits.importsPerMonth!==Infinity?' · <button class="text-link" data-page="Settings">See Pro</button>':''}</p>

 <div class="recon-grid">${accounts.map(a=>{
  const r=reconcile(w,a.id);
  return `<section class="panel recon-card ${r.confirmed?(r.balanced?'balanced':'off'):'unconfirmed'}">
   <div class="recon-head"><div><h3>${h(a.label)}</h3><p>${h(a.kind)} · ${h(a.currency)} · ${h(dateLabel(a.periodStart))} to ${h(dateLabel(a.periodEnd))}</p></div>
    <button class="icon-btn" data-edit-account="${a.id}" aria-label="Edit account">${icon('pencil')}</button></div>
   <dl class="recon-rows">
    <div><dt>Opening</dt><dd>${num(r.opening)}</dd></div>
    <div><dt>Money in</dt><dd class="in">+${num(r.inflow)}</dd></div>
    <div><dt>Money out</dt><dd class="out">−${num(Math.abs(r.outflow))}</dd></div>
    <div><dt>Closing from lines</dt><dd>${num(r.computedClosing)}</dd></div>
    <div><dt>Closing on statement</dt><dd>${num(r.closing)}</dd></div>
   </dl>
   ${!r.confirmed?`<p class="recon-flag unconfirmed">${icon('circle-help')}Confirm the opening and closing balances from the statement before trusting this.</p>`
    :r.balanced?`<p class="recon-flag ok">${icon('check')}Reconciles to the statement.</p>`
    :`<p class="recon-flag bad">${icon('octagon-alert')}${num(Math.abs(r.difference))} ${h(a.currency)} ${r.difference>0?'is missing from':'is extra in'} these lines. Find it — do not force it to zero.</p>`}
   <p class="recon-counts">${r.lines} lines · ${r.pending} undecided · ${r.income} income · ${r.expense} expense · ${r.transfer} transfer${r.duplicates?` · ${r.duplicates} duplicate`:''}</p>
  </section>`;}).join('')}</div>

 ${transfers.length?`<section class="panel transfer-panel">
  <div class="panel-head"><div><h2>${transfers.length} likely transfer${transfers.length===1?'':'s'} between your own accounts</h2>
   <p>Equal and opposite movements a few days apart. Confirming a pair keeps both sides out of income and out of spending.</p></div></div>
  <div class="table-scroll"><table class="cards"><thead><tr><th>Out</th><th>In</th><th>Gap</th><th>Amount</th><th>Confirm</th></tr></thead><tbody>
  ${transfers.slice(0,20).map(p=>`<tr>
   <td data-label="Money out">${h(dateLabel(p.out.date))}<br><small>${h(accountName(w,p.out.accountId))} · ${h(p.out.description.slice(0,60))}</small></td>
   <td data-label="Money in">${h(dateLabel(p.in.date))}<br><small>${h(accountName(w,p.in.accountId))} · ${h(p.in.description.slice(0,60))}</small></td>
   <td data-label="Gap">${p.days} day${p.days===1?'':'s'}</td>
   <td data-label="Amount">${num(Math.abs(Number(p.out.amount)))}</td>
   <td class="line-actions"><button class="btn tiny primary" data-pair="${p.out.id}:${p.in.id}">${icon('check')}Both are mine</button></td>
  </tr>`).join('')}</tbody></table></div>
 </section>`:''}

 <section class="panel"><div class="panel-head"><div><h2>${({pending:'Lines that need a decision',all:'All statement lines',income:'Lines you classified as income',expense:'Lines you classified as expenses',transfer:'Transfers between your own accounts',excluded:'Lines marked not business',duplicate:'Duplicate lines, excluded from reconciliation'} as Record<string,string>)[ctx.lineFilter]}</h2>
  <p>${ctx.lineFilter==='pending'?'Each decision is reversible. Nothing here is counted as income until you classify it.':'Every line keeps its file, row number and original text.'}</p></div></div>
  ${filtered.length?`<div class="table-scroll"><table class="lines"><thead><tr><th>Date</th><th>Description</th><th>Account</th><th>Amount</th><th>State</th><th>Decide</th></tr></thead><tbody>
  ${filtered.slice(0,300).map(l=>lineRow(w,l)).join('')}
  </tbody></table></div>${filtered.length>300?`<p class="muted small">Showing the first 300 of ${filtered.length}. Narrow by account to see the rest.</p>`:''}`
  :`<p class="muted">${ctx.lineFilter==='pending'?'Nothing is waiting. Every imported line has been classified.':'No lines here yet.'}</p>`}
 </section>

 ${w.batches.length?`<section class="panel"><div class="panel-head"><div><h2>Import history</h2><p>Provenance for every line above.</p></div></div>
  <div class="table-scroll"><table><thead><tr><th>File</th><th>Account</th><th>Imported</th><th>Rows read</th><th>Lines kept</th><th>Repeats skipped</th></tr></thead><tbody>
  ${[...w.batches].reverse().map(b=>`<tr><td>${h(b.filename)}<br><small>fingerprint ${h(b.digest.slice(0,16))}</small></td><td>${h(accountName(w,b.accountId))}</td><td>${h(b.importedAt.slice(0,16).replace('T',' '))}</td><td>${b.rowCount}</td><td>${b.imported}</td><td>${b.skipped}</td></tr>`).join('')}
  </tbody></table></div></section>`:''}`;
}
const accountName=(w:Workspace,id:string)=>w.accounts.find(a=>a.id===id)?.label??'(removed account)';
function lineRow(w:Workspace,l:StatementLine){
 const currency=w.accounts.find(a=>a.id===l.accountId)?.currency??'PKR';
 const inflow=new Decimal(l.amount).gt(0);
 const decided=l.status!=='pending';
 return `<tr class="${l.status}">
  <td data-label="Date">${h(dateLabel(l.date))}<br><small>row ${l.row}</small></td>
  <td data-label="Description"><span class="line-desc">${h(l.description.slice(0,90))}</span>${l.counterparty?`<br><small>${h(l.counterparty.slice(0,60))}</small>`:''}${l.note?`<br><small class="muted">${h(l.note)}</small>`:''}</td>
  <td data-label="Account"><small>${h(accountName(w,l.accountId))}</small></td>
  <td data-label="Amount">${amountCell(l.amount,currency)}</td>
  <td data-label="State">${statusChip(l.status)}</td>
  <td class="line-actions">${decided
   ?`<button class="btn tiny ghost" data-line-reset="${l.id}">${icon('refresh-cw')}Undo</button>`
   :`${inflow?`<button class="btn tiny primary" data-line-income="${l.id}">${icon('arrow-down-left')}Income</button>`
      :`<button class="btn tiny primary" data-line-expense="${l.id}">${icon('arrow-up-right')}Expense</button>`}
     <button class="btn tiny ghost" data-line-transfer="${l.id}">${icon('refresh-cw')}My transfer</button>
     <button class="btn tiny ghost" data-line-exclude="${l.id}">${icon('x')}Not business</button>`}
  </td></tr>`;
}

export function importDrawerBody(ctx:Ctx){
 const d=ctx.draft;
 if(!d)return '<p class="muted">No file loaded.</p>';
 const account=ctx.workspace.accounts.find(a=>a.id===d.accountId);
 if(d.kind==='document')return documentPreview(ctx,d,account?.label??'');
 const header=d.rows[d.headerIndex]??[];
 const fields:FieldName[]=['date','description','counterparty','amount','debit','credit','drcr','balance'];
 const preview=d.preview;
 return `<p class="drawer-intro">${h(d.filename)} → <b>${h(account?.label??'')}</b>. Check that each column means what Hisaab thinks it means. A row it cannot read is listed below rather than dropped.</p>
 <form id="map-form" class="form-grid">
  <label class="field"><span>Which account is this statement for?</span><select name="accountId">${ctx.workspace.accounts.map(a=>`<option value="${a.id}" ${a.id===d.accountId?'selected':''}>${h(a.label)} · ${h(a.currency)}</option>`).join('')}</select></label>
  <label class="field"><span>Header row</span><select name="headerIndex">${d.rows.slice(0,40).map((r,i)=>`<option value="${i}" ${i===d.headerIndex?'selected':''}>Row ${i+1}: ${h(r.slice(0,4).join(' | ').slice(0,60))}</option>`).join('')}</select></label>
  <label class="field"><span>Ambiguous dates like 05/04/2026</span><select name="dayFirst"><option value="1" ${d.dayFirst?'selected':''}>Day first (5 April) — usual in Pakistan</option><option value="0" ${!d.dayFirst?'selected':''}>Month first (4 May)</option></select></label>
  <div class="map-list">${fields.map(f=>`<label class="field"><span>${h(fieldLabels[f])}</span><select name="map-${f}"><option value="">— not in this file —</option>${header.map((cell,i)=>`<option value="${i}" ${d.mapping[f]===i?'selected':''}>${h(cell||`column ${i+1}`)}</option>`).join('')}</select></label>`).join('')}</div>
  <p class="muted small">Use one signed amount column, or a debit column and a credit column. If the file has a single amount column plus a Dr/Cr marker, map both.</p>
  <div class="drawer-actions"><button type="submit" class="btn secondary">${icon('refresh-cw')}Re-read with these columns</button></div>
 </form>
 ${d.error?`<p class="form-error visible">${h(d.error)}</p>`:''}
 ${preview?`<div class="import-preview">
  <h3>${preview.lines.length} line${preview.lines.length===1?'':'s'} read${preview.duplicates?` · ${preview.duplicates} already imported`:''}${preview.issues.length?` · ${preview.issues.length} row${preview.issues.length===1?'':'s'} set aside`:''}</h3>
  ${preview.chain.checked
   ?`<p class="chain-note ${preview.chain.breaks.length?'warn':'ok'}">${icon(preview.chain.breaks.length?'octagon-alert':'check')}
     <span>Checked against the running balance on your statement: <b>${preview.chain.verified}</b> row${preview.chain.verified===1?'':'s'} add up exactly${preview.chain.breaks.length?`, and <b>${preview.chain.breaks.length}</b> did not — those are listed below rather than imported`:''}.${preview.chain.rescued?` ${preview.chain.rescued} row${preview.chain.rescued===1?' that looked like a repeat was':'s that looked like repeats were'} confirmed genuine by the balance.`:''}</span></p>`
   :`<p class="chain-note">${icon('circle-help')}<span>This file has no running balance column, so the amounts cannot be checked against the statement's own arithmetic. They are imported as read — look them over before you classify them.</span></p>`}
  <div class="table-scroll"><table><thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Balance</th><th>State</th></tr></thead><tbody>
  ${preview.lines.slice(0,8).map(l=>`<tr><td>${h(l.date)}</td><td>${h(l.description.slice(0,70))}</td><td>${amountCell(l.amount,account?.currency??'PKR')}</td><td>${l.balance?num(Number(l.balance)):'—'}</td><td>${statusChip(l.status)}</td></tr>`).join('')}
  </tbody></table></div>
  ${preview.lines.length>8?`<p class="muted small">…and ${preview.lines.length-8} more.</p>`:''}
  ${preview.issues.length?`<div class="issue-box"><h4>${icon('octagon-alert')}These rows were not imported</h4><ul>${preview.issues.slice(0,12).map(i=>`<li><b>Row ${i.row}</b> — ${h(i.reason)}<br><small>${h(i.raw.slice(0,140))}</small></li>`).join('')}</ul>${preview.issues.length>12?`<p class="muted small">${preview.issues.length-12} more rows have the same kind of problem.</p>`:''}<p class="muted small">Totals and summaries are usually safe to leave out. A real transaction here means the column mapping is wrong, or this layout is not supported — in which case enter those rows by hand rather than guessing.</p></div>`:''}
  <form id="commit-form">
   <label class="check-label"><input name="understood" type="checkbox"><span>I have checked the columns and the unread rows above.</span></label>
   <div class="drawer-actions"><button type="button" class="btn ghost" data-action="close">Cancel</button>
    <button type="submit" class="btn primary" ${preview.lines.length?'':'disabled'}>${icon('check')}Import ${preview.lines.filter(l=>l.status!=='duplicate').length} line${preview.lines.filter(l=>l.status!=='duplicate').length===1?'':'s'}</button></div>
  </form>
 </div>`:''}`;
}

function documentPreview(ctx:Ctx,d:ImportDraft,accountLabel:string){
 const preview=d.preview;
 const account=ctx.workspace.accounts.find(a=>a.id===d.accountId);
 return `<p class="drawer-intro">${h(d.filename)} → <b>${h(accountLabel)}</b>, read by ${h(READER_NAME)}.</p>
 ${d.readerNote?`<p class="chain-note">${icon('circle-help')}<span>${h(d.readerNote)}</span></p>`:''}
 ${d.error?`<p class="form-error visible">${h(d.error)}</p>`:''}
 ${preview?`<div class="import-preview">
  <h3>${preview.lines.length} row${preview.lines.length===1?'':'s'} transcribed${preview.issues.length?` · ${preview.issues.length} set aside`:''}</h3>
  ${preview.chain.checked
   ?`<p class="chain-note ${preview.chain.breaks.length?'warn':'ok'}">${icon(preview.chain.breaks.length?'octagon-alert':'check')}
     <span>Checked against the running balance printed on the document: <b>${preview.chain.verified}</b> row${preview.chain.verified===1?'':'s'} add up exactly${preview.chain.breaks.length?`, and <b>${preview.chain.breaks.length}</b> did not — a reader misreading a figure is exactly what that catches, so those are set aside`:''}.</span></p>`
   :`<p class="chain-note warn">${icon('octagon-alert')}<span>This document has no running balance column, so there is no arithmetic to check the transcription against. Compare these rows to the statement yourself before you classify them.</span></p>`}
  <div class="table-scroll"><table class="cards"><thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Balance</th></tr></thead><tbody>
  ${preview.lines.slice(0,10).map(l=>`<tr><td data-label="Date">${h(l.date)}</td><td data-label="Description">${h(l.description.slice(0,70))}</td>
   <td data-label="Amount">${amountCell(l.amount,account?.currency??'PKR')}</td><td data-label="Balance">${l.balance?num(Number(l.balance)):'—'}</td></tr>`).join('')}
  </tbody></table></div>
  ${preview.lines.length>10?`<p class="muted small">…and ${preview.lines.length-10} more.</p>`:''}
  ${preview.issues.length?`<div class="issue-box"><h4>${icon('octagon-alert')}These rows were not imported</h4>
   <ul>${preview.issues.slice(0,12).map(i=>`<li><b>Row ${i.row}</b> — ${h(i.reason)}<br><small>${h(i.raw.slice(0,140))}</small></li>`).join('')}</ul></div>`:''}
  <form id="commit-form">
   <label class="check-label"><input name="understood" type="checkbox"><span>I have compared these rows against the statement and they are right.</span></label>
   <div class="drawer-actions"><button type="button" class="btn ghost" data-action="close">Discard</button>
    <button type="submit" class="btn primary" ${preview.lines.length?'':'disabled'}>${icon('check')}Add ${preview.lines.filter(l=>l.status!=='duplicate').length} row${preview.lines.filter(l=>l.status!=='duplicate').length===1?'':'s'} to review</button></div>
  </form>
 </div>`:''}`;
}

export function documentConsent(ctx:Ctx){
 const accounts=ctx.workspace.accounts;
 return `<p class="drawer-intro">Only for statements your bank will not give you as CSV. Read this before you choose a file — it is the one place in Hisaab where something of yours leaves this device.</p>
 <ul class="trust-list">
  <li>${icon('octagon-alert')}<span><b>The whole document is sent to ${h(READER_NAME)}</b> to be transcribed. That includes your account number, your balances and every transaction printed on it.</span></li>
  <li>${icon('check')}<span><b>Hisaab stores none of it.</b> The file passes through our service in memory for one request and is dropped. No copy, no log.</span></li>
  <li>${icon('circle-help')}<span><b>Nothing it returns is trusted.</b> The rows are checked against the running balance on the document, and you confirm every one before anything is recorded.</span></li>
  <li>${icon('shield-check')}<span><b>Satisfy yourself about ${h(READER_NAME)}.</b> What they keep and for how long is their policy, not ours, and you should read it before sending a bank statement to anyone.</span></li>
 </ul>
 <form id="document-form" class="form-grid">
  <label class="field"><span>Which account is this statement for?</span><select name="accountId">
   ${accounts.map(a=>`<option value="${a.id}">${h(a.label)} · ${h(a.currency)}</option>`).join('')}</select></label>
  <label class="check-label"><input name="understood" type="checkbox"><span>I understand this document will be sent to ${h(READER_NAME)} to be read.</span></label>
  <div class="form-error" role="alert"></div>
  <div class="drawer-actions"><button type="button" class="btn ghost" data-action="close">Cancel</button>
   <button type="submit" class="btn primary">${icon('file-text')}Choose a file</button></div>
 </form>
 <p class="muted small">A CSV import never involves this, and nothing here changes what the rest of the app does.</p>`;
}

export function planPanel(ctx:Ctx){
 const {license:s,limits}=ctx;
 const used=importsThisMonth(ctx.workspace.batches,ctx.today);
 const state=s.state;
 const banner=ctx.demo?`<p class="plan-state ok">${icon('circle-help')}Demo workspace — the paid steps are unlocked here so you can try them on sample data. Create a private workspace to use them on your own records.</p>`
  :state==='active'?`<p class="plan-state ok">${icon('check')}${h(planLabel(s))} · licensed to ${h(s.payload.name||'you')} until ${h(s.payload.expires)} (${s.daysLeft} day${s.daysLeft===1?'':'s'} left)</p>`
  :state==='trial'?`<p class="plan-state ok">${icon('clock')}Pro trial · ${s.daysLeft} day${s.daysLeft===1?'':'s'} left, to ${h(s.expires)}</p>`
  :state==='expired'?`<p class="plan-state warn">${icon('octagon-alert')}${h(s.reason)}</p>`
  :state==='invalid'?`<p class="plan-state bad">${icon('octagon-alert')}${h(s.reason)}</p>`
  :`<p class="plan-state">${icon('circle-help')}Free plan. ${h(s.reason)}</p>`;
 return `<section class="panel settings-panel plan-panel">
  <h2>Your plan</h2>
  ${banner}
  <p class="muted small">On this plan: ${limits.accounts} account${limits.accounts===1?'':'s'} · ${limits.importsPerMonth===Infinity?'unlimited imports':`${limits.importsPerMonth} import a month (${used} used)`} · ${limits.rowsPerImport===8000?'full statements':`${limits.rowsPerImport} rows per import`} · Filing Pack ${limits.filingPack?'included':'not included'}.</p>
  ${ctx.demo?'':`<form id="license-form" class="form-grid">
   <label class="field"><span>Licence key</span><input name="key" type="text" placeholder="HSB1.…" value="${h(ctx.workspace.license.key)}" autocomplete="off" spellcheck="false"></label>
   <div class="drawer-actions"><button type="submit" class="btn primary">${icon('shield-check')}Activate</button>
   ${ctx.workspace.license.key?`<button type="button" class="btn ghost" data-action="remove-license">${icon('trash-2')}Remove key</button>`:''}</div>
   <p class="form-error"></p>
  </form>`}
  <p class="muted small">The key is checked on this device against a signature. It is stored inside your encrypted workspace and is never sent anywhere. If a key expires, every record and every CSV export stays available to you — only imports and the Filing Pack stop.</p>

  <div class="plan-grid">${PLANS.map(p=>`<div class="plan-card ${p.id===((s.state==='active'||s.state==='trial')?s.plan:'free')?'current':''}">
   <h3>${h(p.name)}</h3>
   <p class="price">${h(p.id==='pro'&&LAUNCH_PRICE?`PKR ${LAUNCH_PRICE.toLocaleString('en-PK')}`:p.priceLabel)}</p>
   <p class="muted small">${h(p.id==='pro'&&LAUNCH_PRICE?`first year, then ${p.priceLabel}`:p.sub)}</p>
   <ul>${p.points.map(x=>`<li>${icon('check')}${h(x)}</li>`).join('')}</ul>
  </div>`).join('')}</div>
  ${LAUNCH_PRICE?`<p class="muted small">${h(LAUNCH_NOTE)}</p>`:''}

  <h3>How to pay</h3>
  ${PAYMENT_RAILS.some(r=>r.value)?`<ul class="rails">${PAYMENT_RAILS.filter(r=>r.value).map(r=>`<li><b>${h(r.label)}</b> <span>${h(r.value)}</span></li>`).join('')}</ul>
   <p class="muted small">Send the amount, then send the screenshot to ${SUPPORT_EMAIL?h(SUPPORT_EMAIL):'the support address'}. A key comes back within ${h(KEY_TURNAROUND)}. Refunds within ${REFUND_WINDOW_DAYS} days, no questions asked.</p>`
   :`<p class="muted small">Payment details have not been published in this build. Nothing can be bought here yet — set them in <code>src/pricing.ts</code> and state your refund terms before taking money.</p>`}
  ${BUY_URL?`<p><a class="btn secondary" href="${h(BUY_URL)}" target="_blank" rel="noreferrer noopener">${icon('external-link')}Payment page</a></p>`:''}
  ${serviceConfigured()?`<h3>Where should the key go?</h3>
   <form id="subscribe-form" class="inline-form">
    <input name="email" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" aria-label="Email address" required>
    <button type="submit" class="btn primary">${icon('arrow-right')}Send me the key</button>
   </form>
   <p class="form-error"></p>
   <p class="muted small"><b>Only if you want it by email.</b> Pay however suits you and send the receipt — the key can come back the same way, on WhatsApp or anywhere else. If you do give an address, it is used for your key and occasional product news, nothing else, never sold, and one click unsubscribes. It is never attached to anything financial, because we hold nothing financial.</p>`:''}
 </section>`;
}

export function packGate(ctx:Ctx){
 const state=readiness(ctx.workspace,ctx.year);
 const allowed=ctx.limits.filingPack;
 return `<section class="panel pack-panel">
  <div class="panel-head"><div><h2>Filing Pack</h2><p>One document for your accountant, or to sit beside IRIS while you file. Every figure points at a statement line, an uploaded document or a declaration you made.</p></div></div>
  ${state.blockers.length?`<div class="pack-warn"><h3>${icon('octagon-alert')}${state.blockers.length} thing${state.blockers.length===1?'':'s'} to resolve first</h3><ul>${state.blockers.map(b=>`<li>${h(b)}</li>`).join('')}</ul>
   <p class="muted small">You can still produce the pack. It will print these on its front page, which is the point — a reviewer should see them.</p></div>`
   :`<p class="recon-flag ok">${icon('check')}Nothing is unexplained: every imported line is classified and every account reconciles.</p>`}
  ${state.notes.length?`<p class="muted small">${state.notes.map(h).join(' ')}</p>`:''}
  <div class="drawer-actions">
   ${allowed?`<button class="btn primary" data-action="print-pack">${icon('printer')}Print / save as PDF</button>
    <button class="btn secondary" data-action="pack-json">${icon('download')}Export pack data (JSON)</button>`
   :`<button class="btn primary" data-page="Settings">${icon('lock-keyhole')}Included with Pro — see plans</button>
    <p class="muted small">Your records and CSV exports are not affected by the plan.</p>`}
  </div>
 </section>`;
}

export const accountKindOptions=accountKinds;
export const currencyOptions=currencies;
export const limitsTable=LIMITS;
