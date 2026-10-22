import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import { createIcons, LayoutDashboard, ArrowDownLeft, ArrowUpRight, ReceiptText, FileText, Calculator, Settings, Plus, ArrowRight, Download, Search, ChevronDown, ShieldCheck, LockKeyhole, Wallet, Menu, X, Trash2, Pencil, ExternalLink, RefreshCw, Check, CircleHelp, LogOut, TrendingUp, CircleDollarSign, Landmark, Clock, Upload, Printer, Eye, Copy, OctagonAlert } from 'lucide';
import Decimal from 'decimal.js';
import {blankWorkspace,workspaceSchema,receiptSchema,expenseSchema,invoiceSchema,receiptMath,expenseMath,invoiceTotal,inYear,estimate,sum,money,csv,escapeHTML as h,SOURCES,RULE_VERSION,currencies,type Workspace,type Receipt,type Expense,type Invoice} from './core';
import {derive,seal,unlock,VAULT_KEY,MAX_BACKUP} from './vault';
import {demo} from './demo';
import './style.css';
const icons={LayoutDashboard,ArrowDownLeft,ArrowUpRight,ReceiptText,FileText,Calculator,Settings,Plus,ArrowRight,Download,Search,ChevronDown,ShieldCheck,LockKeyhole,Wallet,Menu,X,Trash2,Pencil,ExternalLink,RefreshCw,Check,CircleHelp,LogOut,TrendingUp,CircleDollarSign,Landmark,Clock,Upload,Printer,Eye,Copy,OctagonAlert};
const app=document.querySelector<HTMLDivElement>('#app')!;
initTheme();
import {icon,fmt,dateLabel,today} from './format';
import {accountSchema,batchSchema,accountKinds,type StatementLine} from './core';
import {parseCsv,findHeader,suggestMapping,buildImport,buildFromRows,MAX_FILE_BYTES,type FieldName} from './statements';
import {checkLicense,trialStatus,limitsFor,planLabel,LIMITS,importsThisMonth,normalizeKey,type LicenseStatus,type Limits} from './license';
import {statementsView,importDrawerBody,documentConsent,planPanel,packGate,type Ctx,type ImportDraft} from './ui-statements';
import {filingPack} from './pack';
import {homeView} from './ui-home';
import {securityPanel,privacyNotice,type TwoFactorDraft} from './ui-privacy';
import {randomSecret,otpauthUri,verifyCode,makeRecoveryCodes,hashAll,hashRecovery,RECOVERY_COUNT} from './totp';
import {checkReview,packDigest,type ReviewStatus} from './review';
import {initTheme,applyTheme,storedTheme,type Theme} from './theme';
import {pingOnce,setPingEnabled,subscribe,serviceConfigured,readerConfigured,extractStatement,EXTRACT_TYPES,READER_NAME} from './service';
let workspace=demo(),mode:'demo'|'vault'|'locked'='demo',page='Today',year=2027,query='',categoryFilter='all',railFilter='all';
let key:CryptoKey|null=null,salt:Uint8Array|null=null,lastActivity=Date.now(),busy=false,drawer='',editId='',fx: {rates:Record<string,number>,time:string,expires:string}|null=null;
let confirmAction:(()=>Promise<void>)|null=null;
let license:LicenseStatus={state:'none',plan:'free',reason:'No licence key entered.'},limits:Limits=LIMITS.free;
let draft:ImportDraft|null=null,lineFilter='pending',accountFilter='all',pendingLine='',moneyTab:MoneyTab='in';
let review:ReviewStatus={state:'none'},twoFactorDraft:TwoFactorDraft|null=null;
let pending2fa:{workspace:Workspace;key:CryptoKey;salt:Uint8Array}|null=null;
let packDigestCache='';
const ctx=():Ctx=>({workspace,year,license,limits,today:today(),draft,lineFilter,accountFilter,demo:mode==='demo'});
const securityCtx=()=>({workspace,review,twoFactorDraft,demo:mode!=='vault'});
/** The review tick and the pack fingerprint are recomputed whenever records change. */
async function refreshReview(){
 try{
  packDigestCache=await packDigest(workspace,year);
  review=await checkReview(workspace.review.certificate,workspace,year);
 }catch{review={state:'invalid',reason:'The review certificate could not be checked in this browser.'};}
}
/** Re-derive entitlements from the stored key. An active key wins; otherwise an
    unfinished trial applies; otherwise the key's own problem is reported. */
async function refreshLicense(){
 if(mode==='demo'){license={state:'trial',plan:'pro',expires:'demo',daysLeft:0};limits=LIMITS.pro;return;}
 const t=today(),raw=workspace.license.key;
 let status:LicenseStatus=raw?await checkLicense(raw,t):{state:'none',plan:'free',reason:'No licence key entered.'};
 if(status.state!=='active'){const trial=trialStatus(workspace.license.trialStarted,t);if(trial.state==='trial')status=trial;}
 license=status;limits=limitsFor(status);
}
function toast(message:string){const t=document.querySelector('#toast')!;t.textContent=message;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),5000);}
function refreshIcons(){createIcons({icons,attrs:{'stroke-width':1.7}});}
function safeError(error:unknown){if(error instanceof Error&&'issues' in error){const issues=(error as {issues:{path:unknown[],message:string}[]}).issues;return issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ');}return error instanceof Error?error.message:'Something went wrong. Try again.';}
async function persist(next:Workspace){workspaceSchema.parse(next);if(mode==='vault'){if(!key||!salt)throw Error('Workspace is locked');const encrypted=await seal(next,key,salt);localStorage.setItem(VAULT_KEY,JSON.stringify(encrypted));}workspace=next;}
async function change(fn:(w:Workspace)=>void){if(busy)return;busy=true;try{const next=structuredClone(workspace);fn(next);await persist(next);drawer='';editId='';await refreshReview();render();toast(mode==='demo'?'Demo updated. Create a private workspace to save your own records.':'Saved to your encrypted workspace.');}catch(e){toast(safeError(e));}finally{busy=false;}}
/* Nine destinations was a filing cabinet. There are four places to be now, and
   the record types that used to be top-level navigation are tabs inside Money,
   because "invoices" and "statement lines" are an accountant's categories, not
   the ones a person arrives with. Old names still resolve, so every existing
   link and button keeps working. */
type MoneyTab='in'|'out'|'invoices'|'statements';
const ROUTES:Record<string,{page:string;tab?:MoneyTab}>={
 Home:{page:'Today'},Today:{page:'Today'},
 Money:{page:'Money'},Income:{page:'Money',tab:'in'},Expenses:{page:'Money',tab:'out'},
 Invoices:{page:'Money',tab:'invoices'},Statements:{page:'Money',tab:'statements'},
 Tax:{page:'Tax'},'Tax center':{page:'Tax'},
 Pack:{page:'Pack'},Reports:{page:'Pack'},
 Settings:{page:'Settings'},Privacy:{page:'Privacy'}
};
function go(p:string){
 const route=ROUTES[p]??{page:'Today'};
 page=route.page;
 if(route.tab)moneyTab=route.tab;
 query='';categoryFilter='all';railFilter='all';drawer='';pendingLine='';
 render();window.scrollTo(0,0);
}
const nav=[['Today','layout-dashboard','Today'],['Money','wallet','Money'],['Tax','calculator','Tax'],
 ['Pack','file-text','Filing Pack'],['Settings','settings','Settings']];
const MONEY_TABS:[MoneyTab,string,string][]=[
 ['in','arrow-down-left','Money in'],['out','arrow-up-right','Money out'],
 ['invoices','receipt-text','Invoices'],['statements','landmark','Statements']
];
function button(label:string,action:string,kind='primary',ico='plus'){return `<button class="btn ${kind}" data-action="${action}">${ico?icon(ico):''}${label}</button>`;}
function render(){
 if(mode==='locked'){renderLocked();return;}
 const e=estimate(workspace,year);
 app.innerHTML=`<aside class="sidebar"><a href="#" class="brand" data-page="Home"><span class="brand-symbol">${icon('wallet')}</span>hisaab<span class="brand-dot">.</span></a><div class="workspace-switch"><span class="avatar">${mode==='demo'?'D':h((workspace.profile.name||'P')[0])}</span><div><b>${mode==='demo'?'Demo workspace':h(workspace.profile.name||'Private workspace')}</b><small>${mode==='demo'?'Explore with sample data':'Encrypted on this device'}</small></div>${icon('chevron-down')}</div><nav aria-label="Main navigation">${nav.map(([p,i,label])=>{
  const waiting=p==='Money'?workspace.lines.filter(l=>l.status==='pending').length+workspace.invoices.filter(v=>v.status==='Sent').length:0;
  return `<button data-page="${p}" class="nav-item ${page===p?'active':''}" ${page===p?'aria-current="page"':''}>${icon(i)}<span>${h(label)}</span>${waiting?`<span class="nav-count">${waiting}</span>`:''}</button>`;
 }).join('')}</nav><div class="sidebar-bottom"><div class="local-card">${icon('shield-check')}<b>Your books. Your device.</b><p>Encrypted storage.<br>No bank credentials needed.</p><button class="text-link" data-page="Privacy">What we can see ${icon('arrow-right')}</button></div><button class="profile" data-page="Settings"><span class="avatar small">${mode==='demo'?'D':h((workspace.profile.name||'P')[0])}</span><span><b>${mode==='demo'?'Demo mode':'Private workspace'}</b><small>${mode==='demo'?'Not your financial data':'Auto-lock after 5 minutes'}</small></span>${icon('settings')}</button></div></aside>
 <div class="main-wrap"><header class="topbar"><button class="icon-btn mobile-menu" data-action="menu" aria-label="Open navigation">${icon('menu')}</button><div class="breadcrumb">Workspace <span>/</span> <b>${page}</b></div><div class="header-actions"><span class="local-tag">${icon('shield-check')}${mode==='demo'?'Sample data':'Encrypted locally'}</span><label class="year-picker"><span class="sr-only">Tax year</span><select id="year"><option value="2027" ${year===2027?'selected':''}>Tax year 2027</option><option value="2026" ${year===2026?'selected':''}>Tax year 2026</option></select>${icon('chevron-down')}</label><button class="icon-btn" data-action="${mode==='vault'?'lock':'create-vault'}" aria-label="${mode==='vault'?'Lock workspace':'Create private workspace'}">${icon('lock-keyhole')}</button></div></header>
 <main><div class="page-title"><div><h1>${page==='Today'?`Your work. <span>Your worth.</span>`:h(String(nav.find(([n])=>n===page)?.[2]??page))}</h1><p>${subheading()}</p></div><div class="title-actions">${page==='Money'?button('Add','add'):page==='Pack'?button('Export worksheet','worksheet','primary','download'):page==='Tax'?button('Export worksheet','worksheet','secondary','download'):''}</div></div>
 ${mode==='demo'?`<div class="demo-banner"><span><span class="status-dot"></span>You're exploring a demo. All clients and amounts are examples.</span><button data-action="${hasVault()?'open-vault':'create-vault'}">${hasVault()?'Unlock your workspace':'Create your private workspace'} ${icon('arrow-right')}</button></div>`:''}
 ${page==='Today'?homeView(ctx(),e)+homeChart():page==='Privacy'?privacyNotice():page==='Money'?moneyView():page==='Tax'?taxView(e):page==='Pack'?reportsView(e):settingsView()}
 <footer><span>Made for independent work in Pakistan.</span><span><button class="text-link" data-page="Privacy">Privacy</button> <span class="foot-dot">·</span> PKR base currency <span class="foot-dot">·</span> ${RULE_VERSION}</span></footer></main></div><nav class="mobile-bottom" aria-label="Quick navigation">${[nav[0],nav[1]].map(([p,i,label])=>{
  const waiting=p==='Money'?workspace.lines.filter(l=>l.status==='pending').length:0;
  return `<button data-page="${p}" class="${page===p?'active':''}">${icon(i)}${waiting?`<span class="tab-dot">${waiting>9?'9+':waiting}</span>`:''}<span>${h(label)}</span></button>`;
 }).join('')}
 <button class="tab-add" data-action="add" aria-label="Add something">${icon('plus')}</button>
 ${[nav[2],nav[3]].map(([p,i,label])=>`<button data-page="${p}" class="${page===p?'active':''}">${icon(i)}<span>${h(label==='Filing Pack'?'Pack':label)}</span></button>`).join('')}</nav><div id="overlay-root">${drawer?drawerView():''}</div>`;
 refreshIcons();bind();}
function subheading(){const start=year-1;return page==='Today'?`Everything you need to do this tax year, in order. <span class="date-range">Jul ${start} – Jun ${year}</span>`:({Privacy:'What is stored, where it goes, and what we cannot see.',Money:'Everything that came in, went out, or is still owed to you.',Tax:'Pakistani rules. Visible assumptions. Every estimate has a source.',Pack:'One document for your accountant, or for filing it yourself.',Settings:'Your plan, your security, and the answers your tax estimate uses.'} as Record<string,string>)[page];}
const receipts=()=>workspace.receipts.filter(r=>inYear(r.date,year));
const expenses=()=>workspace.expenses.filter(r=>inYear(r.date,year));
function homeChart(){
 const rows=receipts();
 if(!rows.length)return '';
 return `<section class="panel chart-panel"><div class="panel-head"><div><h2>Money reaching you, month by month</h2>
  <p>Take-home after fees and withholding, across the July to June tax year.</p></div></div>${chart(rows)}</section>`;
}
/* A soft area chart rather than paired bars: the shape of a year reads faster
   than twenty-four columns, and the gap between what clients paid and what
   reached you is the thing worth seeing. Colours come from CSS variables so the
   chart follows the theme instead of carrying its own palette. */
function chart(rows:Receipt[]){
 const values=Array.from({length:12},(_,i)=>{
  const m=(i+6)%12+1,y=i<6?year-1:year;
  const rs=rows.filter(r=>r.date.startsWith(`${y}-${String(m).padStart(2,'0')}`));
  return {gross:sum(rs.map(r=>receiptMath(r).gross)),net:sum(rs.map(r=>receiptMath(r).net)),count:rs.length};
 });
 const max=Math.max(100000,...values.map(v=>v.gross))*1.15;
 const W=780,H=250,left=62,right=20,top=18,bottom=36;
 const cw=W-left-right,ch=H-top-bottom;
 const labels=['Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun'];
 const x=(i:number)=>left+cw*i/11;
 const y=(v:number)=>top+ch-(v/max)*ch;
 /** Catmull-Rom through the points, so the line curves without overshooting. */
 const curve=(get:(v:typeof values[number])=>number)=>{
  const pts=values.map((v,i)=>[x(i),y(get(v))] as const);
  let d=`M ${pts[0][0]} ${pts[0][1]}`;
  for(let i=0;i<pts.length-1;i++){
   const p0=pts[i-1]??pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]??pts[i+1];
   const c1x=p1[0]+(p2[0]-p0[0])/6,c1y=p1[1]+(p2[1]-p0[1])/6;
   const c2x=p2[0]-(p3[0]-p1[0])/6,c2y=p2[1]-(p3[1]-p1[1])/6;
   d+=` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
 };
 const netPath=curve(v=>v.net),grossPath=curve(v=>v.gross);
 const area=`${netPath} L ${x(11)} ${top+ch} L ${x(0)} ${top+ch} Z`;
 const money=(v:number)=>v>=1000000?(v/1000000).toFixed(1)+'m':Math.round(v/1000)+'k';
 return `<div class="chart-wrap"><svg viewBox="0 0 ${W} ${H}" role="img"
   aria-label="Take-home and gross PKR by month, July to June. Exact totals are in the Filing Pack.">
  <defs><linearGradient id="net-fill" x1="0" x2="0" y1="0" y2="1">
   <stop offset="0%" stop-color="var(--brand)" stop-opacity=".28"/>
   <stop offset="100%" stop-color="var(--brand)" stop-opacity="0"/></linearGradient></defs>
  ${[0,1,2,3].map(i=>{const val=max*(3-i)/3,gy=top+ch*i/3;
   return `<line x1="${left}" x2="${W-right}" y1="${gy}" y2="${gy}" stroke="var(--line)"/>
    <text x="0" y="${gy+4}" fill="var(--muted)" font-size="11">${money(val)}</text>`;}).join('')}
  <path d="${area}" fill="url(#net-fill)"/>
  <path d="${grossPath}" fill="none" stroke="var(--brand-dim)" stroke-width="2" stroke-dasharray="5 4"/>
  <path d="${netPath}" fill="none" stroke="var(--brand)" stroke-width="2.5" stroke-linecap="round"/>
  ${values.map((v,i)=>`<g><title>${labels[i]}: ${v.count} payment${v.count===1?'':'s'}, clients paid ${fmt(v.gross)}, reached you ${fmt(v.net)}</title>
   <rect x="${x(i)-18}" y="${top}" width="36" height="${ch}" fill="transparent"/>
   ${v.count?`<circle cx="${x(i)}" cy="${y(v.net)}" r="4" fill="var(--surface)" stroke="var(--brand)" stroke-width="2.5"/>`:''}
   <text x="${x(i)}" y="${H-8}" text-anchor="middle" fill="var(--muted)" font-size="11">${labels[i]}</text></g>`).join('')}
 </svg>
 <p class="chart-key"><span class="key-net"></span>What reached you <span class="key-gross"></span>What clients paid</p>
 </div>`;
}
/** A blank client reads as a stated absence, never an empty-looking cell. */
const clientLabel=(c:string)=>c.trim()?h(c):'<span class="muted">No client recorded</span>';
function incomeTable(rows:Receipt[],actions=true){return `<div class="table-scroll"><table class="cards"><thead><tr><th>Client / payment</th><th>Received</th><th>Gross</th><th>Take-home</th>${actions?'<th>Actions</th>':''}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr><td data-label="Client"><div class="client-cell"><span class="client-avatar">${h(r.client.trim()?r.client.slice(0,2).toUpperCase():'—')}</span><div><b>${clientLabel(r.client)}</b><small>${h(r.description||r.rail)}</small></div></div></td><td data-label="Received">${dateLabel(r.date)}<small>${h(r.rail)}</small></td><td data-label="Gross">${fmt(Number(r.gross),r.currency)}<small>${r.rate} PKR/${r.currency}</small></td><td data-label="Take-home" class="amount-cell">${fmt(receiptMath(r).net)}<small class="green">${icon('check')} Recorded</small></td>${actions?`<td data-label="Actions"><div class="row-actions"><button class="icon-btn" aria-label="Edit income for ${h(r.client||'an unnamed source')}" data-edit-income="${r.id}">${icon('pencil')}</button><button class="icon-btn" aria-label="Delete income for ${h(r.client||'an unnamed source')}" data-delete="receipts:${r.id}">${icon('trash-2')}</button></div></td>`:''}</tr>`).join(''):`<tr><td colspan="5"><div class="empty">${icon('wallet')}<h3>No income in this tax year</h3><p>Record a payment when it reaches you. An unpaid invoice stays in Invoices.</p>${button('Record income','new-income')}</div></td></tr>`}</tbody></table></div>`;}
/* One place for money, with the record types as tabs. The counts sit on the tabs
   so you can see what is waiting without opening anything. */
function moneyView(){
 const rows=receipts(),spend=expenses();
 const inPkr=sum(rows.map(r=>receiptMath(r).net));
 const outPkr=sum(spend.map(expenseMath));
 const waitingLines=workspace.lines.filter(l=>l.status==='pending').length;
 const unpaid=workspace.invoices.filter(i=>i.status==='Sent').length;
 const counts:Record<MoneyTab,number>={in:rows.length,out:spend.length,invoices:unpaid,statements:waitingLines};
 return `<div class="money-head">
  <div class="money-summary">
   <div><span>Reached you</span><b>${h(fmt(inPkr))}</b></div>
   <div><span>Business spending</span><b>${h(fmt(outPkr))}</b></div>
   <div><span>Kept</span><b>${h(fmt(Math.max(0,inPkr-outPkr)))}</b></div>
  </div>
  <nav class="tabs" aria-label="Money sections">
   ${MONEY_TABS.map(([key,ico,label])=>`<button class="tab ${moneyTab===key?'active':''}" data-money-tab="${key}">
    ${icon(ico)}<span>${h(label)}</span>${counts[key]?`<i class="tab-count ${key==='statements'||key==='invoices'?'waiting':''}">${counts[key]}</i>`:''}</button>`).join('')}
  </nav>
 </div>
 ${moneyTab==='in'?incomeView():moneyTab==='out'?expensesView():moneyTab==='invoices'?invoicesView():statementsView(ctx())}`;
}
function incomeView(){let rows=receipts().filter(r=>(r.client+' '+r.description+' '+r.evidence).toLowerCase().includes(query.toLowerCase())&&(categoryFilter==='all'||r.category===categoryFilter)&&(railFilter==='all'||r.rail===railFilter)).sort((a,b)=>b.date.localeCompare(a.date));return `<div class="toolbar"><label class="search">${icon('search')}<input id="search" placeholder="Search clients, descriptions or evidence" value="${h(query)}" aria-label="Search income"></label><select id="category-filter" aria-label="Service category"><option value="all">All categories</option>${categoryOptions(categoryFilter)}</select><select id="rail-filter" aria-label="Payment route"><option value="all">All routes</option>${['Payoneer','Wise','Bank transfer','Upwork','Fiverr','Other'].map(v=>`<option ${railFilter===v?'selected':''}>${v}</option>`).join('')}</select>${button('Export CSV','income-csv','secondary','download')}</div><section class="panel">${incomeTable(rows)}</section><p class="note">${rows.length} payments · Gross ${fmt(sum(rows.map(r=>receiptMath(r).gross)))} · Take-home ${fmt(sum(rows.map(r=>receiptMath(r).net)))}. Tax bases are recorded separately from cash settlement.</p>`;}
function invoicesView(){const rows=workspace.invoices.filter(i=>(i.client+' '+i.number).toLowerCase().includes(query.toLowerCase()));return `<div class="toolbar"><label class="search">${icon('search')}<input id="search" placeholder="Search client or invoice number" value="${h(query)}" aria-label="Search invoices"></label><span class="note">Marking paid does not create a receipt.</span></div><section class="panel"><div class="table-scroll"><table class="cards"><thead><tr><th>Invoice / client</th><th>Due</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows.map(i=>`<tr><td data-label="Invoice"><b>${h(i.number)}</b><small>${h(i.client)}</small></td><td data-label="Due">${dateLabel(i.due)}</td><td data-label="Amount" class="amount-cell">${fmt(invoiceTotal(i),i.currency)}</td><td data-label="Status"><span class="pill ${i.status==='Paid'?'paid':i.status==='Sent'?'sent':''}">${i.status}</span></td><td data-label="Actions"><div class="row-actions"><button class="icon-btn" data-print="${i.id}" aria-label="View and print ${h(i.number)}">${icon('printer')}</button><button class="icon-btn" data-edit-invoice="${i.id}" aria-label="Edit ${h(i.number)}">${icon('pencil')}</button><button class="icon-btn" data-delete="invoices:${i.id}" aria-label="Delete ${h(i.number)}">${icon('trash-2')}</button></div></td></tr>`).join('')||'<tr><td colspan="5"><div class="empty"><h3>Your next project starts here.</h3><p>Create an invoice, print it, and share it yourself.</p></div></td></tr>'}</tbody></table></div></section><p class="note">Invoices use the selected invoice currency. No payment is collected and no sales tax is automatically added.</p>`;}
function expensesView(){const rows=expenses().filter(e=>(e.vendor+' '+e.category).toLowerCase().includes(query.toLowerCase()));return `<div class="toolbar"><label class="search">${icon('search')}<input id="search" placeholder="Search vendor or category" value="${h(query)}" aria-label="Search expenses"></label>${button('Export CSV','expense-csv','secondary','download')}</div><section class="panel"><div class="table-scroll"><table class="cards"><thead><tr><th>Vendor</th><th>Date</th><th>Business cost</th><th>Evidence</th><th>Actions</th></tr></thead><tbody>${rows.map(e=>`<tr><td data-label="Vendor"><b>${h(e.vendor)}</b><small>${e.category}</small></td><td data-label="Date">${dateLabel(e.date)}</td><td data-label="Business cost" class="amount-cell">${fmt(expenseMath(e))}<small>${e.businessPct}% of ${fmt(Number(e.amount),e.currency)}</small></td><td data-label="Evidence">${e.receipt?`<button class="text-link" data-view-receipt="${e.id}">${icon('eye')}Receipt</button>`:h(e.evidence||'Not attached')}<small>${e.deductible?'Claimed for domestic business':'Not claimed as tax deduction'}</small></td><td data-label="Actions"><div class="row-actions"><button class="icon-btn" data-edit-expense="${e.id}" aria-label="Edit ${h(e.vendor)}">${icon('pencil')}</button><button class="icon-btn" data-delete="expenses:${e.id}" aria-label="Delete ${h(e.vendor)}">${icon('trash-2')}</button></div></td></tr>`).join('')||'<tr><td colspan="5"><div class="empty"><h3>Keep the evidence with the expense.</h3><p>Add your first expense and optional receipt.</p></div></td></tr>'}</tbody></table></div></section><p class="note">Only explicitly claimed expenses reduce the domestic business scenario. Expenses never reduce the 154A gross-proceeds base.</p>`;}
function taxView(e:ReturnType<typeof estimate>){return `<div class="tax-layout"><div><section class="panel tax-detail"><div class="panel-head"><div><h2>Your federal tax worksheet</h2><p>TY${year} · ${year-1}-07-01 to ${year}-06-30 · ${e.receipts} receipts</p></div><span class="pill sent">${e.liability===null?'Review required':'Estimate available'}</span></div><div class="calculation"><div><span>IT / IT-enabled export proceeds</span><b>${fmt(e.itBase)}</b></div><small>Bank-confirmed tax base × ${e.itRate}% · ${workspace.profile.pseb?'PSEB registered and certified':'PSEB concession not confirmed'} · <a href="${SOURCES[1].url}#page=9" target="_blank" rel="noopener noreferrer">s.154A / Division IVA</a></small><div><span>Other exported service proceeds</span><b>${fmt(e.serviceBase)}</b></div><small>Bank-confirmed tax base × 1% · s.154A / Division IVA</small><div><span>Modeled export tax</span><b>${fmt(e.exportTax)}</b></div><div><span>Domestic business gross</span><b>${fmt(e.localBase)}</b></div><div><span>Domestic processing fees</span><b>− ${fmt(e.localFees)}</b></div><div><span>Claimed business expenses</span><b>− ${fmt(e.expenseDeduction)}</b></div><small>Tax deductibility and apportionment must be reviewed · s.20–21</small><div><span>Domestic taxable-profit scenario</span><b>${fmt(e.profit)}</b></div><div><span>Progressive business tax</span><b>${fmt(e.business.base)}</b></div><small>0 / 15 / 20 / 30 / 40 / 45% marginal slabs · First Schedule Part I Division I</small><div><span>Surcharge on business tax</span><b>${fmt(e.business.surcharge)}</b></div><small>10% of slab tax where taxable business income exceeds PKR 10m · s.4AB</small><div class="calc-total"><span>Modeled federal reserve</span><b>${fmt(e.reserve)}</b></div><div><span>Export withholding recorded</span><b>${fmt(e.paidExport)}</b></div><div><span>Domestic withholding recorded</span><b>${fmt(e.paidLocal)}</b></div><div><span>Additional modeled reserve</span><b>${fmt(e.balance)}</b></div><small>Credit matched within each regime only. Excess withholding does not generate an automatic refund.</small></div><div class="notice">${icon('octagon-alert')}<div><b>${e.liability===null?'Final liability is blocked pending review.':'Federal estimate only, based on confirmed inputs.'}</b><p>${h(e.note)}</p></div></div></section>
 <section class="panel source-panel"><h2>Rules behind the numbers</h2><p>Official Pakistani sources · checked 21 October 2026 · rule set ${RULE_VERSION}</p>${SOURCES.map(s=>`<a href="${s.url}" target="_blank" rel="noopener noreferrer" class="source-row"><div><b>${s.title}</b><small>${s.detail}</small></div>${icon('external-link')}</a>`).join('')}<p class="note">Rules can change after this review. This release supports TY2026 and TY2027 only. It is not affiliated with FBR, PSEB or any payment provider.</p></section></div>
 <div><section class="panel checks-panel"><h2>Before you rely on it</h2><p>Confirm your facts in the tax profile.</p>${e.reasons.map(r=>`<div class="check-item">${icon('circle-help')}<p>${h(r)}</p></div>`).join('')||`<div class="check-item green">${icon('check')}<p>All supported-profile checks confirmed. Have a practitioner review the worksheet.</p></div>`}${button('Update tax profile','tax-profile','primary','settings')}</section><section class="panel filing-panel"><h2>Filing checklist</h2><ul><li>Income return and business schedules</li><li>Bank PRCs/ePRCs & withholding certificates</li><li>Valid PSEB certificate, if applicable</li><li>Personal wealth statement and reconciliation (s.116)</li><li>Provincial/ICT sales-tax returns where required</li><li>IRIS classifications verified by your accountant</li></ul><a class="text-link" href="https://iris.fbr.gov.pk/" target="_blank" rel="noopener noreferrer">Open FBR IRIS ${icon('external-link')}</a></section><section class="panel filing-panel"><h2>All Pakistan, clearly scoped</h2><p>Punjab, Sindh, KP, Balochistan and ICT have separate service-tax rules. AJK/GB and non-resident cases require specialist review. A federal estimate is never presented as all taxes payable.</p></section></div></div>`;}
function reportsView(e:ReturnType<typeof estimate>){const rs=receipts();return `${packGate(ctx())}<section class="panel report-panel"><h2>Your year, without the guesswork.</h2><p>Export records and a source-linked calculation worksheet. These files contain financial data; share them only with someone you trust.</p><div class="export-options"><div><h3>Income ledger</h3><p>Gross, fees, actual FX, settlement, tax base and evidence reference.</p>${button('Download income CSV','income-csv','secondary','download')}</div><div><h3>Business expenses</h3><p>Original currency, business-use allocation and claimed deductions.</p>${button('Download expense CSV','expense-csv','secondary','download')}</div><div><h3>Tax worksheet</h3><p>Calculation inputs, separate regimes, checks, sources and limitations.</p>${button('Download worksheet JSON','worksheet','primary','download')}${button('Print worksheet','print-worksheet','secondary','printer')}</div></div></section><section class="panel"><div class="panel-head"><h2>Monthly reconciliation</h2><span class="note">Tax year ${year}</span></div><div class="table-scroll"><table><thead><tr><th>Month</th><th>Gross PKR</th><th>Fees PKR</th><th>Withheld PKR</th><th>Take-home PKR</th></tr></thead><tbody>${Array.from({length:12},(_,i)=>{const m=(i+6)%12+1,y=i<6?year-1:year,month=`${y}-${String(m).padStart(2,'0')}`,rows=rs.filter(r=>r.date.startsWith(month));return `<tr><td>${dateLabel(month+'-01').replace('1 ','')}</td>${['gross','fees','withheld','net'].map(k=>`<td class="amount-cell">${fmt(sum(rows.map(r=>receiptMath(r)[k as 'gross'])))}</td>`).join('')}</tr>`;}).join('')}</tbody></table></div></section><p class="note">${e.liability===null?'Review required: exported worksheet is not a completed tax return.':'Worksheet is an estimate for review.'} Invoice totals are excluded until receipts are recorded.</p>`;}
/* The declarations behind the tax estimate, in words someone can actually answer.
   The legal wording is kept beside each one rather than instead of it: a person
   who ticks "yes" to something they do not understand produces a confident wrong
   number, and our gates depend on these answers being true. Grouped so the
   export-only questions are visibly export-only. */
const checks:[string,string,string,string][]=[
 ['resident','You','I live in Pakistan and pay tax here as an individual','Resident individual under s.82. If you spent most of the year abroad, this needs a practitioner.'],
 ['otherIncome','You','I also have a salary, property, shares or other income','Tick this if any of it applies. Hisaab covers freelance and small business income only, and will stop short of a final figure so the rest is not left out.'],
 ['pseb','Export work','I am registered with PSEB and my certificate covers this work','Only then is the IT/ITeS export rate 0.25% instead of 1%. Registered but not certified for this service does not count.'],
 ['returnFiled','Export work','I have filed, or will file, my income tax return for this year','One of the conditions for export income being taxed as a final liability (s.154A).'],
 ['statementsFiled','Export work','I have filed any withholding statements I was required to file','If none were required of you, that counts as yes.'],
 ['salesReturns','Export work','I have filed any sales tax returns I was required to file','Required for other service exports, and for IT exports without PSEB certification. If none were required, that counts as yes.'],
 ['noForeignCredit','Export work','I am not claiming credit for tax paid in another country','Claiming foreign tax credit against these receipts takes them out of the final-tax regime.'],
 ['noOptOut','Export work','I have not opted out of final taxation on exports','Most people have not. If you filed an option to be taxed normally instead, untick this.'],
 ['simpleBusiness','Local work','My local work is a simple one-person service business on a cash basis','Not a company, not a partnership, no stock or manufacturing. Income counted when the money arrives.'],
 ['deductionsReviewed','Local work','I have checked that the expenses I claim are genuinely business expenses','Under s.20–21, and apportioned where something is part personal. Ticking this without checking is how deductions get disallowed.'],
 ['provinceReviewed','Sales tax','I have looked into whether I owe provincial or ICT sales tax separately','Hisaab does not calculate sales tax at all. Services can be taxable in Punjab, Sindh, KP, Balochistan or ICT regardless of income tax.']
];
function settingsView(){return `<div class="settings-grid">${planPanel(ctx())}${securityPanel(securityCtx())}<section class="panel settings-panel"><h2>Tax profile</h2><p>These are your declarations, not checks against government records. Confirm them separately for each year before relying on an estimate.</p><form id="profile-form">${input('Workspace name','name',workspace.profile.name,'text',false)}${select('Province / territory','province',['Punjab','Sindh','Khyber Pakhtunkhwa','Balochistan','Islamabad','AJK / GB'],workspace.profile.province)}<div class="notice compact">Changing tax year resets year-specific confirmations. PSEB and residency must reflect the selected year.</div>${(()=>{let group='';return checks.map(([k,section,label,note])=>{
   const heading=section!==group?`<h3 class="check-group">${h(section)}</h3>`:'';group=section;
   return `${heading}<label class="check-label wide-check"><input type="checkbox" name="${k}" ${workspace.profile.confirmedYear===year&&workspace.profile[k as keyof Workspace['profile']]?'checked':''}><span><b>${h(label)}</b><small>${h(note)}</small></span></label>`;
  }).join('');})()}<button class="btn primary" type="submit">${icon('check')}Save tax profile</button></form></section><div><section class="panel settings-panel"><h2>Private by design</h2><div class="privacy-list"><p>${icon('lock-keyhole')}AES-256-GCM encrypted browser storage</p><p>${icon('shield-check')}Passphrase stays on your device</p><p>${icon('clock')}Automatic lock after 5 minutes of inactivity</p></div><p>Invoices, income, expenses, receipts and profile are the complete data inventory. No analytics, advertising, bank connection or customer-data server. Optional FX requests share your IP address with ExchangeRate-API, never your ledger.</p><p>Encryption cannot protect an unlocked or compromised browser. Back up regularly. There is no passphrase recovery.</p>${mode==='demo'?button(hasVault()?'Unlock workspace':'Create private workspace',hasVault()?'open-vault':'create-vault','primary','lock-keyhole'):button('Lock workspace','lock','secondary','lock-keyhole')}</section><section class="panel settings-panel"><h2>Backup & portability</h2><p>An encrypted backup includes receipts. Restoring replaces the current workspace after you confirm. Plain CSV and worksheet exports are available in Reports.</p>${button('Download encrypted backup','backup','secondary','download')}<label class="btn secondary file-label">${icon('upload')}Restore encrypted backup<input id="restore-file" type="file" accept="application/json,.json" hidden></label><p class="note">Current mode: ${mode==='demo'?'unsaved demo':'encrypted workspace'} · ${workspace.receipts.length} receipts · ${workspace.expenses.length} expenses · ${workspace.invoices.length} invoices</p></section><section class="panel settings-panel danger-zone"><h2>Delete this workspace</h2><p>Removes only Hisaab's encrypted data on this browser. Download a backup first. Copies you exported remain on your device.</p>${button('Delete local workspace','delete-vault','danger','trash-2')}</section></div></div>`;}
function input(label:string,name:string,value:unknown='',type='text',required=true,extra=''){return `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${h(value)}" ${required?'required':''} ${extra} ${type==='number'?`${extra.includes('step=')?'':'step="0.01"'} min="0"`:''} ${type==='text'?'maxlength="400"':''}></label>`;}
function select(label:string,name:string,values:readonly string[],value:string){return `<label class="field"><span>${label}</span><select name="${name}">${values.map(v=>`<option value="${h(v)}" ${v===value?'selected':''}>${h(v)}</option>`).join('')}</select></label>`;}
function categoryOptions(value:string){return [['it-export','IT / IT-enabled export'],['service-export','Other service export'],['domestic','Domestic freelance business'],['social-media','Social media revenue — review'],['other','Other / unsure — review']].map(([v,l])=>`<option value="${v}" ${value===v?'selected':''}>${l}</option>`).join('');}
function checkInput(label:string,name:string,value:boolean){return `<label class="check-label"><input name="${name}" type="checkbox" ${value?'checked':''}><span>${label}</span></label>`;}
function drawerView(){let title='',body='';
 if(drawer==='income'){const r=workspace.receipts.find(r=>r.id===editId);title=r?'Edit received payment':'Record income';body=`<p class="drawer-intro">Use your actual statement. Reference FX never replaces a bank settlement rate.</p><form id="income-form"><div class="form-grid">${input('Client or source','client',r?.client,'text',false,'placeholder="Leave blank for cash, tips or a one-off"')}${input('Received date','date',r?.date||today(),'date')}${input('Description','description',r?.description,'text',false)}${select('Payment route','rail',['Payoneer','Wise','Bank transfer','Upwork','Fiverr','Other'],r?.rail||'Bank transfer')}${select('Currency','currency',currencies,r?.currency||'USD')}${input('Gross received · original currency','gross',r?.gross||'','number')}${input('Processor fee · same currency','fee',r?.fee||'0','number')}${input('Actual PKR per 1 currency unit','rate',r?.rate||'','number',true,'data-rate step="0.000001"')}${input('Bank fee · PKR','bankFee',r?.bankFee||'0','number')}${input('Pakistan tax withheld · PKR','withheld',r?.withheld||'0','number')}<label class="field"><span>Service / tax category</span><select name="category">${categoryOptions(r?.category||'it-export')}</select></label>${input('PRC / bank / certificate reference','evidence',r?.evidence,'text',false)}${input('Gross realized tax base · PKR','taxBase',r?.taxBase||'0','number')}</div><div class="notice compact">154A tax base is gross realized proceeds per bank evidence, before fees. A platform invoice, overseas balance or home remittance is not automatically a qualifying export realization.</div>${checkInput('Realized through an authorized banking channel','banking',r?.banking||false)}${checkInput('Tax base and currency conversion reconciled to bank / tax evidence (s.71)','baseConfirmed',r?.baseConfirmed||false)}<div id="income-preview" class="form-preview"></div><div class="form-error" role="alert"></div><button class="btn primary wide" type="submit">${icon('check')}Save received payment</button></form>`;}
 else if(drawer==='expense'){const e=workspace.expenses.find(e=>e.id===editId);title=e?'Edit expense':'Add an expense';body=`<form id="expense-form"><div class="form-grid">${input('Vendor','vendor',e?.vendor)}${input('Expense date','date',e?.date||today(),'date')}${select('Category','category',['Software','Internet','Equipment','Office','Travel','Other'],e?.category||'Software')}${input('Amount · original currency','amount',e?.amount||'','number')}${select('Currency','currency',currencies,e?.currency||'PKR')}${input('Actual PKR per unit','rate',e?.rate||'1','number',true,'step="0.000001"')}${input('Business use · %','businessPct',e?.businessPct??100,'number',true,'max="100"')}${input('Receipt / evidence reference','evidence',e?.evidence||'','text',false)}</div><label class="field"><span>Receipt · PNG, JPEG or PDF · max 1 MB</span><input type="file" id="receipt-file" accept="image/png,image/jpeg,application/pdf"></label>${e?.receipt?`<p class="note">Attached: ${h(e.receipt.name)}. A new file replaces it.</p>${checkInput('Remove existing attachment','removeReceipt',false)}`:''}${checkInput('Claim against domestic business income only (deductibility reviewed)','deductible',e?.deductible||false)}<div class="notice compact">Equipment may require depreciation; personal costs and export-related costs are not automatically domestic deductions.</div><div class="form-error" role="alert"></div><button class="btn primary wide" type="submit">${icon('check')}Save expense</button></form>`;}
 else if(drawer==='invoice'){const i=workspace.invoices.find(i=>i.id===editId);title=i?'Edit invoice':'Create an invoice';body=`<form id="invoice-form"><div class="form-grid">${input('Invoice number','number',i?.number||`INV-${year}-${String(workspace.invoices.length+1).padStart(3,'0')}`)}${input('Your name / business','issuer',i?.issuer||workspace.profile.name)}${input('Client / business','client',i?.client)}${input('Client email (optional)','email',i?.email||'','email',false)}${input('Issue date','date',i?.date||today(),'date')}${input('Due date','due',i?.due||today(),'date')}${select('Currency','currency',currencies,i?.currency||'USD')}${select('Status','status',['Draft','Sent','Paid'],i?.status||'Draft')}${input('Quantity','quantity',i?.quantity||1,'number')}${input('Unit price','unitPrice',i?.unitPrice||'','number')}</div>${input('Service description','description',i?.description)}${input('Notes / payment instructions','notes',i?.notes||'','text',false)}<p class="note">No email is sent. Print or save as PDF and share yourself. Record payment separately when received.</p><div class="form-error" role="alert"></div><button class="btn primary wide" type="submit">${icon('check')}Save invoice</button></form>`;}
 else if(drawer==='create-vault'||drawer==='open-vault'){title=drawer==='create-vault'?'Your books, privately.':'Unlock your workspace';body=`<div class="vault-illustration">${icon('lock-keyhole')}</div><p>Your records are encrypted on this browser. Your passphrase is never sent to a server. There is no reset or recovery service.</p><form id="vault-form">${drawer==='create-vault'?input('Workspace name','name','','text'):''}<label class="field"><span>Passphrase · 12–256 characters</span><input type="password" name="passphrase" minlength="12" maxlength="256" required autocomplete="${drawer==='create-vault'?'new-password':'current-password'}"></label>${drawer==='create-vault'?'<label class="field"><span>Confirm passphrase</span><input type="password" name="confirm" minlength="12" maxlength="256" required autocomplete="new-password"></label><p class="note">Starts with an empty ledger. Demo data is not copied.</p>':''}<div class="form-error" role="alert"></div><button class="btn primary wide" type="submit">${icon('lock-keyhole')}${drawer==='create-vault'?'Create encrypted workspace':'Unlock workspace'}</button></form>`;}
 else if(drawer==='fx'){title='From dollars to rupees.';body=`<p>Reference rates are indicative market quotes, not provider offers or tax-conversion evidence. Actual fees and rates vary.</p><form id="fx-form"><div class="form-grid">${select('Currency','currency',currencies,'USD')}${input('Gross amount','gross','1000','number')}${input('Provider fee · same currency','fee','20','number')}${input('Your actual PKR rate','rate','280','number',true,'step="0.000001"')}${input('Bank fee · PKR','bankFee','0','number')}</div><div class="form-error" role="alert"></div><button class="btn primary" type="submit">Calculate take-home</button></form><div id="fx-result" class="fx-result"></div><hr><h3>Optional live reference</h3><p>Fetches one public currency table from ExchangeRate-API. This shares your IP address, never your ledger. Rates may be delayed and are not historical quotes.</p>${button('Fetch reference quote','fetch-fx','secondary','refresh-cw')}<div id="live-fx" class="note">${fx?fxDetails():''}</div><a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer" class="source-link">Rates by ExchangeRate-API ${icon('external-link')}</a>`;}
 else if(drawer==='confirm'){title='Confirm this change';body=`<p id="confirmation-message">${h(confirmMessage)}</p><div class="form-error" role="alert"></div><div class="confirm-actions">${button('Cancel','close','secondary','')}${button('Confirm','confirm','danger','check')}</div>`;}
 else if(drawer==='restore'){title='Restore encrypted backup';body=`<p>Restoring replaces the current local workspace, including receipts. Export a backup first. Use the passphrase belonging to the selected backup.</p><form id="restore-form"><label class="field"><span>Backup passphrase</span><input name="passphrase" type="password" minlength="12" maxlength="256" required autocomplete="current-password"></label>${checkInput('I understand this replaces the current workspace','replace',false)}<div class="form-error" role="alert"></div><button class="btn primary" type="submit">Decrypt and replace</button></form>`;}
 else if(drawer==='account'){const a=workspace.accounts.find(v=>v.id===editId);title=a?'Edit account':'Add an account';
  body=`<p class="drawer-intro">One account per statement you import. The opening and closing balances come off the statement itself — they are what lets Hisaab tell you when something is missing.</p>
  <form id="account-form"><div class="form-grid">
  ${input('Name you will recognise','label',a?.label??'','text',true,'placeholder="Meezan current account"')}
  ${select('Kind','kind',accountKinds,a?.kind??'Bank')}
  ${select('Statement currency','currency',currencies,a?.currency??'PKR')}
  ${input('Bank or provider','institution',a?.institution??'','text',false)}
  ${input('Last digits or reference','reference',a?.reference??'','text',false,'placeholder="••4821"')}
  ${input('Statement period starts','periodStart',a?.periodStart??`${year-1}-07-01`,'date')}
  ${input('Statement period ends','periodEnd',a?.periodEnd??`${year}-06-30`,'date')}
  ${input('Opening balance on the statement','opening',a?.opening??'0','text',true,'placeholder="0.00"')}
  ${input('Closing balance on the statement','closing',a?.closing??'0','text',true,'placeholder="0.00"')}
  </div>
  ${checkInput('I have copied these balances from the statement itself','balancesConfirmed',a?.balancesConfirmed??false)}
  <div class="form-error" role="alert"></div>
  <div class="drawer-actions">${a?`<button type="button" class="btn ghost" data-delete-account="${a.id}">${icon('trash-2')}Remove account</button>`:''}
  <button type="button" class="btn ghost" data-action="close">Cancel</button><button type="submit" class="btn primary">${icon('check')}${a?'Save account':'Add account'}</button></div></form>`;}
 else if(drawer==='import'){title=draft?.kind==='document'?'Check what was read':'Import a statement';body=importDrawerBody(ctx());}
 else if(drawer==='read-document'){title='Read a PDF statement';body=documentConsent(ctx());}
 else if(drawer==='add'){title='What would you like to add?';
  const choices:[string,string,string,string][]=[
   ['new-income','arrow-down-left','I got paid','Record a payment that has arrived, in any currency, with the real rate and fees.'],
   ['new-expense','arrow-up-right','I spent money on work','A business cost, with how much of it was for work.'],
   ['new-invoice','receipt-text','Send an invoice','A bill for work you have done. It does not become income until the money lands.'],
   ['import-statement','upload','Import a bank statement','A CSV from your bank, Payoneer or Wise. Hisaab reads the rows so you do not have to type them.'],
   ...(readerConfigured()&&limits.filingPack?[['read-document','file-text','Read a PDF statement','For banks that will not give you a CSV. The document is sent to be read — you confirm first.'] as [string,string,string,string]]:[]),
   ['new-account','landmark','Add an account','A bank account or wallet your work money passes through.']
  ];
  body=`<p class="drawer-intro">Everything you can record, in one place.</p>
  <div class="add-list">${choices.map(([action,ico,label,note])=>`<button class="add-choice" data-action="${action}">
   <span class="add-mark">${icon(ico)}</span><span><b>${h(label)}</b><small>${h(note)}</small></span>${icon('arrow-right')}</button>`).join('')}</div>`;}
 return `<div class="overlay"><button class="overlay-shade" data-action="close" aria-label="Close panel"></button><section class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title"><div class="drawer-head"><h2 id="drawer-title">${title}</h2><button class="icon-btn" data-action="close" aria-label="Close panel">${icon('x')}</button></div>${body}</section></div>`;}
let confirmMessage='',backupToRestore='';
function openDrawer(type:string,id=''){drawer=type;editId=id;render();const el=document.querySelector<HTMLInputElement>('.drawer input');if(el)el.focus();if(pendingLine)prefillFromLine();if(type==='income')updateIncomePreview();}
function confirmChange(message:string,action:()=>Promise<void>){confirmMessage=message;confirmAction=action;openDrawer('confirm');}
function hasVault(){try{return !!localStorage.getItem(VAULT_KEY);}catch{return false;}}
function renderLocked(){
 if(pending2fa){
  const left=RECOVERY_COUNT-pending2fa.workspace.security.recoveryUsed;
  app.innerHTML=`<main class="lock-screen"><a class="brand" href="#"><span class="brand-symbol">${icon('wallet')}</span>hisaab<span class="brand-dot">.</span></a>
   <section class="panel lock-panel"><div class="vault-illustration">${icon('shield-check')}</div>
   <h1>One more step</h1>
   <p>Your passphrase was correct. Enter the 6-digit code from your authenticator app to open the workspace.</p>
   <form id="unlock-2fa-form"><label class="field"><span>Authenticator code</span>
    <input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="000000" required></label>
    <div class="form-error" role="alert"></div>
    <button type="submit" class="btn primary wide">${icon('lock-keyhole')}Open workspace</button></form>
   <details class="lock-help"><summary>I do not have my authenticator</summary>
    <p>Use one of your recovery codes. Each one works once; you have ${left} left.</p>
    <form id="recovery-form"><label class="field"><span>Recovery code</span>
     <input name="code" placeholder="XXXXX-XXXXX" autocomplete="off" spellcheck="false" required></label>
     <div class="form-error" role="alert"></div>
     <button type="submit" class="btn secondary wide">Use a recovery code</button></form>
    <p class="muted small">If you have neither, nobody can open this workspace — not us either. That is the trade for having no account to reset.</p></details>
   <button class="text-link" data-action="cancel-2fa">Start again</button>
   </section></main>`;
  refreshIcons();bind();return;
 }
 app.innerHTML=`<main class="lock-screen"><a class="brand" href="#"><span class="brand-symbol">${icon('wallet')}</span>hisaab<span class="brand-dot">.</span></a><section class="panel lock-panel"><div class="vault-illustration">${icon('lock-keyhole')}</div><h1>Your books are locked.</h1><p>Enter your passphrase to return to your private workspace.</p><form id="unlock-form"><label class="field"><span>Passphrase</span><input name="passphrase" type="password" minlength="12" maxlength="256" required autocomplete="current-password"></label><div class="form-error" role="alert"></div><button class="btn primary wide" type="submit">Unlock workspace ${icon('arrow-right')}</button></form><button class="text-link" data-action="demo">Explore demo instead</button><p class="note">No passphrase recovery. Your backup remains encrypted.</p>
 <ul class="trust-list lock-trust">
  <li>${icon('shield-check')}<span>Your books are encrypted on this device. We have no copy and no way to read them.</span></li>
  <li>${icon('circle-help')}<span>Hisaab is not connected to FBR or your bank, and files nothing on your behalf.</span></li>
 </ul></section></main>`;refreshIcons();bind();}
function lock(){document.querySelector('#print-surface')?.remove();pending2fa=null;twoFactorDraft=null;fx=null;workspace=blankWorkspace();key=null;salt=null;mode='locked';drawer='';editId='';backupToRestore='';render();}
function download(name:string,content:string,mime='application/json'){const url=URL.createObjectURL(new Blob([content],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function incomeCsv(){download(`hisaab-income-TY${year}.csv`,csv([['Date','Client','Description','Currency','Gross','Foreign fee','PKR per unit','Bank fee PKR','Withheld PKR','Gross PKR','Net PKR','Tax base PKR','Base confirmed','Rail','Category','Bank evidence','Banking channel'],...receipts().map(r=>[r.date,r.client,r.description,r.currency,r.gross,r.fee,r.rate,r.bankFee,r.withheld,receiptMath(r).gross,receiptMath(r).net,r.taxBase,r.baseConfirmed,r.rail,r.category,r.evidence,r.banking])]),'text/csv;charset=utf-8');}
function expenseCsv(){download(`hisaab-expenses-TY${year}.csv`,csv([['Date','Vendor','Category','Currency','Amount','PKR rate','Business use %','Business cost PKR','Domestic deduction claimed','Evidence','Attachment name'],...expenses().map(e=>[e.date,e.vendor,e.category,e.currency,e.amount,e.rate,e.businessPct,expenseMath(e),e.deductible,e.evidence,e.receipt?.name||''])]),'text/csv;charset=utf-8');}
function worksheet(){return {...estimate(workspace,year),generatedAt:new Date().toISOString(),mode,profile:workspace.profile,receipts:receipts(),expenses:expenses().map(({receipt,...e})=>({...e,attachmentName:receipt?.name||null})),dataBoundary:'For accountant review; not an IRIS return or import file. Invoices excluded until received.'};}
function printHTML(title:string,body:string){const existing=document.querySelector('#print-surface');existing?.remove();const el=document.createElement('section');el.id='print-surface';el.innerHTML=`<div class="print-top">${h(title)}<button class="btn secondary" data-action="print-now">Print / Save PDF</button><button class="btn secondary" data-action="close-print">Close preview</button></div>${body}`;document.body.append(el);refreshIcons();el.querySelector('[data-action="print-now"]')?.addEventListener('click',()=>window.print());el.querySelector('[data-action="close-print"]')?.addEventListener('click',()=>el.remove());}
function printInvoice(id:string){const i=workspace.invoices.find(i=>i.id===id)!;printHTML(i.number,`<div class="invoice-paper"><div class="invoice-heading"><div><h1>Invoice</h1><p>${h(i.number)}</p></div><b>hisaab.</b></div><div class="invoice-parties"><div><small>From</small><h2>${h(i.issuer)}</h2></div><div><small>Bill to</small><h2>${h(i.client)}</h2><p>${h(i.email)}</p></div></div><p>Issued ${dateLabel(i.date)} · Due ${dateLabel(i.due)} · ${i.status}</p><table><thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody><tr><td>${h(i.description)}</td><td>${i.quantity}</td><td>${fmt(Number(i.unitPrice),i.currency)}</td><td>${fmt(invoiceTotal(i),i.currency)}</td></tr></tbody></table><div class="invoice-total">Total due <strong>${fmt(invoiceTotal(i),i.currency)}</strong></div><p>${h(i.notes)}</p><p class="note">No sales tax added. This is a commercial invoice, not an FBR digital tax invoice.</p></div>`);}
function printWorksheet(){const e=estimate(workspace,year);printHTML(`Tax worksheet TY${year}`,`<div class="invoice-paper"><h1>Hisaab · Pakistan tax worksheet</h1><p>TY${year} · ${h(workspace.profile.name)} · ${RULE_VERSION} · ${mode==='demo'?'DEMONSTRATION DATA':''}</p><h2>${e.liability===null?'Final liability blocked: review required':'Federal estimate for review'}</h2><pre>${h(JSON.stringify(worksheet(),null,2))}</pre></div>`);}
function fxDetails(){return fx?`USD/PKR ${fx.rates.PKR.toFixed(4)} · Provider timestamp ${h(fx.time)} · Next update ${h(fx.expires)}. ${Date.now()-Date.parse(fx.time)>172800000?'Stale quote — verify before comparing.':''}`:'';}
async function doAction(action:string){switch(action){
 case 'cancel-2fa':pending2fa=null;render();break;
 case 'setup-2fa':{
  if(mode!=='vault'){toast('Create a private workspace first.');break;}
  const secret=randomSecret();
  twoFactorDraft={secret,uri:otpauthUri(secret,workspace.profile.name),codes:makeRecoveryCodes(),confirmed:false};
  render();document.querySelector('.twofa-setup')?.scrollIntoView({block:'start'});break;}
 case 'disable-2fa':
  confirmChange('Turn off the two-factor code? Your passphrase alone will open this workspace again, and your recovery codes stop working.',async()=>{
   await change(w=>{w.security={...w.security,twoFactor:false,totpSecret:'',recovery:[],recoveryUsed:0};});
   twoFactorDraft=null;render();toast('Two-factor codes are off.');});break;
 case 'remove-review':
  confirmChange('Remove this review certificate? Your Filing Pack will print as unreviewed software output again.',async()=>{
   await change(w=>{w.review.certificate='';});await refreshReview();render();});break;
 case 'new-account':{
  if(workspace.accounts.length>=limits.accounts){toast(`Your plan covers ${limits.accounts} account${limits.accounts===1?'':'s'}. Pro covers 10.`);go('Settings');break;}
  openDrawer('account');break;}
 case 'add':openDrawer('add');break;
 case 'read-document':{
  if(!readerConfigured()){toast('Document reading is not switched on in this build.');break;}
  if(!limits.filingPack){toast('Reading documents is part of Pro.');go('Settings');break;}
  if(!workspace.accounts.length){toast('Add the account this statement belongs to first.');openDrawer('account');break;}
  openDrawer('read-document');break;}
 case 'import-statement':{
  if(!workspace.accounts.length){toast('Add the account this statement belongs to first.');openDrawer('account');break;}
  const used=importsThisMonth(workspace.batches,today());
  if(used>=limits.importsPerMonth){toast(`Free covers ${limits.importsPerMonth} import a month. Pro has no limit.`);go('Settings');break;}
  pickStatementFile();break;}
 case 'print-pack':{
  if(!limits.filingPack){toast('The Filing Pack is part of Pro.');go('Settings');break;}
  printHTML(`Filing Pack TY${year}`,filingPack(workspace,year,packPlanLabel(),{digest:packDigestCache,review}).html);break;}
 case 'pack-json':{
  if(!limits.filingPack){toast('The Filing Pack is part of Pro.');go('Settings');break;}
  download(`hisaab-filing-pack-TY${year}.json`,JSON.stringify(filingPack(workspace,year,packPlanLabel(),{digest:packDigestCache,review}).data,null,2));break;}
 case 'remove-license':
  confirmChange('Remove the licence key from this workspace? Your records stay exactly as they are; the paid steps stop until you add a key again.',async()=>{
   await change(w=>{w.license.key='';w.license.activatedAt='';});await refreshLicense();render();});break;
 case 'new-income':openDrawer('income');break;case 'new-invoice':openDrawer('invoice');break;case 'new-expense':openDrawer('expense');break;case 'create-vault':if(hasVault()){openDrawer('open-vault');}else openDrawer('create-vault');break;case 'open-vault':openDrawer('open-vault');break;case 'close':drawer='';confirmAction=null;backupToRestore='';render();break;case 'lock':lock();break;case 'demo':mode='demo';workspace=demo();page='Today';render();break;case 'menu':document.querySelector('.sidebar')?.classList.toggle('mobile-open');break;case 'income-csv':incomeCsv();break;case 'expense-csv':expenseCsv();break;case 'worksheet':download(`hisaab-tax-worksheet-TY${year}.json`,JSON.stringify(worksheet(),null,2));break;case 'print-worksheet':printWorksheet();break;case 'tax-profile':go('Settings');break;case 'fx':openDrawer('fx');break;case 'backup':if(mode!=='vault'){toast('Create or unlock a private workspace before backing up.');break;}download('hisaab-encrypted.backup.json',localStorage.getItem(VAULT_KEY)!);break;case 'delete-vault':if(!hasVault()){toast('No encrypted workspace is stored in this browser.');break;}confirmChange('Delete Hisaab’s encrypted workspace from this browser? This cannot be undone without your backup. Type DELETE to confirm.',async()=>{const input=document.querySelector<HTMLInputElement>('[name="delete-confirm"]');if(input?.value!=='DELETE')throw Error('Type DELETE to confirm.');localStorage.removeItem(VAULT_KEY);key=null;salt=null;mode='demo';workspace=demo();drawer='';page='Today';render();toast('Local encrypted workspace deleted.');});document.querySelector('.confirm-actions')?.insertAdjacentHTML('beforebegin',input('Type DELETE','delete-confirm','','text'));break;case 'confirm':if(confirmAction){try{await confirmAction();confirmAction=null;}catch(e){toast(safeError(e));}}break;case 'fetch-fx':if(workspace.security.offlineOnly){toast('Never touch the network is on. Turn it off in Privacy and security if you want reference rates.');break;}{const b=document.querySelector<HTMLButtonElement>('[data-action="fetch-fx"]')!;b.disabled=true;b.textContent='Fetching…';try{const resp=await fetch('https://open.er-api.com/v6/latest/USD',{referrerPolicy:'no-referrer',credentials:'omit',signal:AbortSignal.timeout(10000)});if(!resp.ok)throw Error('Rate provider is unavailable. Enter a manual bank rate.');const data=await resp.json();if(data.result!=='success'||!currencies.every(c=>typeof data.rates?.[c]==='number'&&Number.isFinite(data.rates[c])&&data.rates[c]>0)||typeof data.time_last_update_utc!=='string'||!Number.isFinite(Date.parse(data.time_last_update_utc)))throw Error('Invalid rate response. Use a manual bank rate.');fx={rates:data.rates,time:data.time_last_update_utc,expires:data.time_next_update_utc};document.querySelector('#live-fx')!.textContent=fxDetails();}catch(e){toast(safeError(e));}finally{b.disabled=false;b.innerHTML=icon('refresh-cw')+'Fetch reference quote';refreshIcons();}break;}}
}
function updateIncomePreview(){const f=document.querySelector<HTMLFormElement>('#income-form');if(!f)return;const d=new FormData(f);try{const gross=new Decimal(String(d.get('gross')||0)),fee=new Decimal(String(d.get('fee')||0)),rate=new Decimal(String(d.get('rate')||0)),bf=new Decimal(String(d.get('bankFee')||0)),wh=new Decimal(String(d.get('withheld')||0));document.querySelector('#income-preview')!.textContent=`Estimated cash settlement: ${fmt(money(gross.minus(fee).mul(rate).minus(bf).minus(wh)))}`;}catch{document.querySelector('#income-preview')!.textContent='Enter valid amounts to preview settlement.';}}
function bind(){bindStatements();bindSecurity();document.querySelectorAll<HTMLElement>('[data-page]').forEach(el=>el.onclick=e=>{e.preventDefault();go(el.dataset.page!);});document.querySelectorAll<HTMLElement>('[data-action]').forEach(el=>el.onclick=()=>{void doAction(el.dataset.action!).catch(e=>toast(safeError(e)));});
 document.querySelector<HTMLSelectElement>('#year')?.addEventListener('change',ev=>{year=Number((ev.target as HTMLSelectElement).value);void refreshReview().then(render);toast('Review the tax profile for the selected year before relying on an estimate.');});
 document.querySelector<HTMLInputElement>('#search')?.addEventListener('input',ev=>{const el=ev.target as HTMLInputElement,pos=el.selectionStart;query=el.value;render();const next=document.querySelector<HTMLInputElement>('#search')!;next.focus();next.setSelectionRange(pos,pos);});
 document.querySelector<HTMLSelectElement>('#category-filter')?.addEventListener('change',ev=>{categoryFilter=(ev.target as HTMLSelectElement).value;render();});document.querySelector<HTMLSelectElement>('#rail-filter')?.addEventListener('change',ev=>{railFilter=(ev.target as HTMLSelectElement).value;render();});
 for(const [attr,type] of [['edit-income','income'],['edit-expense','expense'],['edit-invoice','invoice']])document.querySelectorAll<HTMLElement>(`[data-${attr}]`).forEach(el=>el.onclick=()=>openDrawer(type,el.getAttribute(`data-${attr}`)!));
 document.querySelectorAll<HTMLElement>('[data-print]').forEach(el=>el.onclick=()=>printInvoice(el.dataset.print!));
 document.querySelectorAll<HTMLElement>('[data-delete]').forEach(el=>el.onclick=()=>{const [table,id]=el.dataset.delete!.split(':');confirmChange('Remove this record? Export a backup first if you may need it later.',async()=>{await change(w=>{w[table as 'receipts']=w[table as 'receipts'].filter(r=>r.id!==id);});});});

 document.querySelectorAll<HTMLElement>('[data-view-receipt]').forEach(el=>el.onclick=()=>{const a=workspace.expenses.find(e=>e.id===el.dataset.viewReceipt)?.receipt;if(!a)return;const bytes=Uint8Array.from(atob(a.data.split(',')[1]),c=>c.charCodeAt(0));const url=URL.createObjectURL(new Blob([bytes],{type:a.mime}));const link=document.createElement('a');link.href=url;link.download=a.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);});
 document.querySelector<HTMLFormElement>('#income-form')?.addEventListener('input',updateIncomePreview);
 document.querySelector<HTMLSelectElement>('[name="currency"]')?.addEventListener('change',ev=>{const f=(ev.target as HTMLElement).closest('form');if((ev.target as HTMLSelectElement).value==='PKR'){const r=f?.querySelector<HTMLInputElement>('[name="rate"]');if(r)r.value='1';}updateIncomePreview();});
 bindForm('income-form',async(f,d)=>{const raw=Object.fromEntries(d.entries());const r=receiptSchema.parse({...raw,id:editId||crypto.randomUUID(),banking:d.has('banking'),baseConfirmed:d.has('baseConfirmed')});await change(w=>{const i=w.receipts.findIndex(v=>v.id===r.id);if(i<0)w.receipts.push(r);else w.receipts[i]=r;linkLine(w,r.id,'income');});pendingLine='';});
 bindForm('expense-form',async(f,d)=>{const old=workspace.expenses.find(e=>e.id===editId);let receipt=d.has('removeReceipt')?null:old?.receipt||null;const file=f.querySelector<HTMLInputElement>('#receipt-file')?.files?.[0];if(file){if(file.size>1_000_000)throw Error('Receipt must be 1 MB or smaller.');if(!['image/png','image/jpeg','application/pdf'].includes(file.type))throw Error('Only PNG, JPEG and PDF receipts are supported.');const bytes=new Uint8Array(await file.arrayBuffer());const valid=file.type==='application/pdf'?new TextDecoder().decode(bytes.slice(0,5))==='%PDF-':file.type==='image/png'?bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10':bytes[0]===255&&bytes[1]===216&&bytes[2]===255;if(!valid)throw Error('File content does not match its receipt type.');const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result as string);reader.onerror=()=>reject(Error('Could not read attachment'));reader.readAsDataURL(file);});receipt={name:file.name,mime:file.type as 'image/png',data};}const raw=Object.fromEntries(d.entries());delete raw.removeReceipt;const e=expenseSchema.parse({...raw,id:editId||crypto.randomUUID(),businessPct:Number(d.get('businessPct')),deductible:d.has('deductible'),receipt});await change(w=>{const i=w.expenses.findIndex(v=>v.id===e.id);if(i<0)w.expenses.push(e);else w.expenses[i]=e;linkLine(w,e.id,'expense');});pendingLine='';});
 bindForm('invoice-form',async(f,d)=>{const i=invoiceSchema.parse({...Object.fromEntries(d.entries()),id:editId||crypto.randomUUID(),quantity:Number(d.get('quantity'))});if(workspace.invoices.some(v=>v.number===i.number&&v.id!==i.id))throw Error('Invoice number already exists. Choose a unique number.');await change(w=>{const idx=w.invoices.findIndex(v=>v.id===i.id);if(idx<0)w.invoices.push(i);else w.invoices[idx]=i;});});
 bindForm('profile-form',async(f,d)=>{await change(w=>{w.profile={confirmedYear:year,name:String(d.get('name')),province:d.get('province') as Workspace['profile']['province'],...Object.fromEntries(checks.map(([k])=>[k,d.has(k)]))} as Workspace['profile'];});});
 /** Completes an unlock once every factor has been satisfied. */
 const openWorkspace=async(result:{workspace:Workspace;key:CryptoKey;salt:Uint8Array},message:string)=>{
  workspace=result.workspace;key=result.key;salt=result.salt;mode='vault';drawer='';page='Today';
  pending2fa=null;lastActivity=Date.now();
  await refreshLicense();await refreshReview();render();toast(message);
 };
 const unlockHandler=async(f:HTMLFormElement,d:FormData)=>{
  const raw=localStorage.getItem(VAULT_KEY);
  if(!raw)throw Error('No workspace stored in this browser.');
  const result=await unlock(raw,String(d.get('passphrase')));
  if(result.workspace.security.twoFactor&&result.workspace.security.totpSecret){
   // Hold the decrypted workspace out of the UI until the second factor is given.
   pending2fa=result;mode='locked';drawer='';render();
   document.querySelector<HTMLInputElement>('#unlock-2fa-form input')?.focus();
   return;
  }
  await openWorkspace(result,'Workspace unlocked.');
 };
 bindForm('unlock-2fa-form',async(_f,d)=>{
  if(!pending2fa)throw Error('Start again from your passphrase.');
  const ok=await verifyCode(pending2fa.workspace.security.totpSecret,String(d.get('code')??''));
  if(!ok)throw Error('That code did not match. Codes change every 30 seconds — wait for the next one and try again.');
  await openWorkspace(pending2fa,'Workspace unlocked.');
 });
 bindForm('recovery-form',async(_f,d)=>{
  const held=pending2fa;
  if(!held)throw Error('Start again from your passphrase.');
  const hash=await hashRecovery(String(d.get('code')??''));
  const index=held.workspace.security.recovery.indexOf(hash);
  if(index<0)throw Error('That recovery code is not one of yours, or it has already been used.');
  const next=structuredClone(held.workspace);
  next.security.recovery.splice(index,1);
  next.security.recoveryUsed=Math.min(RECOVERY_COUNT,next.security.recoveryUsed+1);
  // Burn the code before opening, so a reused one cannot work twice.
  localStorage.setItem(VAULT_KEY,JSON.stringify(await seal(next,held.key,held.salt)));
  const left=RECOVERY_COUNT-next.security.recoveryUsed;
  await openWorkspace({...held,workspace:next},
   `Recovery code used. ${left} left — set up your authenticator again from Settings if you have lost it.`);
 });
 bindForm('unlock-form',unlockHandler);
 bindForm('vault-form',async(f,d)=>{if(drawer==='open-vault'){await unlockHandler(f,d);return;}if(hasVault())throw Error('A vault already exists. Unlock or back it up before replacing it.');if(d.get('passphrase')!==d.get('confirm'))throw Error('Passphrases do not match.');const newSalt=crypto.getRandomValues(new Uint8Array(16)),newKey=await derive(String(d.get('passphrase')),newSalt);const next=blankWorkspace();next.profile.name=String(d.get('name'));next.license.trialStarted=today();const sealed=await seal(next,newKey,newSalt);localStorage.setItem(VAULT_KEY,JSON.stringify(sealed));key=newKey;salt=newSalt;workspace=next;mode='vault';drawer='';page='Today';lastActivity=Date.now();await refreshLicense();await refreshReview();render();toast('Encrypted workspace created. Keep a backup and remember your passphrase.');});
 document.querySelector<HTMLInputElement>('#restore-file')?.addEventListener('change',async ev=>{const file=(ev.target as HTMLInputElement).files?.[0];if(!file)return;if(file.size>MAX_BACKUP){toast('Backup is too large.');return;}backupToRestore=await file.text();openDrawer('restore');});
 bindForm('restore-form',async(f,d)=>{if(!d.has('replace'))throw Error('Confirm replacement before restoring.');const result=await unlock(backupToRestore,String(d.get('passphrase')));localStorage.setItem(VAULT_KEY,backupToRestore);key=result.key;salt=result.salt;workspace=result.workspace;mode='vault';drawer='';backupToRestore='';page='Today';lastActivity=Date.now();await refreshLicense();await refreshReview();render();toast('Backup decrypted, validated and restored.');});
 bindForm('fx-form',async(f,d)=>{const vals=['gross','fee','rate','bankFee'].map(k=>new Decimal(String(d.get(k))));const [g,fee,rate,bf]=vals;if(vals.some(v=>!v.isFinite()||v.lt(0))||rate.lte(0)||fee.gt(g)||bf.gt(g.minus(fee).mul(rate)))throw Error('Enter valid amounts; fees cannot exceed proceeds.');const c=String(d.get('currency'));if(c==='PKR'&&!rate.eq(1))throw Error('PKR rate must be 1.');let result=`<h3>${fmt(money(g.minus(fee).mul(rate).minus(bf)))}</h3><p>Take-home after the entered fees</p>`;if(fx){const ref=fx.rates.PKR/fx.rates[c];result+=`<p>Reference ${ref.toFixed(4)} PKR/${h(c)} · Difference before fees ${fmt(money(g.mul(ref).minus(g.mul(rate))))}</p>`;}document.querySelector('#fx-result')!.innerHTML=result;});
}
function bindForm(id:string,handler:(f:HTMLFormElement,d:FormData)=>Promise<void>){const f=document.getElementById(id) as HTMLFormElement|null;if(!f)return;f.onsubmit=async ev=>{ev.preventDefault();const b=f.querySelector<HTMLButtonElement>('[type="submit"]')!;b.disabled=true;const error=f.querySelector('.form-error');if(error)error.textContent='';try{await handler(f,new FormData(f));}catch(e){if(error)error.textContent=safeError(e);else toast(safeError(e));}finally{b.disabled=false;}};}
document.addEventListener('keydown',e=>{lastActivity=Date.now();if(e.key==='Escape'){document.querySelector('#print-surface')?.remove();if(drawer){drawer='';render();}}if(e.key==='Tab'&&drawer){const items=[...document.querySelectorAll<HTMLElement>('.drawer button,.drawer input:not([hidden]),.drawer select,.drawer a')].filter(e=>!(e as HTMLInputElement).disabled);const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
for(const event of ['pointerdown','input','scroll'])document.addEventListener(event,()=>lastActivity=Date.now(),{passive:true});
setInterval(()=>{
 const minutes=workspace.security?.autoLockMinutes??5;
 if(mode==='vault'&&Date.now()-lastActivity>minutes*60000){
  document.querySelector('#print-surface')?.remove();lock();
  toast(`Workspace locked after ${minutes} minute${minutes===1?'':'s'} without activity.`);
 }},10000);
window.addEventListener('storage',e=>{if(e.key===VAULT_KEY&&mode==='vault'){lock();toast('Workspace changed in another tab. Unlock to load the latest version.');}});
window.addEventListener('pagehide',()=>{if(mode==='vault')lock();});
if(hasVault()){mode='locked';workspace=blankWorkspace();}
void refreshLicense().then(()=>{
 render();
 if(serviceConfigured())void pingOnce(license,today());
});

/* ── Statement import, line review and entitlements ───────────────────────── */
const packPlanLabel=()=>mode==='demo'?'Demo workspace (sample data)':planLabel(license);
const lineById=(id:string)=>workspace.lines.find(l=>l.id===id);
/** Attach the record a classified line produced, so the Filing Pack can cite it. */
function linkLine(w:Workspace,recordId:string,status:'income'|'expense'){
 if(!pendingLine)return;
 const l=w.lines.find(x=>x.id===pendingLine);
 if(!l)return;
 l.status=status;l.linkedId=recordId;l.note=`Classified from this statement line (row ${l.row}).`;
}
async function setLineStatus(id:string,status:StatementLine['status'],note:string){
 await change(w=>{
  const l=w.lines.find(x=>x.id===id);
  if(!l)throw Error('That line is no longer in this workspace.');
  l.status=status;l.linkedId='';l.note=note;
 });
}
/** Carry what the statement already told us into the income or expense form.
    The person still confirms every field; the settlement rate is never guessed. */
function prefillFromLine(){
 const l=lineById(pendingLine);if(!l)return;
 const account=workspace.accounts.find(a=>a.id===l.accountId);if(!account)return;
 const form=document.querySelector<HTMLFormElement>('#income-form,#expense-form');if(!form)return;
 const set=(name:string,value:string)=>{const el=form.querySelector<HTMLInputElement|HTMLSelectElement>(`[name="${name}"]`);if(el)el.value=value;};
 const magnitude=new Decimal(l.amount).abs().toFixed(2);
 const reference=`${account.label} · row ${l.row} · ${l.date}`;
 set('date',l.date);set('currency',account.currency);set('evidence',reference);
 if(account.currency==='PKR')set('rate','1');
 if(form.id==='income-form'){
  set('client',(l.counterparty||l.description).slice(0,80));
  set('description',l.description.slice(0,120));
  set('gross',magnitude);
 }else{
  set('vendor',(l.counterparty||l.description).slice(0,80));
  set('amount',magnitude);
 }
 /* What a statement shows is what reached the account — already net of the
    processor's cut. For an export receipt the tax base is the gross realized
    amount, so say this rather than let the figure stand unquestioned. */
 const note=document.createElement('p');
 note.className='prefill-note';
 note.innerHTML=`${icon('circle-help')}<span>Filled in from <b>${h(account.label)}</b>, row ${l.row}. <b>${h(account.currency)} ${magnitude}</b> is what reached the account — usually after the processor's cut. If this was a foreign payment, enter the gross you invoiced, its currency and the actual settlement rate, and record the fees separately. Otherwise an export tax base here will be understated.</span>`;
 form.prepend(note);
}
/* One hidden input, created once and left in the document: browsers are happier
   with a connected input, and the file can be set programmatically for testing. */
const statementInput=(()=>{
 const el=document.createElement('input');
 el.type='file';el.accept='.csv,.txt,text/csv,text/plain';el.id='statement-file';el.hidden=true;
 el.addEventListener('change',()=>{void handleStatementFile();});
 document.body.append(el);
 return el;
})();
function pickStatementFile(){statementInput.value='';statementInput.click();}
async function handleStatementFile(){
  const file=statementInput.files?.[0];if(!file)return;
  try{
   if(file.size>MAX_FILE_BYTES)throw Error(`That file is ${(file.size/1e6).toFixed(1)} MB. Import files up to ${MAX_FILE_BYTES/1e6} MB, or split the statement by month.`);
   const bytes=new Uint8Array(await file.arrayBuffer());
   const text=new TextDecoder('utf-8').decode(bytes);
   if(text.startsWith('%PDF-'))throw Error('That is a PDF. Hisaab reads CSV statements only — export CSV from your bank portal, or enter those rows by hand.');
   if(text.startsWith('PK\u0003\u0004'))throw Error('That looks like an Excel or zip file. Save the sheet as CSV first.');
   const rows=parseCsv(text);
   if(rows.length<2)throw Error('Hisaab found no rows in that file.');
   const headerIndex=findHeader(rows);
   if(headerIndex<0)throw Error('Hisaab could not find a header row with a date and an amount in the first 40 rows. Delete the title rows above the table and try again.');
   const hashed=await crypto.subtle.digest('SHA-256',bytes as BufferSource);
   draft={
    accountId:accountFilter!=='all'?accountFilter:workspace.accounts[0].id,
    filename:file.name.slice(0,120),rows,headerIndex,
    mapping:suggestMapping(rows[headerIndex]),dayFirst:true,
    digest:[...new Uint8Array(hashed)].map(b=>b.toString(16).padStart(2,'0')).join(''),
    preview:null,error:'',kind:'csv',readerNote:''
   };
   recomputePreview();openDrawer('import');
  }catch(e){toast(safeError(e));}
}
function recomputePreview(){
 if(!draft)return;
 const current=draft;
 const account=workspace.accounts.find(a=>a.id===current.accountId);
 if(!account){current.preview=null;current.error='Choose which account this statement belongs to.';return;}
 try{
  const out=buildImport({account,existing:workspace.lines,rows:current.rows,headerIndex:current.headerIndex,
   mapping:current.mapping,batchId:crypto.randomUUID(),dayFirst:current.dayFirst});
  if(out.lines.length>limits.rowsPerImport)
   throw Error(`This file holds ${out.lines.length} readable lines and your plan imports ${limits.rowsPerImport} per file. Pro imports a whole statement.`);
  current.preview=out;current.error='';
 }catch(e){current.preview=null;current.error=safeError(e);}
}
const MAP_FIELDS:FieldName[]=['date','description','counterparty','amount','debit','credit','drcr','balance'];
function bindStatements(){
 document.querySelectorAll<HTMLElement>('[data-money-tab]').forEach(el=>el.onclick=()=>{
  moneyTab=el.dataset.moneyTab as MoneyTab;query='';render();window.scrollTo(0,0);
 });
 document.querySelectorAll<HTMLElement>('[data-line-filter]').forEach(el=>el.onclick=()=>{lineFilter=el.dataset.lineFilter!;render();});
 document.querySelector<HTMLSelectElement>('#account-filter')?.addEventListener('change',ev=>{accountFilter=(ev.target as HTMLSelectElement).value;render();});
 document.querySelectorAll<HTMLElement>('[data-edit-account]').forEach(el=>el.onclick=()=>openDrawer('account',el.dataset.editAccount!));
 document.querySelectorAll<HTMLElement>('[data-delete-account]').forEach(el=>el.onclick=()=>{
  const id=el.dataset.deleteAccount!;
  confirmChange('Remove this account, its imported statement lines and its import history? Income and expense records you already created from those lines are kept. Export a backup first if you may need this later.',async()=>{
   await change(w=>{w.lines=w.lines.filter(l=>l.accountId!==id);w.batches=w.batches.filter(b=>b.accountId!==id);w.accounts=w.accounts.filter(a=>a.id!==id);});
  });
 });
 document.querySelectorAll<HTMLElement>('[data-line-income]').forEach(el=>el.onclick=()=>{pendingLine=el.dataset.lineIncome!;openDrawer('income');});
 document.querySelectorAll<HTMLElement>('[data-line-expense]').forEach(el=>el.onclick=()=>{pendingLine=el.dataset.lineExpense!;openDrawer('expense');});
 document.querySelectorAll<HTMLElement>('[data-line-transfer]').forEach(el=>el.onclick=()=>{
  void setLineStatus(el.dataset.lineTransfer!,'transfer','Marked as a movement between your own accounts, so it is neither income nor spending.').catch(e=>toast(safeError(e)));});
 document.querySelectorAll<HTMLElement>('[data-line-exclude]').forEach(el=>el.onclick=()=>{
  void setLineStatus(el.dataset.lineExclude!,'excluded','Marked as not business related.').catch(e=>toast(safeError(e)));});
 document.querySelectorAll<HTMLElement>('[data-line-reset]').forEach(el=>el.onclick=()=>{
  const l=lineById(el.dataset.lineReset!);const had=!!l?.linkedId;
  void setLineStatus(el.dataset.lineReset!,'pending','').then(()=>{
   if(had)toast('Line is undecided again. Any income or expense record it created is still saved — remove that record from its own page if you no longer want it.');
  }).catch(e=>toast(safeError(e)));});
 document.querySelectorAll<HTMLElement>('[data-pair]').forEach(el=>el.onclick=()=>{
  const [out,into]=el.dataset.pair!.split(':');
  void change(w=>{
   for(const [id,other] of [[out,into],[into,out]]){
    const l=w.lines.find(x=>x.id===id);
    if(!l)throw Error('One side of this pair is no longer in the workspace.');
    l.status='transfer';l.linkedId=other;l.note='Confirmed as a transfer between your own accounts.';
   }
  }).catch(e=>toast(safeError(e)));});

 const mapForm=document.getElementById('map-form') as HTMLFormElement|null;
 if(mapForm)mapForm.onsubmit=ev=>{
  ev.preventDefault();if(!draft)return;
  const d=new FormData(mapForm);
  const nextHeader=Number(d.get('headerIndex'));
  const headerMoved=nextHeader!==draft.headerIndex;
  draft.accountId=String(d.get('accountId')||draft.accountId);
  draft.headerIndex=nextHeader;
  draft.dayFirst=d.get('dayFirst')==='1';
  if(headerMoved)draft.mapping=suggestMapping(draft.rows[nextHeader]??[]);
  else{
   const mapping:Partial<Record<FieldName,number>>={};
   for(const field of MAP_FIELDS){const v=String(d.get('map-'+field)??'');if(v!=='')mapping[field]=Number(v);}
   draft.mapping=mapping;
  }
  recomputePreview();render();
 };
 bindForm('commit-form',async(_f,d)=>{
  const current=draft;
  if(!current?.preview)throw Error('There is nothing to import yet.');
  if(!d.has('understood'))throw Error('Confirm that you have checked the columns and the rows that were not read.');
  const preview=current.preview;
  if(!preview.lines.length)throw Error('No readable lines in this file.');
  const batch=batchSchema.parse({
   id:preview.lines[0].batchId,accountId:current.accountId,filename:current.filename,
   importedAt:new Date().toISOString(),rowCount:preview.rowCount,
   imported:preview.lines.filter(l=>l.status!=='duplicate').length,
   skipped:preview.duplicates+preview.issues.length,digest:current.digest,mapping:preview.mapping,
   source:current.kind,reader:current.kind==='document'?READER_NAME:''
  });
  await change(w=>{w.batches.push(batch);w.lines.push(...preview.lines);});
  draft=null;lineFilter='pending';accountFilter=current.accountId;page='Statements';render();
  toast(`${batch.imported} line${batch.imported===1?'':'s'} imported.${preview.duplicates?` ${preview.duplicates} repeat line${preview.duplicates===1?'':'s'} flagged.`:''}${preview.issues.length?` ${preview.issues.length} row${preview.issues.length===1?'':'s'} not read.`:''} Decide what each one is next.`);
 });
 bindForm('document-form',async(_f,d)=>{
  if(!d.has('understood'))throw Error(`Tick the box to confirm you understand the document is sent to ${READER_NAME}.`);
  documentAccountId=String(d.get('accountId')??'');
  if(!documentAccountId)throw Error('Choose which account this statement belongs to.');
  documentInput.value='';
  documentInput.click();
 });
 bindForm('account-form',async(_f,d)=>{
  const raw=Object.fromEntries(d.entries()) as Record<string,string>;
  const clean=(v:string)=>String(v??'').replace(/[\s,]/g,'');
  if(!editId&&workspace.accounts.length>=limits.accounts)
   throw Error(`Your plan covers ${limits.accounts} account${limits.accounts===1?'':'s'}. Pro covers 10.`);
  const account=accountSchema.parse({
   ...raw,id:editId||crypto.randomUUID(),
   institution:raw.institution??'',reference:raw.reference??'',
   opening:clean(raw.opening||'0'),closing:clean(raw.closing||'0'),
   balancesConfirmed:d.has('balancesConfirmed')
  });
  await change(w=>{const i=w.accounts.findIndex(v=>v.id===account.id);if(i<0)w.accounts.push(account);else w.accounts[i]=account;});
 });
 bindForm('license-form',async(_f,d)=>{
  const key=normalizeKey(String(d.get('key')??''));
  if(!key){await change(w=>{w.license.key='';w.license.activatedAt='';});await refreshLicense();render();return;}
  const status=await checkLicense(key,today());
  if(status.state==='invalid')throw Error(status.reason);
  await change(w=>{w.license.key=key;w.license.activatedAt=today();});
  await refreshLicense();render();
  toast(status.state==='active'?`${planLabel(status)} active to ${status.payload.expires}. Thank you.`:status.state==='expired'?status.reason:'Key stored.');
 });
}

/* ── Privacy, two-factor and the review tick ──────────────────────────────── */
function bindSecurity(){
 document.querySelectorAll<HTMLElement>('[data-copy]').forEach(el=>el.onclick=async()=>{
  try{await navigator.clipboard.writeText(el.dataset.copy!);toast('Copied. Paste it somewhere safe, then clear your clipboard.');}
  catch{toast('This browser would not let the page use the clipboard. Select the text and copy it by hand.');}
 });
 document.querySelector<HTMLSelectElement>('#theme')?.addEventListener('change',ev=>{
  applyTheme((ev.target as HTMLSelectElement).value as Theme);
 });
 document.querySelector<HTMLSelectElement>('#autolock')?.addEventListener('change',ev=>{
  const minutes=Number((ev.target as HTMLSelectElement).value) as 1|5|15|30;
  void change(w=>{w.security.autoLockMinutes=minutes;}).catch(e=>toast(safeError(e)));
 });
 document.querySelector<HTMLInputElement>('#offline-only')?.addEventListener('change',ev=>{
  const on=(ev.target as HTMLInputElement).checked;
  void change(w=>{w.security.offlineOnly=on;}).then(()=>{if(on)fx=null;}).catch(e=>toast(safeError(e)));
 });
 document.querySelector<HTMLInputElement>('#usage-ping')?.addEventListener('change',ev=>{
  const on=(ev.target as HTMLInputElement).checked;
  setPingEnabled(on);
  toast(on?'Thank you. One anonymous ping a day, nothing else.':'Counting is off. Nothing will be sent from this browser.');
 });
 bindForm('subscribe-form',async(_f,d)=>{
  const message=await subscribe(String(d.get('email')??''),'settings');
  toast(message);
  render();
 });
 document.querySelector<HTMLInputElement>('#blur-amounts')?.addEventListener('change',ev=>{
  const on=(ev.target as HTMLInputElement).checked;
  void change(w=>{w.security.blurAmounts=on;}).catch(e=>toast(safeError(e)));
 });
 bindForm('twofa-form',async(_f,d)=>{
  const held=twoFactorDraft;
  if(!held)throw Error('Start the setup again.');
  const ok=await verifyCode(held.secret,String(d.get('code')??''));
  if(!ok)throw Error('That code did not match. Check you copied the whole key, and that your phone clock is correct.');
  const hashes=await hashAll(held.codes);
  await change(w=>{w.security={...w.security,twoFactor:true,totpSecret:held.secret,recovery:hashes,recoveryUsed:0};});
  twoFactorDraft=null;render();
  toast('Two-factor codes are on. You will need your authenticator next time you unlock.');
 });
 bindForm('review-form',async(_f,d)=>{
  const certificate=String(d.get('certificate')??'').replace(/[\s ]/g,'');
  if(!certificate){await change(w=>{w.review.certificate='';});await refreshReview();render();return;}
  const status=await checkReview(certificate,workspace,year);
  if(status.state==='invalid')throw Error(status.reason);
  await change(w=>{w.review.certificate=certificate;});
  await refreshReview();render();
  toast(status.state==='verified'
   ?`Verified: reviewed by ${status.payload.name} on ${status.payload.reviewedOn}.`
   :status.state==='stale'?status.reason:'Certificate stored.');
 });
}

/* ── Reading a statement that only exists as a PDF ────────────────────────── */
const documentInput=(()=>{
 const el=document.createElement('input');
 el.type='file';el.accept=EXTRACT_TYPES.join(',');el.id='document-file';el.hidden=true;
 el.addEventListener('change',()=>{void handleDocumentFile();});
 document.body.append(el);
 return el;
})();
let documentAccountId='';
async function handleDocumentFile(){
 const file=documentInput.files?.[0];
 if(!file||!documentAccountId)return;
 const account=workspace.accounts.find(a=>a.id===documentAccountId);
 if(!account){toast('That account is no longer in this workspace.');return;}
 toast(`Sending ${file.name} to ${READER_NAME} to be read. This can take a moment.`);
 try{
  const outcome=await extractStatement(file,workspace.license.key);
  // Transcribed rows go through the same gate as a CSV: fingerprints, duplicate
  // detection, and the running balance. Nothing is trusted for being machine-read.
  const built=buildFromRows({account,existing:workspace.lines,rows:outcome.rows,batchId:crypto.randomUUID()});
  draft={
   accountId:account.id,filename:file.name.slice(0,120),rows:[],headerIndex:0,mapping:{},
   dayFirst:true,digest:'read-by-'+READER_NAME.toLowerCase().replace(/[^a-z0-9]+/g,'-'),
   preview:built,error:'',kind:'document',readerNote:outcome.note
  };
  openDrawer('import');
 }catch(e){
  toast(safeError(e));
 }finally{
  documentInput.value='';
 }
}
