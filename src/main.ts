/* The complete UI uses the self-hosted variable Figtree face. */
import '@fontsource-variable/figtree';
import { createIcons, LayoutDashboard, ArrowDownLeft, ArrowUpRight, ReceiptText, FileText, Calculator, Settings, Plus, ArrowRight, Download, Search, ChevronDown, ShieldCheck, LockKeyhole, Wallet, Menu, X, Trash2, Pencil, ExternalLink, RefreshCw, Check, CircleHelp, LogOut, TrendingUp, CircleDollarSign, Landmark, Clock, Upload, Printer, Eye, Copy, OctagonAlert, Sparkles } from 'lucide';
import Decimal from 'decimal.js';
import {blankWorkspace,workspaceSchema,receiptSchema,expenseSchema,invoiceSchema,receiptMath,expenseMath,invoiceTotal,inYear,estimate,sum,money,csv,escapeHTML as h,SOURCES,RULE_VERSION,currencies,type Workspace,type Receipt,type Expense,type Invoice} from './core';
import {createVault,sealWith,unlock,unlockWithPasskey,addPasskey,removePasskey,passkeySlots,
 parseEnvelope,VAULT_KEY,MAX_BACKUP,type Dek,type Unlocked,type EnvelopeV2} from './vault';
import {registerPasskey,assertPasskey,passkeysAvailable,deviceLabel} from './passkey';
import {demo} from './demo';
import {FREE_PREVIEW,previewLimits,previewLabel} from './release';
import {startBrowserAi,stopBrowserAi,browserAiReady} from './browser-ai';
import {irisAnswerCards} from './iris-assistant';
import {pushAvailability,pushSupported,enableReminders,disableReminders,remindersActive} from './notifications';
import {activeCompany,selectCompany,listCompanies,createCompany,setCloudNetworkAllowed,accountUser,authCapabilities,signInGoogle,signOutCloud,remoteWorkspace,manualCloudUpload,queueCloudSave,bindCloudCopy,pauseCloudSync,onSyncStatus,hostedStatus,hostedChat} from './cloud';
import {previewRequest} from './privacy-preview';
import {reminderCalendar} from './reminders';
import {rememberedIris} from './user-iris-memory';
import {savingTips} from './insights';
import {fileRequest,generateChatFile} from './chat-files';
import {recordIntent,chatPrefill} from './chat-input';
import {draftRecordMessage,decideRecord,parseRecord} from './record-proposals';
import {classifyLocally} from './local-assistant';
import {answerTerm,detectTerm,helpReference} from './tax-help';
import {archiveCurrent} from './chat-history';
import {exportKinds,reportTable,reportCsv,reportXlsx,type ExportKind} from './exports';
import './tokens.css';
import './style.css';
import './studio.css';
import './print.css';
const icons={LayoutDashboard,ArrowDownLeft,ArrowUpRight,ReceiptText,FileText,Calculator,Settings,Plus,ArrowRight,Download,Search,ChevronDown,ShieldCheck,LockKeyhole,Wallet,Menu,X,Trash2,Pencil,ExternalLink,RefreshCw,Check,CircleHelp,LogOut,TrendingUp,CircleDollarSign,Landmark,Clock,Upload,Printer,Eye,Copy,OctagonAlert,Sparkles};
const app=document.querySelector<HTMLDivElement>('#app')!;
initTheme();
import {icon,fmt,dateLabel,today} from './format';
import {accountSchema,batchSchema,accountKinds,type StatementLine} from './core';
import {parseCsv,findHeader,suggestMapping,buildImport,buildFromRows,MAX_FILE_BYTES,type FieldName} from './statements';
import {checkLicense,trialStatus,limitsFor,planLabel,LIMITS,importsThisMonth,normalizeKey,type LicenseStatus,type Limits} from './license';
import {statementsView,importDrawerBody,documentConsent,planPanel,type Ctx,type ImportDraft} from './ui-statements';
import {filingPack} from './pack';
import {homeView} from './ui-home';
import {analysisIntent,languageOf,reply,type ChatMessage} from './conversation';
import {analysisView,sourcesView,clearAnalysisCache,recordsChart} from './ui-analysis';
import {analyzeWorkspace} from './analysis';
import {securityPanel,privacyNotice,type TwoFactorDraft} from './ui-privacy';
import {randomSecret,otpauthUri,verifyCode,makeRecoveryCodes,hashAll,hashRecovery,RECOVERY_COUNT} from './totp';
import {checkReview,packDigest,type ReviewStatus} from './review';
import {initTheme,applyTheme,storedTheme,type Theme} from './theme';
import {pingOnce,setPingEnabled,subscribe,serviceConfigured,readerConfigured,extractStatement,EXTRACT_TYPES,READER_NAME} from './service';
let workspace=demo(),mode:'demo'|'vault'|'locked'='demo',page='Today',year=2027,query='',categoryFilter='all',railFilter='all';
let dek:Dek|null=null,unlockers:EnvelopeV2['unlockers']|null=null,lastActivity=Date.now(),busy=false,drawer='',editId='',fx: {rates:Record<string,number>,time:string,expires:string}|null=null;
let confirmAction:(()=>Promise<void>)|null=null;
let license:LicenseStatus={state:'none',plan:'free',reason:'No licence key entered.'},limits:Limits=previewLimits({state:'none',plan:'free',reason:'Free preview.'});
let draft:ImportDraft|null=null,lineFilter='pending',accountFilter='all',pendingLine='',moneyTab:MoneyTab='in';
let review:ReviewStatus={state:'none'},twoFactorDraft:TwoFactorDraft|null=null;
let pending2fa:Unlocked|null=null;
let packDigestCache='';
let sourceIds:string[]=[],sourceRecord='',sidebarOpen=false,chatSaving=false,pendingChatText='',assistantEngine:'qwen'|'guided'='guided',chatAbort:AbortController|null=null;
let pushReady=false,pushOn=false;let cloudCompanies:{id:string;name:string;role:'owner'|'editor'|'viewer'}[]=[];
let cloudUser:{id:string;email?:string}|null=null,cloudMessage='',googleReady=false,cloudReady=false,cloudModel='',cloudProvider='',cloudWorking=false;
let cloudRestore:{raw:string;owner:string;revision:number}|null=null;
let cloudPreview:{message:string;history:{role:'user'|'assistant';content:string}[];original:string}|null=null;
onSyncStatus(message=>{cloudMessage=message;if(drawer==='cloud')render();});
let chatDraft='',editingProposal='',aiProgress='',aiLoading=false;
const chatFiles=new Map<string,File>();let fileAbort=new AbortController(),preparingFile='';
let pdfPack:{file:File;pages:number;fingerprint:string}|null=null;
let pdfBusy=false,pdfError='',pdfAbort:AbortController|null=null;
/* Whether this device has a platform authenticator, answered once at startup:
   the query is async, and a control that appears a beat after the panel draws
   looks broken. False hides the control rather than offering a door that will
   not open. */
let passkeyCapable=false;
const ctx=():Ctx=>({workspace,year,license,limits,today:today(),draft,lineFilter,accountFilter,demo:mode==='demo'});
const securityCtx=()=>({workspace,review,twoFactorDraft,demo:mode!=='vault',
 passkeys:(unlockers?passkeySlots(unlockers):[]).map(k=>
  ({credentialId:k.credentialId,label:k.label,addedOn:k.addedOn})),
 passkeyCapable});
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
 if(FREE_PREVIEW){license={state:'none',plan:'free',reason:'Free preview; no purchase required.'};limits=previewLimits(license);return;}
 if(mode==='demo'){license={state:'trial',plan:'pro',expires:'demo',daysLeft:0};limits=LIMITS.pro;return;}
 const t=today(),raw=workspace.license.key;
 let status:LicenseStatus=raw?await checkLicense(raw,t):{state:'none',plan:'free',reason:'No licence key entered.'};
 if(status.state!=='active'){const trial=trialStatus(workspace.license.trialStarted,t);if(trial.state==='trial')status=trial;}
 license=status;limits=limitsFor(status);
}
function toast(message:string){const t=document.querySelector('#toast')!;t.textContent=message;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),5000);}
function refreshIcons(){createIcons({icons,attrs:{'stroke-width':1.7}});}
function safeError(error:unknown){if(error instanceof Error&&'issues' in error){const issues=(error as {issues:{path:unknown[],message:string}[]}).issues;return issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ');}return error instanceof Error?error.message:'Something went wrong. Try again.';}
async function persist(next:Workspace){workspaceSchema.parse(next);if(mode==='vault'){if(!dek||!unlockers)throw Error('Workspace is locked');const sealingKey=dek;const encrypted=await sealWith(next,dek,unlockers);if(mode!=='vault'||dek!==sealingKey)throw Error('Workspace locked before saving finished.');localStorage.setItem(VAULT_KEY,JSON.stringify(encrypted));if(!next.security.offlineOnly)queueCloudSave(JSON.stringify(encrypted));}workspace=next;pdfPack=null;}
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
 sidebarOpen=false;query='';categoryFilter='all';railFilter='all';drawer='';pendingLine='';
 render();window.scrollTo(0,0);
}
const nav=[['Today','layout-dashboard','Today'],['Money','wallet','Money'],['Tax','calculator','Tax'],
 ['Pack','file-text','Filing Pack'],['Settings','settings','Settings']];
const MONEY_TABS:[MoneyTab,string,string][]=[
 ['in','arrow-down-left','Money in'],['out','arrow-up-right','Money out'],
 ['invoices','receipt-text','Invoices'],['statements','landmark','Statements']
];
function button(label:string,action:string,kind='primary',ico='plus'){return `<button class="btn ${kind}" data-action="${action}">${ico?icon(ico):''}${label}</button>`;}
function screenTitle(){return page==='Today'?'Hisaab':page==='Money'?MONEY_TABS.find(t=>t[0]===moneyTab)?.[2]||'Records':String(nav.find(([n])=>n===page)?.[2]??page);}
function render(){
 if(mode==='locked'){renderLocked();return;}
 const e=estimate(workspace,year),active=page==='Today'&&(workspace.conversation.messages.length>0||!!pendingChatText);
 const composerHint=page==='Pack'?'Ask about your filing pack':page==='Today'?'Tell Hisaab what happened':`Ask about ${screenTitle().toLowerCase()}`;
 app.innerHTML=`<div class="app-shell" data-screen="${h(screenTitle())}">
 <header class="topbar"><button class="icon-btn" data-action="sidebar" aria-label="Open navigation">${icon('menu')}</button><span class="screen-title">${h(screenTitle())}</span><button class="icon-btn" data-action="new-chat" aria-label="New chat">${icon('pencil')}</button></header>
 <main class="page-${h(page.toLowerCase())}">
 ${!active?`<div class="screen-context">${mode==='demo'?'<p class="mode-note">Demo data</p>':''}${page!=='Today'?`<button class="year-chip" data-action="year-picker">TY ${year} · Jul ${year-1}–Jun ${year}${icon('chevron-down')}</button>`:''}</div>`:''}
 ${page==='Today'?(active?chatView():homeView(ctx(),e)):page==='Privacy'?privacyNotice():page==='Money'?moneyView():page==='Tax'?taxView(e):page==='Pack'?reportsView(e):settingsView()}
 </main><div class="composer-dock">${page==='Today'?`<nav class="chat-sections" aria-label="Open records">${['Income','Expenses','Invoices','Statements','Tax','Filing Pack'].map(section=>`<button class="source-chip" data-chat-section="${section}">${section}</button>`).join('')}</nav>`:''}${page==='Today'&&!active?`<div class="suggestions">${['I got paid $500','Upwork se payment aayi','What do I owe in tax?','Where am I losing money?'].map(t=>`<button class="source-chip" data-chat-prompt="${h(t)}">${h(t)}</button>`).join('')}</div>`:''}<form id="chat-form" class="composer"><button type="button" class="icon-btn" data-action="add" aria-label="Attach or add records">${icon('plus')}</button><input id="chat-input" name="message" maxlength="2000" autocomplete="off" aria-label="Message Hisaab" placeholder="${h(composerHint)}" ${chatSaving?'disabled':''}><button type="submit" class="send-button" aria-label="Send message" ${chatSaving?'disabled':''}>${icon('arrow-right')}</button></form></div></div>
 <div id="overlay-root">${sidebarOpen?sidebarView():drawer?drawerView():''}</div>`;
 refreshIcons();bind();}
function sidebarView(){return `<div class="overlay sidebar-overlay"><button class="overlay-shade" data-action="close-sidebar" aria-label="Close navigation"></button><aside class="sidebar" role="dialog" aria-modal="true" aria-label="Navigation"><div class="sidebar-identity"><span class="brand-mark" lang="ur">ح</span><b>Hisaab</b><span class="mode-note">${assistantEngine==='qwen'?'Qwen3 · local':'Guided mode'}</span><button class="icon-btn" data-action="close-sidebar" aria-label="Close navigation">${icon('x')}</button></div><button class="btn primary wide" data-action="new-chat">${icon('plus')}New chat</button><h2>Recent chats</h2><nav class="recent-chats">${workspace.conversation.messages.length?`<button data-action="current-chat" aria-current="page"><span>${h((workspace.conversation.messages.find(m=>m.role==='user')?.text||'Current chat').slice(0,60))}</span><small>Current</small></button>`:''}${[...workspace.conversation.threads].reverse().slice(0,10).map(t=>`<button data-chat-id="${t.id}"><span>${h(t.title)}</span><small>${dateLabel(t.savedOn)}</small></button>`).join('')}${!workspace.conversation.messages.length&&!workspace.conversation.threads.length?'<small>Your conversations will appear here.</small>':''}</nav><button class="sidebar-link" data-action="all-chats">All chats · ${workspace.conversation.threads.length+(workspace.conversation.messages.length?1:0)}</button><button class="sidebar-link" data-action="memory">${icon('circle-help')}What I remember</button><h2>Records</h2><nav class="records-grid">${[['Income','arrow-down-left'],['Expenses','arrow-up-right'],['Invoices','receipt-text'],['Statements','landmark'],['Tax','calculator'],['Pack','file-text']].map(([p,i])=>`<button data-page="${p}">${icon(i)}${p==='Pack'?'Filing Pack':p}</button>`).join('')}</nav><button class="sidebar-link" data-action="activity">${icon('clock')}Activity and undo</button><button class="sidebar-link" data-action="exports">${icon('download')}Export records</button><p class="note">Guided local mode · works offline</p><div class="sidebar-bottom"><button data-action="cloud-account">${icon('shield-check')}Account and sync</button><button data-page="Privacy">${icon('shield-check')}Privacy</button><button data-page="Settings">${icon('settings')}Settings</button><button data-action="${mode==='vault'?'lock':hasVault()?'open-vault':'create-vault'}">${icon('lock-keyhole')}${mode==='vault'?'Lock workspace':hasVault()?'Unlock workspace':'Create workspace'}</button></div></aside></div>`;}
function chatView(){return `<section class="chat-thread" aria-label="Conversation">${workspace.conversation.messages.map(m=>m.role==='user'?`<div class="user-message" dir="auto">${h(m.text)}</div>`:m.kind==='proposal'?proposalView(m):`<div class="assistant-message"><span class="brand-mark" lang="ur" aria-hidden="true">ح</span><div class="assistant-content">${m.text?`<div class="assistant-bubble" dir="auto">${h(m.text)}</div>`:''}${m.helpTerm&&m.helpTerm!=='none'?`<p class="note">${h(helpReference(m.helpTerm).label)} · ${h(helpReference(m.helpTerm).version)}<br><a class="text-link" href="${h(helpReference(m.helpTerm).url)}" target="_blank" rel="noopener noreferrer">FBR source${icon('external-link')}</a><small>Estimate, not tax advice. Check before filing.</small></p>`:''}${m.helpTerm==='iris'?irisAnswerCards(workspace,m.year):''}${m.helpTerm==='iris'?rememberedIris(workspace,m.year).map(code=>`<p class="note">From you, not verified · TY ${m.year}<br>${h(code.code)} · ${h(code.label)}<br>${h(code.path)} · ${dateLabel(code.givenOn)}</p>`).join(''):''}${m.file?chatFileView(m):''}${m.kind==='records'?chatRecordsView(m):m.kind==='savings'?savingView(m):''}${m.kind==='text'?`<div class="quick-replies">${/Excel|CSV|PDF|export|فائل/i.test(m.text)?'<button class="source-chip" data-action="exports">Export records</button>':''}<button class="source-chip" data-chat-prompt="analyze my statements">Analyze statements</button><button class="source-chip" data-chat-prompt="which client pays most?">Income by client</button></div>`:m.kind==='records'||m.kind==='savings'?'':analysisView(workspace,m)}</div></div>`).join('')}${pendingChatText?`<div class="user-message" dir="auto">${h(pendingChatText)}</div><div class="assistant-progress" role="status"><span class="progress-spinner" aria-hidden="true"></span>Checking your request…</div>`:''}</section>`;}
function proposalView(m:ChatMessage){if(m.record)return financialProposalView(m);return `<article class="proposal-card"><small>${m.decision==='pending'?'Proposed · not saved yet':m.decision==='confirmed'?'Opened for your review':'Rejected'}</small><h2>${h(m.text)}</h2><p>What changes: opens the selected records for review. Your financial records stay unchanged.</p><p><b>Why:</b> Check the evidence behind this analysis before deciding what to edit.</p>${sourcesView(workspace,m.sourceIds)}${m.decision==='pending'?`<button class="btn primary wide" data-proposal-confirm="${m.id}">Confirm</button><div class="proposal-secondary"><button class="btn secondary" data-proposal-edit="${m.id}">Edit</button><button class="btn secondary" data-proposal-reject="${m.id}">Reject</button></div>`:`<button class="text-link" data-proposal-undo="${m.id}">Undo decision</button>`}</article>`;}
async function saveConversation(messages:ChatMessage[]){if(mode==='locked')return;if(busy)throw Error('Another save is finishing. Try again.');busy=true;try{const next=structuredClone(workspace);if(messages.length>120)throw Error('This chat is full. Start a new chat to keep this one in your history.');for(const m of messages.filter(m=>m.kind==='proposal'&&!m.record)){const old=workspace.conversation.messages.find(x=>x.id===m.id);if(!old||old.decision!==m.decision)next.conversation.activity.push({id:crypto.randomUUID(),proposalId:m.id,recordId:m.sourceIds[0]||m.id,decision:!old?'proposed':m.decision==='pending'?'undone':m.decision,on:new Date().toISOString()});}next.conversation.messages=messages;await persist(next);}finally{busy=false;}}
async function askHisaab(text:string){
 if(chatSaving||mode==='locked'||!text.trim())return;chatSaving=true;pendingChatText=text.trim();const requestController=new AbortController();chatAbort=requestController;page='Today';sidebarOpen=false;drawer='';render();
 try{if(/losing money|save money|saving tips|bachat|بچت/i.test(text)){await saveConversation([...workspace.conversation.messages,{id:crypto.randomUUID(),role:'user',text:text.trim(),kind:'text',month:today().slice(0,7),year,sourceIds:[],decision:'pending',language:languageOf(text)},{id:crypto.randomUUID(),role:'assistant',text:reply(languageOf(text),'Here are places to check in your own records. Estimates need review.','Aap ke records mein yeh cheezein check karein. Estimates ko review karna zaroori hai.','اپنے ریکارڈ میں یہ چیزیں چیک کریں۔ تخمینوں کا جائزہ ضروری ہے۔'),kind:'savings',month:today().slice(0,7),year,sourceIds:[],decision:'pending',language:languageOf(text)}]);return;}const requestedFile=fileRequest(text,workspace,year,today().slice(0,7));if(requestedFile){if(requestedFile.format==='json'){requestedFile.snapshot=JSON.stringify({type:'json',data:worksheet()});requestedFile.name=`hisaab-tax-worksheet-TY${year}.json`;}await saveConversation([...workspace.conversation.messages,{id:crypto.randomUUID(),role:'user',text:text.trim(),kind:'text',month:today().slice(0,7),year,sourceIds:[],decision:'pending',language:languageOf(text)},{id:crypto.randomUUID(),role:'assistant',text:reply(languageOf(text),'Your file is ready to prepare from this snapshot of your records.','Aap ke records ke is snapshot se file tayyar kar sakte hain.','آپ کے ریکارڈ کے اس سنیپ شاٹ سے فائل تیار کی جا سکتی ہے۔'),kind:'text',month:today().slice(0,7),year,sourceIds:[],decision:'pending',language:languageOf(text),file:requestedFile}]);render();return;}const intent=recordIntent(text);if(intent){const lang=languageOf(text);await saveConversation([...workspace.conversation.messages,{id:crypto.randomUUID(),role:'user',text:text.trim(),kind:'text',month:today().slice(0,7),year,sourceIds:[],decision:'pending',language:lang},{id:crypto.randomUUID(),role:'assistant',text:reply(lang,'Let’s check the details first. Review the amount, date, fees and evidence. Nothing is saved until you confirm the proposal.','Pehle details check kar lein. Amount, date, fees aur saboot review karein. Confirm ke baghair kuch save nahin hoga.','پہلے رقم، تاریخ، فیس اور ثبوت چیک کریں۔ تجویز کی تصدیق سے پہلے کوئی مالی ریکارڈ محفوظ نہیں ہوگا۔'),kind:'text',month:today().slice(0,7),year,sourceIds:[],decision:'pending',language:lang}]);chatDraft=text;openDrawer(intent);return;}const lang=languageOf(text),month=today().slice(0,7),base={month,year,sourceIds:[],decision:'pending' as const,language:lang};
 if(cloudReady&&cloudUser&&!workspace.security.offlineOnly&&analysisIntent(text)==='text'&&detectTerm(text)==='none'&&!/remember|export|pdf|xlsx|csv|json/i.test(text)){const safe=previewRequest(text,workspace.conversation.messages.slice(-6).map(m=>({role:m.role,content:m.text})),workspace);cloudPreview={...safe,original:text};openDrawer('cloud-preview');return;}
 const classified=await classifyLocally(text,{offlineOnly:workspace.security.offlineOnly,history:workspace.conversation.messages.slice(-6).map(m=>({role:m.role,content:m.text.slice(0,600)})),signal:requestController.signal});if(requestController.signal.aborted)return;assistantEngine=classified.engine;const term=detectTerm(text)!=='none'?detectTerm(text):classified.route.term,kind=term!=='none'?'text':classified.route.intent,isExport=/excel|xlsx|csv|export|pdf|فائل/i.test(text),isMemory=/what.*remember|remember.*me|mere bare|kya yaad|کیا یاد/i.test(text),isPayment=/got paid|payment aayi|dollar aaye|ادائیگی|dollar aay/i.test(text),response=isExport?reply(lang,'Choose a report and Excel or CSV from Export records in the menu. Files are generated locally from your records; the Filing Pack PDF is available on its screen.','Menu mein Export records se report aur Excel ya CSV chunain. Files aap ke records se locally banti hain; Filing Pack PDF us ki screen par hai.','مینو میں Export records سے رپورٹ اور Excel یا CSV منتخب کریں۔ فائلیں آپ کے ریکارڈ سے اسی ڈیوائس پر بنتی ہیں؛ فائلنگ پیک PDF اس کی سکرین پر دستیاب ہے۔'):isMemory?(workspace.conversation.memory.length?reply(lang,'Here is what you confirmed: ','Aap ne yeh confirm kiya tha: ','آپ نے یہ معلومات بتائی تھیں: ')+workspace.conversation.memory.map(m=>m.value).join(' · '):reply(lang,'Nothing has been confirmed in What I remember yet. You can add or edit it from the menu.','What I remember mein abhi koi baat confirm nahin hui. Menu se add ya edit kar sakte hain.','ابھی کوئی معلومات محفوظ نہیں کی گئیں۔ مینو میں What I remember کھول کر شامل یا تبدیل کریں۔')):term!=='none'?answerTerm(term,lang):isPayment?reply(lang,'Which account received this payment? Use + to record it with the actual fees and settlement rate.','Payment kis account mein aayi? Asal fees aur rate ke saath record karne ke liye + dabayein.','ادائیگی کس اکاؤنٹ میں آئی؟ اصل فیس اور شرح کے ساتھ ریکارڈ کرنے کے لیے + دبائیں۔'):kind==='text'?reply(lang,'I can help with finance, economics, accounting and managing money. You can ask about your records here; connect the online assistant in Settings for broader explanations.','Main finance, economics, accounting aur paison ke mamlaat mein madad kar sakta hoon. Records ke bare mein yahan poochhein; tafseeli baat ke liye Settings mein online assistant connect karein.','میں مالیات، معاشیات، اکاؤنٹنگ اور پیسوں کے انتظام میں مدد کر سکتا ہوں۔ یہاں اپنے ریکارڈ کے بارے میں پوچھیں؛ مزید وضاحت کے لیے Settings میں آن لائن اسسٹنٹ جوڑیں۔'):reply(lang,'Here is what your recorded data shows. Open any source to check the evidence.','Aap ke records ka hisaab yeh hai. Saboot dekhne ke liye record kholein.','آپ کے ریکارڈ کا حساب یہ ہے۔ ثبوت دیکھنے کے لیے ریکارڈ کھولیں۔');
 await saveConversation([...workspace.conversation.messages,{...base,id:crypto.randomUUID(),role:'user',text:text.trim(),kind:'text'},{...base,id:crypto.randomUUID(),role:'assistant',text:response,kind,...(term!=='none'?{helpTerm:term}:{})}]);
 if(!drawer&&!sidebarOpen)render();
 }catch(e){toast(safeError(e));}finally{if(chatAbort===requestController){chatAbort=null;chatSaving=false;pendingChatText='';}if(!drawer&&!sidebarOpen)render();} }
function openSource(id:string){sourceRecord=id;sourceIds=[];openDrawer('source');}
function recordDetail(id:string){const r=workspace.receipts.find(x=>x.id===id);if(r)return `<h3>${h(r.client||r.rail)}</h3><p>${dateLabel(r.date)} · ${h(r.description)}</p><dl class="quiet-totals"><div><dt>Gross</dt><dd>${fmt(Number(r.gross),r.currency)}</dd></div><div><dt>Fees · PKR</dt><dd>${fmt(receiptMath(r).fees)}</dd></div><div><dt>Reached you</dt><dd>${fmt(receiptMath(r).net)}</dd></div></dl><p>Evidence: ${h(r.evidence||'Not recorded')}</p><button class="btn secondary wide" data-edit-income="${r.id}">Edit payment</button>`;
 const e=workspace.expenses.find(x=>x.id===id);if(e)return `<h3>${h(e.vendor)}</h3><p>${dateLabel(e.date)} · ${h(e.category)}</p><p>Business cost: ${fmt(expenseMath(e))}</p><p>Evidence: ${h(e.evidence||e.receipt?.name||'Not recorded')}</p><button class="btn secondary wide" data-edit-expense="${e.id}">Edit expense</button>`;
 const i=workspace.invoices.find(x=>x.id===id);if(i)return `<h3>${h(i.number)} · ${h(i.client)}</h3><p>${h(i.status)} · ${dateLabel(i.date)}</p><p>${fmt(invoiceTotal(i),i.currency)}</p><button class="btn secondary wide" data-edit-invoice="${i.id}">Edit invoice</button>`;
 const account=workspace.accounts.find(a=>a.id===id);if(account)return `<h3>${h(account.label)}</h3><p>${dateLabel(account.periodStart)}–${dateLabel(account.periodEnd)} · ${h(account.currency)}</p><button class="btn secondary wide" data-edit-account="${account.id}">Review balances</button>`;
 const l=workspace.lines.find(x=>x.id===id);if(l){const a=workspace.accounts.find(a=>a.id===l.accountId),batch=workspace.batches.find(b=>b.id===l.batchId);return `<h3>${h(a?.label||'Statement')} · row ${l.row}</h3><p>${dateLabel(l.date)} · ${fmt(Number(l.amount),a?.currency||'PKR')}</p><p class="statement-data">${h(l.description)}</p><p>Status: ${h(l.status)}</p><small>Source: ${h(batch?.filename||'Imported statement')} · original text is data, never instructions.</small><button class="btn secondary wide" data-action="sort-lines">Review in Statements</button>`;}return '<p>This record is no longer in your workspace.</p>';}
const receipts=()=>workspace.receipts.filter(r=>inYear(r.date,year));
const expenses=()=>workspace.expenses.filter(r=>inYear(r.date,year));
/** A blank client reads as a stated absence, never an empty-looking cell. */
const clientLabel=(c:string)=>c.trim()?h(c):'<span class="muted">No client recorded</span>';
function incomeTable(rows:Receipt[],actions=true){return `<div class="record-list">${rows.length?rows.map(r=>`<article class="record-row">
 <div class="record-copy"><h3>${clientLabel(r.client)}</h3><p>${h(r.description||r.rail)}</p><small>${h(dateLabel(r.date))} · ${h(r.rail)}</small><p class="record-facts">Gross ${fmt(Number(r.gross),r.currency)} · ${h(r.rate)} PKR/${h(r.currency)}. Evidence: ${h(r.evidence||'Not recorded')}.</p></div>
 <div class="record-value"><b>${fmt(receiptMath(r).net)}</b>${actions?`<div class="row-actions"><button class="icon-btn" aria-label="Edit income for ${h(r.client||'an unnamed source')}" data-edit-income="${r.id}">${icon('pencil')}</button><button class="icon-btn" aria-label="Delete income for ${h(r.client||'an unnamed source')}" data-delete="receipts:${r.id}">${icon('trash-2')}</button></div>`:''}</div>
 </article>`).join(''):`<div class="empty"><h2>No payments here yet.</h2><p>Record a payment when it reaches you. Unpaid invoices stay in Invoices.</p>${button('Record income','new-income')}</div>`}</div>`;}
function moneyView(){
 const waitingLines=workspace.lines.filter(l=>l.status==='pending').length;
 const unpaid=workspace.invoices.filter(i=>i.status==='Sent').length;
 const counts:Record<MoneyTab,number>={in:receipts().length,out:expenses().length,invoices:unpaid,statements:waitingLines};
 return `${moneyTab!=='statements'?button('Add a record','add','primary wide','plus'):''}${moneyTab==='statements'?'':`<nav class="tabs" aria-label="Money sections">${MONEY_TABS.map(([key,ico,label])=>`<button class="tab ${moneyTab===key?'active':''}" data-money-tab="${key}" ${moneyTab===key?'aria-current="page"':''}>${h(label)}${counts[key]?`<span class="tab-count">${counts[key]}</span>`:''}</button>`).join('')}</nav>`}
 ${moneyTab==='in'?incomeView():moneyTab==='out'?expensesView():moneyTab==='invoices'?invoicesView():statementsView(ctx())}`;
}
function incomeView(){const rows=receipts().filter(r=>(r.client+' '+r.description+' '+r.evidence).toLowerCase().includes(query.toLowerCase())&&(categoryFilter==='all'||r.category===categoryFilter)&&(railFilter==='all'||r.rail===railFilter)).sort((a,b)=>b.date.localeCompare(a.date));return `${recordsChart(workspace,year,'income',today().slice(0,7))}<div class="records-toolbar"><label class="search">${icon('search')}<input id="search" placeholder="Find a payment" value="${h(query)}" aria-label="Search income"></label><div class="record-filters"><select id="category-filter" aria-label="Service category"><option value="all">All categories</option>${categoryOptions(categoryFilter)}</select><select id="rail-filter" aria-label="Payment route"><option value="all">All routes</option>${['Payoneer','Wise','Bank transfer','Upwork','Fiverr','JazzCash','Easypaisa','Raast','Other'].map(v=>`<option ${railFilter===v?'selected':''}>${v}</option>`).join('')}</select>${button('Export CSV','income-csv','secondary','download')}</div></div>${incomeTable(rows)}<p class="note">Total received ${fmt(sum(rows.map(r=>receiptMath(r).net)))}</p>`;}
function invoicesView(){const rows=workspace.invoices.filter(i=>(i.client+' '+i.number).toLowerCase().includes(query.toLowerCase()));return `<div class="toolbar"><label class="search">${icon('search')}<input id="search" placeholder="Search client or invoice number" value="${h(query)}" aria-label="Search invoices"></label><span class="note">Marking paid does not create a receipt.</span></div><section class="panel"><div class="table-scroll"><table class="cards"><thead><tr><th>Invoice / client</th><th>Due</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows.map(i=>`<tr><td data-label="Invoice"><b>${h(i.number)}</b><small>${h(i.client)}</small></td><td data-label="Due">${dateLabel(i.due)}</td><td data-label="Amount" class="amount-cell">${fmt(invoiceTotal(i),i.currency)}</td><td data-label="Status"><span class="pill ${i.status==='Paid'?'paid':i.status==='Sent'?'sent':''}">${i.status}</span></td><td data-label="Actions"><div class="row-actions"><button class="icon-btn" data-print="${i.id}" aria-label="View and print ${h(i.number)}">${icon('printer')}</button><button class="icon-btn" data-edit-invoice="${i.id}" aria-label="Edit ${h(i.number)}">${icon('pencil')}</button><button class="icon-btn" data-delete="invoices:${i.id}" aria-label="Delete ${h(i.number)}">${icon('trash-2')}</button></div></td></tr>`).join('')||'<tr><td colspan="5"><div class="empty"><h3>Your next project starts here.</h3><p>Create an invoice, print it, and share it yourself.</p></div></td></tr>'}</tbody></table></div></section><p class="note">Invoices use the selected invoice currency. No payment is collected and no sales tax is automatically added.</p>`;}
function expensesView(){const rows=expenses().filter(e=>(e.vendor+' '+e.category).toLowerCase().includes(query.toLowerCase()));return `${recordsChart(workspace,year,'expenses',today().slice(0,7))}<div class="toolbar"><label class="search">${icon('search')}<input id="search" placeholder="Search vendor or category" value="${h(query)}" aria-label="Search expenses"></label>${button('Export CSV','expense-csv','secondary','download')}</div><section class="panel"><div class="table-scroll"><table class="cards"><thead><tr><th>Vendor</th><th>Date</th><th>Business cost</th><th>Evidence</th><th>Actions</th></tr></thead><tbody>${rows.map(e=>`<tr><td data-label="Vendor"><b>${h(e.vendor)}</b><small>${e.category}</small></td><td data-label="Date">${dateLabel(e.date)}</td><td data-label="Business cost" class="amount-cell">${fmt(expenseMath(e))}<small>${e.businessPct}% of ${fmt(Number(e.amount),e.currency)}</small></td><td data-label="Evidence">${e.receipt?`<button class="text-link" data-view-receipt="${e.id}">${icon('eye')}Receipt</button>`:h(e.evidence||'Not attached')}<small>${e.deductible?'Claimed for domestic business':'Not claimed as tax deduction'}</small></td><td data-label="Actions"><div class="row-actions"><button class="icon-btn" data-edit-expense="${e.id}" aria-label="Edit ${h(e.vendor)}">${icon('pencil')}</button><button class="icon-btn" data-delete="expenses:${e.id}" aria-label="Delete ${h(e.vendor)}">${icon('trash-2')}</button></div></td></tr>`).join('')||'<tr><td colspan="5"><div class="empty"><h3>Keep the evidence with the expense.</h3><p>Add your first expense and optional receipt.</p></div></td></tr>'}</tbody></table></div></section><p class="note">Only explicitly claimed expenses reduce the domestic business scenario. Expenses never reduce the 154A gross-proceeds base.</p>`;}
function taxView(e:ReturnType<typeof estimate>){return `<section class="tax-answer"><h1>Your tax, in perspective</h1><p class="answer-amount">${fmt(e.reserve)}</p><p>Modeled federal reserve · estimate, not tax advice</p><dl class="quiet-totals"><div><dt>Withholding recorded</dt><dd>${fmt(e.paidExport+e.paidLocal)}</dd></div><div><dt>Additional reserve</dt><dd>${fmt(e.balance)}</dd></div></dl></section>${e.reasons.length?`<div class="warning-row">${icon('octagon-alert')}<span>${e.reasons.length} tax checks need your review</span><button class="warning-action" data-action="tax-profile">Review</button></div>`:''}<button class="btn primary wide" data-action="tax-details">See calculation and sources</button><p class="note">${h(e.note)}</p>`;}
function taxDetails(e:ReturnType<typeof estimate>){return `<section class="tax-detail"><h3>Estimate limits</h3><div><p>${h(e.note)}</p></div></section>
 <section class="tax-detail"><h3>How this was calculated</h3><div><dl class="calculation">
 <div><dt>IT / IT-enabled export proceeds</dt><dd>${fmt(e.itBase)}</dd></div><p>Bank-confirmed base × ${e.itRate}% · ${workspace.profile.pseb?'PSEB registered and certified':'PSEB concession not confirmed'} · s.154A / Division IVA</p>
 <div><dt>Other exported service proceeds</dt><dd>${fmt(e.serviceBase)}</dd></div><p>Bank-confirmed base × 1% · s.154A / Division IVA</p>
 <div><dt>Modeled export tax</dt><dd>${fmt(e.exportTax)}</dd></div><div><dt>Domestic business gross</dt><dd>${fmt(e.localBase)}</dd></div>
 <div><dt>Domestic processing fees</dt><dd>− ${fmt(e.localFees)}</dd></div><div><dt>Claimed business expenses</dt><dd>− ${fmt(e.expenseDeduction)}</dd></div><p>Deductibility and apportionment require review under s.20–21.</p>
 <div><dt>Domestic taxable-profit scenario</dt><dd>${fmt(e.profit)}</dd></div><div><dt>Progressive business tax</dt><dd>${fmt(e.business.base)}</dd></div><p>0 / 15 / 20 / 30 / 40 / 45% marginal slabs · First Schedule Part I Division I</p>
 <div><dt>Business-tax surcharge</dt><dd>${fmt(e.business.surcharge)}</dd></div><p>10% of slab tax where taxable business income exceeds PKR 10m · s.4AB</p>
 <div><dt>Modeled federal reserve</dt><dd>${fmt(e.reserve)}</dd></div><div><dt>Export withholding</dt><dd>${fmt(e.paidExport)}</dd></div><div><dt>Domestic withholding</dt><dd>${fmt(e.paidLocal)}</dd></div>
 <div><dt>Additional modeled reserve</dt><dd>${fmt(e.balance)}</dd></div><p>Credit is matched within each regime only. Excess withholding does not create an automatic refund.</p></dl>
 ${button('Export worksheet','worksheet','secondary','download')}</div></section>
 <section class="tax-detail"><h3>Sources and filing checklist</h3><div><h2>Rules behind the numbers</h2><p>Official Pakistani sources · checked 21/10/2026 · ${RULE_VERSION}</p>
 ${SOURCES.map(v=>`<a href="${v.url}" target="_blank" rel="noopener noreferrer" class="source-row"><span><b>${h(v.title)}</b><small>${h(v.detail)}</small></span>${icon('external-link')}</a>`).join('')}
 <h2>For your accountant or IRIS</h2><ul><li>Income return and business schedules</li><li>Bank PRCs/ePRCs and withholding certificates</li><li>Valid PSEB certificate, if applicable</li><li>Personal wealth statement and reconciliation (s.116)</li><li>Provincial/ICT sales-tax returns where required</li></ul><p>Punjab, Sindh, KP, Balochistan and ICT have separate service-tax rules. AJK/GB and non-resident cases need specialist review. This is a federal estimate, not all taxes payable.</p><a class="text-link" href="https://iris.fbr.gov.pk/" target="_blank" rel="noopener noreferrer">Open FBR IRIS ${icon('external-link')}</a></div></section>`;}
function reportsView(e:ReturnType<typeof estimate>){const data=filingPack(workspace,year,packPlanLabel(),{digest:packDigestCache,review}).data,pending=data.unresolvedLines.length;
 return `${pending?`<div class="warning-row">${icon('octagon-alert')}<span>${pending} statement lines need sorting</span><button class="warning-action" data-action="sort-lines">Sort them</button></div>`:''}<article class="document-card"><div class="document-preview"><h1>Filing Pack</h1><p>Tax year ${year}</p><div class="document-tags"><span>${data.reviewed?'Reviewed':'Not reviewed'}</span><span>${pending} unresolved</span></div><dl class="quiet-totals"><div><dt>Received</dt><dd>${fmt(sum(data.receipts.map(r=>r.netPkr)))}</dd></div><div><dt>Modeled tax reserve</dt><dd>${fmt(e.reserve)}</dd></div></dl><small>${h(data.ruleVersion)}</small></div><div class="document-file">${icon('file-text')}<div><b>Hisaab · TY ${year}</b><small>PDF · ${pdfPack?`${pdfPack.pages} pages · ${(pdfPack.file.size/1024).toFixed(0)} KB`:'prepared locally on request'}</small></div></div><div class="document-actions"><button class="btn primary wide" data-action="share-pack" ${pdfBusy?'disabled':''}>${pdfBusy?'Preparing PDF…':'Share to WhatsApp'}</button><button class="btn secondary wide" data-action="download-pack" ${pdfBusy?'disabled':''}>${icon('download')}Download</button></div></article>${pdfError?`<div class="warning-row">${icon('octagon-alert')}<span>${h(pdfError)}</span><button class="warning-action" data-action="download-pack">Retry</button></div>`:''}<button class="text-link" data-action="pack-note">Add a note</button><p class="note pack-footer">A worksheet for your accountant or IRIS, not a filed return.</p>`;}
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
function settingsView(){return `<section class="settings-home"><label class="field"><span>Appearance</span><select id="theme"><option value="system" ${storedTheme()==='system'?'selected':''}>Match my device</option><option value="dark" ${storedTheme()==='dark'?'selected':''}>Dark</option><option value="light" ${storedTheme()==='light'?'selected':''}>Light</option></select></label><div class="settings-status"><span>Assistant</span><strong>${assistantEngine==='qwen'||browserAiReady()?'Qwen3-1.7B · on this device':'Guided local mode'}</strong><small>Guided chat is always available · free preview</small><button class="text-link" data-action="ai-settings">On-device AI</button></div><button class="text-link" data-action="cloud-account">${icon('shield-check')}Account, sync and online assistant</button><nav class="settings-links" aria-label="Settings sections">${[['security','shield-check','Privacy and security'],['profile','calculator','Tax profile'],['memory','circle-help','About you & memory'],['backup','download','Backup and portability'],['delete','trash-2','Delete workspace']].map(([key,ico,label])=>`<button data-settings-section="${key}">${icon(ico)}<span>${label}</span>${icon('arrow-right')}</button>`).join('')}</nav><button class="btn primary wide" data-action="${mode==='vault'?'lock':hasVault()?'open-vault':'create-vault'}">${icon('lock-keyhole')}${mode==='vault'?'Lock workspace':hasVault()?'Unlock workspace':'Create private workspace'}</button><p class="note">Your records are encrypted. Estimates need review.</p><button class="text-link" data-page="Privacy">Privacy and data use</button><button class="text-link" data-action="tax-details">Tax rules and limits</button><button class="text-link" data-action="reminders">Statement and filing reminders</button><button class="text-link" data-action="save-offline">Save app for offline use</button></section>`;}
function settingsDetail(which:string){
 if(which==='memory')return memoryView()+irisMemoryView();
 if(which==='security')return securityPanel(securityCtx()).replaceAll('btn primary','btn secondary');
 if(which==='plan')return FREE_PREVIEW?'<p>Hisaab is free in this preview. No purchase or licence key is needed.</p>':planPanel(ctx()).replaceAll('btn primary','btn secondary');
 const document=new DOMParser().parseFromString(settingsContent(),'text/html'),label=which==='profile'?'Tax profile':which==='backup'?'Backup & portability':'Delete this workspace';
 return Array.from(document.querySelectorAll('section')).find(s=>s.querySelector('h2')?.textContent===label)?.outerHTML||'<p>Settings unavailable. Close and try again.</p>';
}
function settingsContent(){return `<div class="settings-grid">${FREE_PREVIEW?'':planPanel(ctx()).replaceAll('btn primary','btn secondary')}${securityPanel(securityCtx()).replaceAll('btn primary','btn secondary')}<section class="panel settings-panel"><h2>Tax profile</h2><p>These are your declarations, not checks against government records. Confirm them separately for each year before relying on an estimate.</p><form id="profile-form">${input('Workspace name','name',workspace.profile.name,'text',false)}${select('Province / territory','province',['Punjab','Sindh','Khyber Pakhtunkhwa','Balochistan','Islamabad','AJK / GB'],workspace.profile.province)}<div class="notice compact">Changing tax year resets year-specific confirmations. PSEB and residency must reflect the selected year.</div>${(()=>{let group='';return checks.map(([k,section,label,note])=>{
   const heading=section!==group?`<h3 class="check-group">${h(section)}</h3>`:'';group=section;
   return `${heading}<label class="check-label wide-check"><input type="checkbox" name="${k}" ${workspace.profile.confirmedYear===year&&workspace.profile[k as keyof Workspace['profile']]?'checked':''}><span><b>${h(label)}</b><small>${h(note)}</small></span></label>`;
  }).join('');})()}<button class="btn primary" type="submit">${icon('check')}Save tax profile</button></form></section><div><section class="panel settings-panel"><h2>Private by design</h2><div class="privacy-list"><p>${icon('lock-keyhole')}AES-256-GCM encrypted browser storage</p><p>${icon('shield-check')}Passphrase stays on your device</p><p>${icon('clock')}Automatic lock after 5 minutes of inactivity</p></div><p>Invoices, income, expenses, receipts, profile, the current conversation, proposal decisions and pack notes are stored inside the encrypted workspace. Optional Supabase sync holds an encrypted copy and separate account/company metadata. Hosted AI requests show a redacted preview before sending. There are no advertising trackers or bank connections.</p><p>Encryption cannot protect an unlocked or compromised browser. Back up regularly. There is no passphrase recovery.</p>${mode==='demo'?button(hasVault()?'Unlock workspace':'Create private workspace',hasVault()?'open-vault':'create-vault','secondary','lock-keyhole'):button('Lock workspace','lock','secondary','lock-keyhole')}</section><section class="panel settings-panel"><h2>Backup & portability</h2><p>An encrypted backup includes receipts. Restoring replaces the current workspace after you confirm. Plain CSV and worksheet exports are available in Reports.</p>${button('Download encrypted backup','backup','secondary','download')}<label class="btn secondary file-label">${icon('upload')}Restore encrypted backup<input id="restore-file" type="file" accept="application/json,.json" hidden></label><p class="note">Current mode: ${mode==='demo'?'unsaved demo':'encrypted workspace'} · ${workspace.receipts.length} receipts · ${workspace.expenses.length} expenses · ${workspace.invoices.length} invoices</p></section><section class="panel settings-panel danger-zone"><h2>Delete this workspace</h2><p>Removes only Hisaab's encrypted data on this browser. Download a backup first. Copies you exported remain on your device.</p>${button('Delete local workspace','delete-vault','danger','trash-2')}</section></div></div>`;}
function input(label:string,name:string,value:unknown='',type='text',required=true,extra=''){return `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${h(value)}" ${required?'required':''} ${extra} ${type==='number'?`${extra.includes('step=')?'':'step="0.01"'} min="0"`:''} ${type==='text'?'maxlength="400"':''}></label>`;}
function select(label:string,name:string,values:readonly string[],value:string){return `<label class="field"><span>${label}</span><select name="${name}">${values.map(v=>`<option value="${h(v)}" ${v===value?'selected':''}>${h(v)}</option>`).join('')}</select></label>`;}
function categoryOptions(value:string){return [['it-export','IT / IT-enabled export'],['service-export','Other service export'],['domestic','Domestic freelance business'],['social-media','Social media revenue — review'],['other','Other / unsure — review']].map(([v,l])=>`<option value="${v}" ${value===v?'selected':''}>${l}</option>`).join('');}
function checkInput(label:string,name:string,value:boolean){return `<label class="check-label"><input name="${name}" type="checkbox" ${value?'checked':''}><span>${label}</span></label>`;}
function drawerView(){let title='',body='';
 if(drawer==='year-picker'){title='Tax year';body=`<label class="field">Tax year<select id="year"><option value="2027" ${year===2027?'selected':''}>TY 2027 · Jul 2026–Jun 2027</option><option value="2026" ${year===2026?'selected':''}>TY 2026 · Jul 2025–Jun 2026</option></select></label>`;}
 else if(drawer.startsWith('settings:')){title=drawer==='settings:profile'?'Tax profile':'Settings';body=settingsDetail(drawer.slice(9));}
 else if(drawer==='all-chats'){title='All chats';body=`${workspace.conversation.threads.length?'':'<p>No archived chats yet. Starting a new chat keeps the previous one here.</p>'}<div class="history-list">${[...workspace.conversation.threads].reverse().map(t=>`<div class="memory-row"><button class="text-link" data-chat-id="${t.id}"><span>${h(t.title)}<small>${dateLabel(t.savedOn)}</small></span></button><button class="icon-btn" data-delete-chat="${t.id}" aria-label="Delete archived chat">${icon('trash-2')}</button></div>`).join('')}</div>`;}
 else if(drawer==='cloud'){title='Account and encrypted sync';body=cloudAccountView();}
 else if(drawer==='cloud-preview'){title='Review before sending';body=cloudPreviewView();}
 else if(drawer==='ai'){title='Private on-device AI';body=`<p>Qwen3-1.7B runs on this device. Your chats and records are not sent to a model provider. It helps understand requests; all figures, tax answers and record changes use Hisaab’s checked tools.</p><p>The first load downloads about 1.4 GB from Hugging Face and the WebLLM runtime from GitHub. Those hosts see your IP address, never your chats. WebGPU and about 2 GB of GPU memory are needed. Small phones can keep using guided chat.</p><p class="note">Downloads are cached by your browser. Nothing is trained on your private data. Loading is session-only; locking stops AI and clears its context.</p><p role="status">${h(aiProgress)}</p>${browserAiReady()?button('Stop AI','ai-stop','secondary'):button(aiLoading?'Cancel download':'Download and start Qwen3-1.7B',aiLoading?'ai-stop':'ai-start','primary')}<p class="note">${workspace.security.offlineOnly?'Never touch the network is on. Downloads are blocked. Already-loaded inference stays on device.':''}</p>`;}
 else if(drawer==='reminders'){title='Reminders';body=`<p>Add a monthly statement reminder and upcoming statutory filing dates from Hisaab’s rule register to your calendar.</p><p class="note">FBR may extend filing dates. Check current notices before relying on a date. Hisaab does not send background notifications or emails in this build; your calendar controls alerts after you import this file.</p>${button('Download calendar reminders','calendar-reminders','primary','download')}`;}
 else if(drawer==='activity'){title='Activity';body=activityView();}
 else if(drawer==='memory'){title='What I remember';body=memoryView()+irisMemoryView();}
 else if(drawer==='source'){title='Record and evidence';body=recordDetail(sourceRecord);}
 else if(drawer==='sources'){title='Records used';body=sourcesView(workspace,sourceIds,true);}
 else if(drawer==='tax-details'){title='Calculation and sources';body=taxDetails(estimate(workspace,year));}
 else if(drawer==='exports'){title='Export records';body=`<p>Files are created locally. They contain financial data, so share them only with someone you trust.</p><form id="export-form">${select('Records','kind',exportKinds,'income')}${select('Format','format',['Excel (.xlsx)','CSV'],'Excel (.xlsx)')}<div class="form-error" role="alert"></div><button class="btn primary wide" type="submit">${icon('download')}Download file</button></form>${button('Worksheet JSON','worksheet','secondary','download')}${button('Filing Pack data','pack-json','secondary','download')}`;}

 else if(drawer==='pack-note'){title='Add a note';body=`<form id="pack-note-form"><label class="field"><span>Your note · included in the PDF</span><textarea name="note" maxlength="1000">${h(workspace.conversation.packNotes[String(year)]||'')}</textarea></label><button class="btn primary wide" type="submit">Save note</button></form>`;}

 else if(drawer==='income'){const r=workspace.receipts.find(r=>r.id===editId);title=r?'Edit received payment':'Record income';body=`<p class="drawer-intro">Use your actual statement. Reference FX never replaces a bank settlement rate.</p><form id="income-form"><div class="form-grid">${input('Client or source','client',r?.client,'text',false,'placeholder="Leave blank for cash, tips or a one-off"')}${input('Received date','date',r?.date||today(),'date')}${input('Description','description',r?.description,'text',false)}${select('Payment route','rail',['Payoneer','Wise','Bank transfer','Upwork','Fiverr','JazzCash','Easypaisa','Raast','Other'],r?.rail||'Bank transfer')}${select('Currency','currency',currencies,r?.currency||'USD')}${input('Gross received · original currency','gross',r?.gross||'','number')}${input('Processor fee · same currency','fee',r?.fee||'0','number')}${input('Actual PKR per 1 currency unit','rate',r?.rate||'','number',true,'data-rate step="0.000001"')}${input('Bank fee · PKR','bankFee',r?.bankFee||'0','number')}${input('Pakistan tax withheld · PKR','withheld',r?.withheld||'0','number')}<label class="field"><span>Service / tax category</span><select name="category">${categoryOptions(r?.category||'it-export')}</select></label>${input('PRC / bank / certificate reference','evidence',r?.evidence,'text',false)}${input('Gross realized tax base · PKR','taxBase',r?.taxBase||'0','number')}</div><div class="notice compact">154A tax base is gross realized proceeds per bank evidence, before fees. A platform invoice, overseas balance or home remittance is not automatically a qualifying export realization.</div>${checkInput('Realized through an authorized banking channel','banking',r?.banking||false)}${checkInput('Tax base and currency conversion reconciled to bank / tax evidence (s.71)','baseConfirmed',r?.baseConfirmed||false)}<div id="income-preview" class="form-preview"></div><div class="form-error" role="alert"></div><button class="btn primary wide" type="submit">${icon('check')}Save received payment</button></form>`;}
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
  ${input('Bank or provider','institution',a?.institution??'','text',false,'list="bank-presets"')}<datalist id="bank-presets">${['HBL','Meezan','UBL','MCB','Allied','Bank Alfalah','Standard Chartered','Faysal','Other'].map(bank=>`<option value="${bank}"></option>`).join('')}</datalist>
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
function openDrawer(type:string,id=''){if(type!=='restore')cloudRestore=null;if(!['income','expense','invoice'].includes(type)){chatDraft='';editingProposal='';}drawer=type;editId=id;render();const el=document.querySelector<HTMLElement>('.drawer input,.drawer select,.drawer textarea')??document.querySelector<HTMLElement>('.drawer button');if(el)el.focus();if(pendingLine)prefillFromLine();if(chatDraft||editingProposal)prefillChatRecord();if(type==='income')updateIncomePreview();}
function confirmChange(message:string,action:()=>Promise<void>){confirmMessage=message;confirmAction=action;openDrawer('confirm');}
function hasVault(){try{return !!localStorage.getItem(VAULT_KEY);}catch{return false;}}
/* Which passkeys the stored workspace will accept. This reads the envelope's
   metadata — the credential ids and labels sitting outside the ciphertext — so
   the lock screen can offer the button without anything being decrypted first.
   A malformed or older envelope simply offers nothing. */
function storedPasskeys(){
 try{
  const raw=localStorage.getItem(VAULT_KEY);
  if(!raw)return [];
  const envelope=parseEnvelope(raw);
  return envelope.format==='hisaab-aesgcm-v1'?[]:passkeySlots(envelope.unlockers);
 }catch{return [];}
}
function renderLocked(){
 if(pending2fa){
  const left=RECOVERY_COUNT-pending2fa.workspace.security.recoveryUsed;
  app.innerHTML=`<main class="lock-screen"><a class="brand" href="#"><span class="brand-mark" lang="ur" aria-hidden="true">ح</span><span>Hisaab</span></a>
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
 const slots=passkeyCapable?storedPasskeys():[];
 app.innerHTML=`<main class="lock-screen"><a class="brand" href="#"><span class="brand-mark" lang="ur" aria-hidden="true">ح</span><span>Hisaab</span></a><section class="panel lock-panel"><div class="vault-illustration">${icon('lock-keyhole')}</div><h1>Your books are locked.</h1><p>Enter your passphrase to return to your private workspace.</p>${slots.length?`<button class="btn secondary wide" data-action="unlock-passkey">${icon('shield-check')}Unlock with ${h(slots[0].label)}</button><p class="note or-divider">or use your passphrase</p>`:''}<form id="unlock-form"><label class="field"><span>Passphrase</span><input name="passphrase" type="password" minlength="12" maxlength="256" required autocomplete="current-password"></label><div class="form-error" role="alert"></div><button class="btn primary wide" type="submit">Unlock workspace ${icon('arrow-right')}</button></form><button class="text-link" data-action="demo">Explore demo instead</button><p class="note">No passphrase recovery. Your backup remains encrypted.</p>
 <ul class="trust-list lock-trust">
  <li>${icon('shield-check')}<span>Your books are encrypted on this device. We have no copy and no way to read them.</span></li>
  <li>${icon('circle-help')}<span>Hisaab is not connected to FBR or your bank, and files nothing on your behalf.</span></li>
 </ul></section></main>`;refreshIcons();bind();}
function lock(){setCloudNetworkAllowed(false);cloudUser=null;cloudReady=false;cloudPreview=null;cloudRestore=null;fileAbort.abort();fileAbort=new AbortController();chatFiles.clear();preparingFile='';stopBrowserAi();aiLoading=false;aiProgress='';chatDraft='';editingProposal='';chatAbort?.abort();chatAbort=null;chatSaving=false;pendingChatText='';assistantEngine='guided';clearAnalysisCache();document.querySelector('#print-surface')?.remove();pending2fa=null;twoFactorDraft=null;fx=null;pdfAbort?.abort();pdfAbort=null;pdfPack=null;pdfBusy=false;sourceIds=[];sourceRecord='';sidebarOpen=false;workspace=blankWorkspace();dek=null;unlockers=null;mode='locked';drawer='';editId='';backupToRestore='';render();}
function download(name:string,content:string,mime='application/json'){const url=URL.createObjectURL(new Blob([content],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function incomeCsv(){download(`hisaab-income-TY${year}.csv`,csv([['Date','Client','Description','Currency','Gross','Foreign fee','PKR per unit','Bank fee PKR','Withheld PKR','Gross PKR','Net PKR','Tax base PKR','Base confirmed','Rail','Category','Bank evidence','Banking channel'],...receipts().map(r=>[r.date,r.client,r.description,r.currency,r.gross,r.fee,r.rate,r.bankFee,r.withheld,receiptMath(r).gross,receiptMath(r).net,r.taxBase,r.baseConfirmed,r.rail,r.category,r.evidence,r.banking])]),'text/csv;charset=utf-8');}
function expenseCsv(){download(`hisaab-expenses-TY${year}.csv`,csv([['Date','Vendor','Category','Currency','Amount','PKR rate','Business use %','Business cost PKR','Domestic deduction claimed','Evidence','Attachment name'],...expenses().map(e=>[e.date,e.vendor,e.category,e.currency,e.amount,e.rate,e.businessPct,expenseMath(e),e.deductible,e.evidence,e.receipt?.name||''])]),'text/csv;charset=utf-8');}
function worksheet(){return {...estimate(workspace,year),generatedAt:new Date().toISOString(),mode,profile:workspace.profile,receipts:receipts(),expenses:expenses().map(({receipt,...e})=>({...e,attachmentName:receipt?.name||null})),dataBoundary:'For accountant review; not an IRIS return or import file. Invoices excluded until received.'};}
function printHTML(title:string,body:string){const existing=document.querySelector('#print-surface');existing?.remove();const el=document.createElement('section');el.id='print-surface';el.innerHTML=`<div class="print-top">${h(title)}<button class="btn secondary" data-action="print-now">Print / Save PDF</button><button class="btn secondary" data-action="close-print">Close preview</button></div>${body}`;document.body.append(el);refreshIcons();el.querySelector('[data-action="print-now"]')?.addEventListener('click',()=>window.print());el.querySelector('[data-action="close-print"]')?.addEventListener('click',()=>el.remove());}
function printInvoice(id:string){const i=workspace.invoices.find(i=>i.id===id)!;printHTML(i.number,`<div class="invoice-paper"><div class="invoice-heading"><div><h1>Invoice</h1><p>${h(i.number)}</p></div><b>hisaab.</b></div><div class="invoice-parties"><div><small>From</small><h2>${h(i.issuer)}</h2></div><div><small>Bill to</small><h2>${h(i.client)}</h2><p>${h(i.email)}</p></div></div><p>Issued ${dateLabel(i.date)} · Due ${dateLabel(i.due)} · ${i.status}</p><table><thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody><tr><td>${h(i.description)}</td><td>${i.quantity}</td><td>${fmt(Number(i.unitPrice),i.currency)}</td><td>${fmt(invoiceTotal(i),i.currency)}</td></tr></tbody></table><div class="invoice-total">Total due <strong>${fmt(invoiceTotal(i),i.currency)}</strong></div><p>${h(i.notes)}</p><p class="note">No sales tax added. This is a commercial invoice, not an FBR digital tax invoice.</p></div>`);}
function printWorksheet(){const e=estimate(workspace,year);printHTML(`Tax worksheet TY${year}`,`<div class="invoice-paper"><h1>Hisaab · Pakistan tax worksheet</h1><p>TY${year} · ${h(workspace.profile.name)} · ${RULE_VERSION} · ${mode==='demo'?'DEMONSTRATION DATA':''}</p><h2>${e.liability===null?'Final liability blocked: review required':'Federal estimate for review'}</h2><pre>${h(JSON.stringify(worksheet(),null,2))}</pre></div>`);}
function fxDetails(){return fx?`USD/PKR ${fx.rates.PKR.toFixed(4)} · Provider timestamp ${h(fx.time)} · Next update ${h(fx.expires)}. ${Date.now()-Date.parse(fx.time)>172800000?'Stale quote — verify before comparing.':''}`:'';}
async function doAction(action:string){switch(action){
 case 'current-chat':sidebarOpen=false;go('Home');break;
 case 'sidebar':sidebarOpen=true;render();document.querySelector<HTMLElement>('.sidebar button')?.focus();break;
 case 'close-sidebar':sidebarOpen=false;render();break;
 case 'new-chat':chatAbort?.abort();chatAbort=null;chatSaving=false;pendingChatText='';await switchChat();sidebarOpen=false;go('Home');break;
 case 'all-chats':sidebarOpen=false;openDrawer('all-chats');break;
 case 'memory':sidebarOpen=false;openDrawer('memory');break;
 case 'year-picker':openDrawer('year-picker');break;
 case 'exports':sidebarOpen=false;openDrawer('exports');break;
 case 'tax-details':openDrawer('tax-details');break;
 case 'pack-note':openDrawer('pack-note');break;
 case 'sort-lines':go('Statements');lineFilter='pending';render();break;
 case 'download-pack':case 'share-pack':await preparePackFile(action==='share-pack');break;
 case 'cancel-2fa':pending2fa=null;render();break;
 case 'setup-2fa':{
  if(mode!=='vault'){toast('Create a private workspace first.');break;}
  const secret=randomSecret();
  twoFactorDraft={secret,uri:otpauthUri(secret,workspace.profile.name),codes:makeRecoveryCodes(),confirmed:false};
  render();document.querySelector('.twofa-setup')?.scrollIntoView({block:'start'});break;}
 case 'add-passkey':{
  if(mode!=='vault'){toast('Create a private workspace first.');break;}
  if(!dek||!unlockers)throw Error('Workspace is locked.');
  // The passphrase slot is never touched here, so the worst case of a failed
  // registration is that nothing was added.
  const {credentialId,prf}=await registerPasskey(workspace.profile.name||'Hisaab workspace');
  unlockers=await addPasskey(unlockers,dek,credentialId,prf,deviceLabel(),new Date().toISOString());
  await persist(workspace);render();
  toast('This device can now open your workspace. Your passphrase still works.');break;}
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
 case 'cloud-account':await connectCloudAccount();break;case 'cloud-google':if(!googleReady)throw Error('Google sign-in needs owner setup before it is available.');await signInGoogle();break;case 'cloud-upload':if(mode!=='vault')throw Error('Create or unlock a private workspace before uploading.');{const company=activeCompany(),name=cloudCompanies.find(c=>c.id===company)?.name;if(!company)throw Error('Choose a company first.');confirmChange(`Sync this browser’s encrypted books to ${name||'the selected company'}? This includes chats, memory and attachments. Check that these books belong to this company.`,async()=>{if(activeCompany()!==company)throw Error('Company changed. Try again.');await manualCloudUpload(localStorage.getItem(VAULT_KEY)!);drawer='';render();toast('Encrypted workspace synced.');});}break;case 'cloud-load':{pauseCloudSync();const remote=await remoteWorkspace();if(!remote)throw Error('No encrypted cloud backup exists yet.');cloudRestore=remote;backupToRestore=remote.raw;openDrawer('restore');break;}case 'push-enable':if(workspace.security.offlineOnly)throw Error('Never touch the network is on.');pushOn=await enableReminders(year,!!document.querySelector<HTMLInputElement>('#push-filing')?.checked);cloudMessage='Background reminders enabled. You can turn them off here.';render();break;case 'push-disable':await disableReminders();pushOn=false;cloudMessage='Background reminders turned off.';render();break;case 'cloud-signout':await disableReminders();pushOn=false;pauseCloudSync();await signOutCloud();cloudUser=null;cloudReady=false;cloudMessage='Signed out. Local encrypted books are kept.';render();break;case 'cloud-send':await sendCloudPreview();break;case 'save-offline':if(workspace.security.offlineOnly)throw Error('Never touch the network is on. Turn it off before downloading the offline app shell.');if(!('serviceWorker' in navigator))throw Error('This browser does not support saving the app offline.');await navigator.serviceWorker.register(new URL('offline-sw.js',document.baseURI),{scope:new URL('.',document.baseURI).pathname});await navigator.serviceWorker.ready;toast('Offline app shell saved. Exports and AI need their first download before offline use.');break;case 'reminders':openDrawer('reminders');break;case 'calendar-reminders':download(`hisaab-reminders-TY${year}.ics`,reminderCalendar(year,today()),'text/calendar;charset=utf-8');break;case 'ai-settings':openDrawer('ai');break;case 'activity':openDrawer('activity');break;case 'ai-stop':stopBrowserAi();aiLoading=false;aiProgress='Stopped. Guided chat is ready.';assistantEngine='guided';render();break;case 'ai-start':if(aiLoading)break;aiLoading=true;aiProgress='Preparing download…';render();try{await startBrowserAi(workspace.security.offlineOnly,message=>{aiProgress=message;if(drawer==='ai')render();});if(browserAiReady())assistantEngine='qwen';}catch(e){aiProgress=safeError(e);}finally{aiLoading=false;if(drawer==='ai')render();}break;case 'toggle-theme':applyTheme(storedTheme()==='dark'||(storedTheme()==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)?'light':'dark');render();break;case 'new-income':openDrawer('income');break;case 'new-invoice':openDrawer('invoice');break;case 'new-expense':openDrawer('expense');break;case 'search-money':go('Money');moneyTab='in';render();document.querySelector<HTMLInputElement>('#search')?.focus();break;case 'create-vault':if(hasVault()){openDrawer('open-vault');}else openDrawer('create-vault');break;case 'open-vault':openDrawer('open-vault');break;case 'close':cloudRestore=null;drawer='';confirmAction=null;backupToRestore='';render();break;case 'lock':lock();break;case 'demo':mode='demo';workspace=demo();page='Today';await refreshLicense();render();break;case 'income-csv':incomeCsv();break;case 'expense-csv':expenseCsv();break;case 'worksheet':download(`hisaab-tax-worksheet-TY${year}.json`,JSON.stringify(worksheet(),null,2));break;case 'print-worksheet':printWorksheet();break;case 'tax-profile':page='Settings';openDrawer('settings:profile');break;case 'fx':openDrawer('fx');break;case 'backup':if(mode!=='vault'){toast('Create or unlock a private workspace before backing up.');break;}download('hisaab-encrypted.backup.json',localStorage.getItem(VAULT_KEY)!);break;case 'delete-vault':if(!hasVault()){toast('No encrypted workspace is stored in this browser.');break;}confirmChange('Delete Hisaab’s encrypted workspace from this browser? This cannot be undone without your backup. Type DELETE to confirm.',async()=>{const input=document.querySelector<HTMLInputElement>('[name="delete-confirm"]');if(input?.value!=='DELETE')throw Error('Type DELETE to confirm.');localStorage.removeItem(VAULT_KEY);dek=null;unlockers=null;mode='demo';workspace=demo();drawer='';page='Today';render();toast('Local encrypted workspace deleted.');});document.querySelector('.confirm-actions')?.insertAdjacentHTML('beforebegin',input('Type DELETE','delete-confirm','','text'));break;case 'confirm':if(confirmAction){try{await confirmAction();confirmAction=null;}catch(e){toast(safeError(e));}}break;case 'fetch-fx':if(workspace.security.offlineOnly){toast('Never touch the network is on. Turn it off in Privacy and security if you want reference rates.');break;}{const b=document.querySelector<HTMLButtonElement>('[data-action="fetch-fx"]')!;b.disabled=true;b.textContent='Fetching…';try{const resp=await fetch('https://open.er-api.com/v6/latest/USD',{referrerPolicy:'no-referrer',credentials:'omit',signal:AbortSignal.timeout(10000)});if(!resp.ok)throw Error('Rate provider is unavailable. Enter a manual bank rate.');const data=await resp.json();if(data.result!=='success'||!currencies.every(c=>typeof data.rates?.[c]==='number'&&Number.isFinite(data.rates[c])&&data.rates[c]>0)||typeof data.time_last_update_utc!=='string'||!Number.isFinite(Date.parse(data.time_last_update_utc)))throw Error('Invalid rate response. Use a manual bank rate.');fx={rates:data.rates,time:data.time_last_update_utc,expires:data.time_next_update_utc};document.querySelector('#live-fx')!.textContent=fxDetails();}catch(e){toast(safeError(e));}finally{b.disabled=false;b.innerHTML=icon('refresh-cw')+'Fetch reference quote';refreshIcons();}break;}}
}
function updateIncomePreview(){const f=document.querySelector<HTMLFormElement>('#income-form');if(!f)return;const d=new FormData(f);try{const gross=new Decimal(String(d.get('gross')||0)),fee=new Decimal(String(d.get('fee')||0)),rate=new Decimal(String(d.get('rate')||0)),bf=new Decimal(String(d.get('bankFee')||0)),wh=new Decimal(String(d.get('withheld')||0));document.querySelector('#income-preview')!.textContent=`Estimated cash settlement: ${fmt(money(gross.minus(fee).mul(rate).minus(bf).minus(wh)))}`;}catch{document.querySelector('#income-preview')!.textContent='Enter valid amounts to preview settlement.';}}
function bind(){bindConversation();bindStatements();bindSecurity();document.querySelectorAll<HTMLElement>('[data-page]').forEach(el=>el.onclick=e=>{e.preventDefault();go(el.dataset.page!);});document.querySelectorAll<HTMLElement>('[data-action]').forEach(el=>el.onclick=()=>{void doAction(el.dataset.action!).catch(e=>toast(safeError(e)));});
 document.querySelector<HTMLSelectElement>('#year')?.addEventListener('change',ev=>{year=Number((ev.target as HTMLSelectElement).value);void refreshReview().then(render);toast('Review the tax profile for the selected year before relying on an estimate.');});
 document.querySelector<HTMLInputElement>('#search')?.addEventListener('input',ev=>{const el=ev.target as HTMLInputElement,pos=el.selectionStart;query=el.value;render();const next=document.querySelector<HTMLInputElement>('#search')!;next.focus();next.setSelectionRange(pos,pos);});
 document.querySelector<HTMLSelectElement>('#category-filter')?.addEventListener('change',ev=>{categoryFilter=(ev.target as HTMLSelectElement).value;render();});document.querySelector<HTMLSelectElement>('#rail-filter')?.addEventListener('change',ev=>{railFilter=(ev.target as HTMLSelectElement).value;render();});
 for(const [attr,type] of [['edit-income','income'],['edit-expense','expense'],['edit-invoice','invoice']])document.querySelectorAll<HTMLElement>(`[data-${attr}]`).forEach(el=>el.onclick=()=>openDrawer(type,el.getAttribute(`data-${attr}`)!));
 document.querySelectorAll<HTMLElement>('[data-print]').forEach(el=>el.onclick=()=>printInvoice(el.dataset.print!));
 /* Removing a passkey is always safe — the passphrase slot cannot be removed —
    so this confirms for the surprise, not for the risk. */
 document.querySelectorAll<HTMLElement>('[data-remove-passkey]').forEach(el=>el.onclick=()=>{
  const id=el.dataset.removePasskey!;
  confirmChange('Remove this passkey? This device will need your passphrase again. Your records are untouched.',async()=>{
   if(!unlockers)throw Error('Workspace is locked.');
   unlockers=removePasskey(unlockers,id);
   await persist(workspace);drawer='';render();toast('Passkey removed.');});});
 document.querySelectorAll<HTMLElement>('[data-delete]').forEach(el=>el.onclick=()=>{const [table,id]=el.dataset.delete!.split(':');confirmChange('Remove this record? Export a backup first if you may need it later.',async()=>{await change(w=>{w[table as 'receipts']=w[table as 'receipts'].filter(r=>r.id!==id);});});});

 document.querySelectorAll<HTMLElement>('[data-view-receipt]').forEach(el=>el.onclick=()=>{const a=workspace.expenses.find(e=>e.id===el.dataset.viewReceipt)?.receipt;if(!a)return;const bytes=Uint8Array.from(atob(a.data.split(',')[1]),c=>c.charCodeAt(0));const url=URL.createObjectURL(new Blob([bytes],{type:a.mime}));const link=document.createElement('a');link.href=url;link.download=a.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);});
 document.querySelector<HTMLFormElement>('#income-form')?.addEventListener('input',updateIncomePreview);
 document.querySelector<HTMLSelectElement>('[name="currency"]')?.addEventListener('change',ev=>{const f=(ev.target as HTMLElement).closest('form');if((ev.target as HTMLSelectElement).value==='PKR'){const r=f?.querySelector<HTMLInputElement>('[name="rate"]');if(r)r.value='1';}updateIncomePreview();});
 bindForm('income-form',async(f,d)=>{const raw=Object.fromEntries(d.entries());const r=receiptSchema.parse({...raw,id:editId||crypto.randomUUID(),banking:d.has('banking'),baseConfirmed:d.has('baseConfirmed')});if(chatDraft||editingProposal){await stageChatRecord('receipts',r);return;}await change(w=>{const i=w.receipts.findIndex(v=>v.id===r.id);if(i<0)w.receipts.push(r);else w.receipts[i]=r;linkLine(w,r.id,'income');});pendingLine='';});
 bindForm('expense-form',async(f,d)=>{const old=workspace.expenses.find(e=>e.id===editId);let receipt=d.has('removeReceipt')?null:old?.receipt||null;const file=f.querySelector<HTMLInputElement>('#receipt-file')?.files?.[0];if(file){if(file.size>1_000_000)throw Error('Receipt must be 1 MB or smaller.');if(!['image/png','image/jpeg','application/pdf'].includes(file.type))throw Error('Only PNG, JPEG and PDF receipts are supported.');const bytes=new Uint8Array(await file.arrayBuffer());const valid=file.type==='application/pdf'?new TextDecoder().decode(bytes.slice(0,5))==='%PDF-':file.type==='image/png'?bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10':bytes[0]===255&&bytes[1]===216&&bytes[2]===255;if(!valid)throw Error('File content does not match its receipt type.');const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result as string);reader.onerror=()=>reject(Error('Could not read attachment'));reader.readAsDataURL(file);});receipt={name:file.name,mime:file.type as 'image/png',data};}const raw=Object.fromEntries(d.entries());delete raw.removeReceipt;const e=expenseSchema.parse({...raw,id:editId||crypto.randomUUID(),businessPct:Number(d.get('businessPct')),deductible:d.has('deductible'),receipt});if(chatDraft||editingProposal){await stageChatRecord('expenses',e);return;}await change(w=>{const i=w.expenses.findIndex(v=>v.id===e.id);if(i<0)w.expenses.push(e);else w.expenses[i]=e;linkLine(w,e.id,'expense');});pendingLine='';});
 bindForm('invoice-form',async(f,d)=>{const i=invoiceSchema.parse({...Object.fromEntries(d.entries()),id:editId||crypto.randomUUID(),quantity:Number(d.get('quantity'))});if(workspace.invoices.some(v=>v.number===i.number&&v.id!==i.id))throw Error('Invoice number already exists. Choose a unique number.');if(chatDraft||editingProposal){await stageChatRecord('invoices',i);return;}await change(w=>{const idx=w.invoices.findIndex(v=>v.id===i.id);if(idx<0)w.invoices.push(i);else w.invoices[idx]=i;});});
 bindForm('profile-form',async(f,d)=>{await change(w=>{w.profile={confirmedYear:year,name:String(d.get('name')),province:d.get('province') as Workspace['profile']['province'],...Object.fromEntries(checks.map(([k])=>[k,d.has(k)]))} as Workspace['profile'];});});
 /** Completes an unlock once every factor has been satisfied. */
 const openWorkspace=async(result:Unlocked,message:string)=>{
  workspace=result.workspace;dek=result.dek;unlockers=result.unlockers;
  mode='vault';drawer='';page='Today';
  pending2fa=null;lastActivity=Date.now();
  // A workspace written by the previous release has just been read with the old
  // one-key format. Saving it now rewrites it with the wrapping layer, which is
  // what lets a passkey be added later. If this never runs the old file still
  // opens, so there is nothing to warn anybody about.
  if(result.migrated)await persist(result.workspace);
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
 /* Passkey unlock. Bound here rather than in doAction because it finishes
    through the same openWorkspace path as the passphrase, two-factor gate
    included: a passkey replaces the passphrase, not the second factor.
    Assigned after the generic [data-action] pass, which it overrides. */
 document.querySelectorAll<HTMLElement>('[data-action="unlock-passkey"]').forEach(el=>el.onclick=()=>{
  void (async()=>{
   const raw=localStorage.getItem(VAULT_KEY);
   if(!raw)throw Error('No workspace stored in this browser.');
   const slots=storedPasskeys();
   if(!slots.length)throw Error('No passkey is registered for this workspace.');
   const assertion=await assertPasskey(slots.map(k=>k.credentialId));
   // Null means the person dismissed the prompt. Not an error worth shouting.
   if(!assertion)return;
   const result=await unlockWithPasskey(raw,assertion.credentialId,assertion.prf);
   if(result.workspace.security.twoFactor&&result.workspace.security.totpSecret){
    pending2fa=result;mode='locked';drawer='';render();
    document.querySelector<HTMLInputElement>('#unlock-2fa-form input')?.focus();
    return;
   }
   await openWorkspace(result,'Workspace unlocked.');
  })().catch(e=>{
   const box=document.querySelector('.lock-panel .form-error');
   if(box)box.textContent=safeError(e);else toast(safeError(e));
  });
 });
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
  localStorage.setItem(VAULT_KEY,JSON.stringify(await sealWith(next,held.dek,held.unlockers)));
  const left=RECOVERY_COUNT-next.security.recoveryUsed;
  await openWorkspace({...held,workspace:next},
   `Recovery code used. ${left} left — set up your authenticator again from Settings if you have lost it.`);
 });
 bindForm('unlock-form',unlockHandler);
 bindForm('vault-form',async(f,d)=>{if(drawer==='open-vault'){await unlockHandler(f,d);return;}if(hasVault())throw Error('A vault already exists. Unlock or back it up before replacing it.');if(d.get('passphrase')!==d.get('confirm'))throw Error('Passphrases do not match.');const next=blankWorkspace();next.profile.name=String(d.get('name'));next.license.trialStarted=today();const created=await createVault(next,String(d.get('passphrase')));localStorage.setItem(VAULT_KEY,JSON.stringify(created.envelope));dek=created.dek;unlockers=created.envelope.unlockers;workspace=next;mode='vault';drawer='memory';page='Today';lastActivity=Date.now();await refreshLicense();await refreshReview();render();toast('Encrypted workspace created. Keep a backup and remember your passphrase.');});
 document.querySelector<HTMLInputElement>('#restore-file')?.addEventListener('change',async ev=>{const file=(ev.target as HTMLInputElement).files?.[0];if(!file)return;if(file.size>MAX_BACKUP){toast('Backup is too large.');return;}backupToRestore=await file.text();openDrawer('restore');});
 bindForm('restore-form',async(f,d)=>{if(!d.has('replace'))throw Error('Confirm replacement before restoring.');const result=await unlock(backupToRestore,String(d.get('passphrase')));dek=result.dek;unlockers=result.unlockers;workspace=result.workspace;mode='vault';drawer='';backupToRestore='';page='Today';lastActivity=Date.now();// Written through persist rather than stored verbatim, so a backup from the
  // previous release arrives in this browser already migrated, and a restored
  // backup never carries another device's passkeys, which could not work here.
  unlockers=result.unlockers.filter(u=>u.kind==='passphrase');await persist(result.workspace);if(cloudRestore){setCloudNetworkAllowed(!workspace.security.offlineOnly);await bindCloudCopy(cloudRestore.raw,cloudRestore.owner,cloudRestore.revision);cloudMessage='Cloud workspace restored. Connect and sync to enable updates.';cloudRestore=null;}await refreshLicense();await refreshReview();render();toast('Backup decrypted, validated and restored.');});
 bindForm('fx-form',async(f,d)=>{const vals=['gross','fee','rate','bankFee'].map(k=>new Decimal(String(d.get(k))));const [g,fee,rate,bf]=vals;if(vals.some(v=>!v.isFinite()||v.lt(0))||rate.lte(0)||fee.gt(g)||bf.gt(g.minus(fee).mul(rate)))throw Error('Enter valid amounts; fees cannot exceed proceeds.');const c=String(d.get('currency'));if(c==='PKR'&&!rate.eq(1))throw Error('PKR rate must be 1.');let result=`<h3>${fmt(money(g.minus(fee).mul(rate).minus(bf)))}</h3><p>Take-home after the entered fees</p>`;if(fx){const ref=fx.rates.PKR/fx.rates[c];result+=`<p>Reference ${ref.toFixed(4)} PKR/${h(c)} · Difference before fees ${fmt(money(g.mul(ref).minus(g.mul(rate))))}</p>`;}document.querySelector('#fx-result')!.innerHTML=result;});
}
function bindForm(id:string,handler:(f:HTMLFormElement,d:FormData)=>Promise<void>){const f=document.getElementById(id) as HTMLFormElement|null;if(!f)return;f.onsubmit=async ev=>{ev.preventDefault();const b=f.querySelector<HTMLButtonElement>('[type="submit"]')!;b.disabled=true;const error=f.querySelector('.form-error');if(error)error.textContent='';try{await handler(f,new FormData(f));}catch(e){if(error)error.textContent=safeError(e);else toast(safeError(e));}finally{b.disabled=false;}};}
document.addEventListener('keydown',e=>{lastActivity=Date.now();if(e.key==='Escape'){if(sidebarOpen){sidebarOpen=false;render();}document.querySelector('.app-menu')?.removeAttribute('open');document.querySelector('#print-surface')?.remove();if(drawer){drawer='';render();}}if(e.key==='Tab'&&(drawer||sidebarOpen)){const items=[...document.querySelectorAll<HTMLElement>('.drawer button,.drawer input:not([hidden]),.drawer select,.drawer textarea,.drawer a,.sidebar button')].filter(e=>!(e as HTMLInputElement).disabled);const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
for(const event of ['pointerdown','input','scroll'])document.addEventListener(event,()=>lastActivity=Date.now(),{passive:true});
setInterval(()=>{
 const minutes=workspace.security?.autoLockMinutes??5;
 if(mode==='vault'&&Date.now()-lastActivity>minutes*60000){
  document.querySelector('#print-surface')?.remove();lock();
  toast(`Workspace locked after ${minutes} minute${minutes===1?'':'s'} without activity.`);
 }},10000);
window.addEventListener('storage',e=>{if(e.key===VAULT_KEY&&mode==='vault'){lock();toast('Workspace changed in another tab. Unlock to load the latest version.');}});
window.addEventListener('pagehide',()=>{if(mode==='vault')lock();});
if(new URL(location.href).searchParams.has('code'))page='Settings';
if(hasVault()){mode='locked';workspace=blankWorkspace();}
void refreshLicense().then(()=>{
 render();
 if(serviceConfigured())void pingOnce(license,today());
});
// Re-rendered on the answer, because the lock screen's passkey button and the
// security control both depend on it and neither is worth blocking boot for.
void passkeysAvailable().then(available=>{
 if(!available)return;
 passkeyCapable=true;render();
});

/* ── Statement import, line review and entitlements ───────────────────────── */
const packPlanLabel=()=>mode==='demo'?'Demo workspace (sample data)':FREE_PREVIEW?previewLabel:planLabel(license);
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
 document.querySelector<HTMLInputElement>('#offline-only')?.addEventListener('change',async ev=>{
  const on=(ev.target as HTMLInputElement).checked;if(on&&await remindersActive()){try{setCloudNetworkAllowed(true);await disableReminders();pushOn=false;}catch(e){(ev.target as HTMLInputElement).checked=false;toast('Could not pause reminders. Try turning them off in Account settings first.');return;}}if(on){chatAbort?.abort();setCloudNetworkAllowed(false);cloudReady=false;cloudUser=null;cloudPreview=null;}
  void change(w=>{w.security.offlineOnly=on;}).then(()=>{if(on){fx=null;if(aiLoading){stopBrowserAi();aiLoading=false;aiProgress='Download cancelled by Never touch the network.';}}}).catch(e=>toast(safeError(e)));
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

function bindConversation(){
 document.querySelector<HTMLSelectElement>('#cloud-company')?.addEventListener('change',ev=>{selectCompany((ev.target as HTMLSelectElement).value);cloudMessage='Company selected. Local books have not been replaced. Load its encrypted workspace to switch books.';render();});
 bindForm('company-form',async(_f,d)=>{await createCompany(String(d.get('companyName')||''));cloudCompanies=await listCompanies();cloudMessage='Company created. Only its members can access its encrypted rows.';render();});
 bindForm('iris-memory-form',async(_f,d)=>{if(!d.has('remember'))throw Error('Confirm that you want to remember this unverified code.');await change(w=>{const entry={id:crypto.randomUUID(),taxYear:Number(d.get('taxYear')),code:String(d.get('code')||'').trim(),label:String(d.get('label')||'').trim(),path:String(d.get('path')||'').trim(),source:'From you, not verified' as const,givenOn:today()};const old=w.conversation.irisMemory.find(m=>m.taxYear===entry.taxYear&&m.code===entry.code);if(old)Object.assign(old,entry,{id:old.id});else w.conversation.irisMemory.push(entry);});});
 document.querySelectorAll<HTMLElement>('[data-forget-iris]').forEach(el=>el.onclick=()=>{void change(w=>{w.conversation.irisMemory=w.conversation.irisMemory.filter(m=>m.id!==el.dataset.forgetIris);});});
 document.querySelectorAll<HTMLElement>('[data-chat-section]').forEach(el=>el.onclick=()=>{void openChatSection(el.dataset.chatSection as ChatMessage['section']).catch(e=>toast(safeError(e)));});
 document.querySelectorAll<HTMLElement>('[data-chat-file]').forEach(el=>el.onclick=()=>{void chatFileAction(el.dataset.chatFile!,el.dataset.fileAction||'prepare').catch(e=>toast(safeError(e)));});
 document.querySelectorAll<HTMLElement>('[data-record-decision]').forEach(el=>el.onclick=()=>{void change(w=>decideRecord(w,el.dataset.recordProposal!,el.dataset.recordDecision as 'confirmed'|'rejected'|'undone',new Date().toISOString()));});
 document.querySelectorAll<HTMLElement>('[data-record-edit]').forEach(el=>el.onclick=()=>{const m=workspace.conversation.messages.find(m=>m.id===el.dataset.recordEdit);if(!m?.record||m.decision!=='pending')return;editingProposal=m.id;const r=parseRecord(m.record.table,m.record.after);openDrawer(m.record.table==='receipts'?'income':m.record.table==='expenses'?'expense':'invoice',m.record.before?r.id:'');});
 document.querySelectorAll<HTMLElement>('[data-delete-chat]').forEach(el=>el.onclick=()=>{const id=el.dataset.deleteChat;confirmChange('Delete this archived chat? Keep an encrypted backup if you may need it again.',async()=>{await change(w=>{w.conversation.threads=w.conversation.threads.filter(t=>t.id!==id);});});});
 bindForm('export-form',async(_f,d)=>{const kind=String(d.get('kind'));if(!exportKinds.includes(kind as ExportKind))throw Error('Choose a supported report.');const snapshot=workspace,exportYear=year,table=reportTable(snapshot,exportYear,kind as ExportKind),xlsx=d.get('format')==='Excel (.xlsx)';if(!xlsx){download(`hisaab-${kind}-TY${exportYear}.csv`,reportCsv(table),'text/csv;charset=utf-8');return;}const file=await reportXlsx(table);if(mode==='locked'||workspace!==snapshot)return;const url=URL.createObjectURL(file),link=document.createElement('a');link.href=url;link.download=`hisaab-${kind}-TY${exportYear}.xlsx`;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);});

 bindForm('memory-form',async(_f,d)=>{await change(w=>{for(const key of ['age-band','work','preferred-language','province'] as const){const value=String(d.get(key)||'').trim();w.conversation.memory=w.conversation.memory.filter(m=>m.key!==key);if(value)w.conversation.memory.push({id:crypto.randomUUID(),key,value,source:'You told me',givenOn:today(),verified:false});}});});
 document.querySelectorAll<HTMLElement>('[data-forget-memory]').forEach(el=>el.onclick=()=>{void change(w=>{w.conversation.memory=w.conversation.memory.filter(m=>m.id!==el.dataset.forgetMemory);});});

 document.querySelectorAll<HTMLElement>('[data-chat-id]').forEach(el=>el.onclick=()=>{void switchChat(el.dataset.chatId).then(()=>go('Home')).catch(e=>toast(safeError(e)));});
 document.querySelectorAll<HTMLElement>('[data-settings-section]').forEach(el=>el.onclick=()=>openDrawer('settings:'+el.dataset.settingsSection));
 bindForm('pack-note-form',async(_f,d)=>{await change(w=>{w.conversation.packNotes[String(year)]=String(d.get('note')||'');});pdfPack=null;});
 const form=document.querySelector<HTMLFormElement>('#chat-form');if(form)form.onsubmit=ev=>{ev.preventDefault();void askHisaab(String(new FormData(form).get('message')||''));};
 document.querySelectorAll<HTMLElement>('[data-chat-prompt]').forEach(el=>el.onclick=()=>void askHisaab(el.dataset.chatPrompt!));
 document.querySelectorAll<HTMLElement>('[data-source-id]').forEach(el=>el.onclick=()=>openSource(el.dataset.sourceId!));
 document.querySelectorAll<HTMLElement>('[data-source-list]').forEach(el=>el.onclick=()=>{sourceIds=el.dataset.sourceList!.split(',');openDrawer('sources');});
 document.querySelectorAll<HTMLElement>('[data-analysis-proposal]').forEach(el=>el.onclick=()=>{void (async()=>{const parent=workspace.conversation.messages.find(m=>m.id===el.dataset.analysisMessage);if(!parent)return;const card=el.closest('article')!;const ids=Array.from(card.querySelectorAll<HTMLElement>('[data-source-id]')).map(x=>x.dataset.sourceId!);const all=card.querySelector<HTMLElement>('[data-source-list]')?.dataset.sourceList;await saveConversation([...workspace.conversation.messages,{...parent,id:crypto.randomUUID(),kind:'proposal',text:el.textContent!.trim(),sourceIds:all?all.split(','):ids,decision:'pending'}]);render();document.querySelector('.chat-thread>article:last-child')?.scrollIntoView({block:'start',behavior:'instant'});})().catch(e=>toast(safeError(e)));});
 for(const [attr,decision] of [['proposal-confirm','confirmed'],['proposal-reject','rejected'],['proposal-undo','pending']] as const)document.querySelectorAll<HTMLElement>(`[data-${attr}]`).forEach(el=>el.onclick=()=>{void (async()=>{const id=el.getAttribute(`data-${attr}`),m=workspace.conversation.messages.find(m=>m.id===id);if(!m||m.kind!=='proposal'||(decision!=='pending'&&m.decision!=='pending'))return;await saveConversation(workspace.conversation.messages.map(x=>x.id===id?{...x,decision}:x));render();if(decision==='confirmed'){sourceIds=m.sourceIds;openDrawer('sources');}})().catch(e=>toast(safeError(e)));});
 document.querySelectorAll<HTMLElement>('[data-proposal-edit]').forEach(el=>el.onclick=()=>{const m=workspace.conversation.messages.find(m=>m.id===el.dataset.proposalEdit);if(!m)return;sourceIds=m.sourceIds;openDrawer('sources');});
}
async function preparePackFile(share:boolean){
 if(pdfBusy)return;if(!limits.filingPack){go('Settings');toast('The Filing Pack is part of Pro.');return;}
 const snapshot=workspace,selectedYear=year;
 // Web Share requires a fresh user activation after asynchronous PDF generation.
 if(share&&pdfPack&&pdfPack.fingerprint===packDigestCache){if(navigator.canShare?.({files:[pdfPack.file]})){try{await navigator.share({files:[pdfPack.file],title:`Hisaab Filing Pack TY ${year}`});}catch(e){if(!(e instanceof DOMException&&e.name==='AbortError'))toast('Sharing failed. Download the PDF and attach it in WhatsApp.');}return;}}
 pdfBusy=true;pdfError='';const pdfController=new AbortController();pdfAbort=pdfController;render();
 try{const {makePackPDF}=await import('./pack-pdf');const result=await makePackPDF(filingPack(snapshot,selectedYear,packPlanLabel(),{digest:packDigestCache,review}).data,snapshot.conversation.packNotes[String(selectedYear)]||'',pdfController.signal);if(mode==='locked'||workspace!==snapshot||year!==selectedYear)return;pdfPack={...result,fingerprint:packDigestCache};if(share){toast(navigator.canShare?.({files:[result.file]})?'PDF ready. Tap Share to WhatsApp again to choose WhatsApp.':'Sharing files is unavailable here. Download the PDF and attach it in WhatsApp.');}else{const url=URL.createObjectURL(result.file),a=document.createElement('a');a.href=url;a.download=result.file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}}
 catch(e){if(!pdfController.signal.aborted)pdfError=safeError(e);}finally{if(pdfAbort===pdfController){pdfAbort=null;pdfBusy=false;}render();}
}

async function switchChat(id?:string){
 if(busy)return;chatAbort?.abort();chatAbort=null;pendingChatText='';chatSaving=false;busy=true;
 try{const next=structuredClone(workspace),history=next.conversation,selected=id?history.threads.find(t=>t.id===id):undefined;if(id&&!selected)throw Error('This chat is no longer available.');
 const archived=archiveCurrent(history.threads,history.messages,history.activeId,today());history.threads=archived.filter(t=>t.id!==id);history.messages=selected?structuredClone(selected.messages):[];history.activeId=selected?.id||crypto.randomUUID();await persist(next);
 }finally{busy=false;} }

function memoryView(){const items=workspace.conversation.memory,value=(key:string)=>items.find(m=>m.key===key)?.value||'';
 const choices=(label:string,key:string,values:string[])=>`<label class="field"><span>${label}</span><select name="${key}"><option value="">Prefer not to say</option>${values.map(v=>`<option value="${h(v)}" ${value(key)===v?'selected':''}>${h(v)}</option>`).join('')}</select></label>`;
 const province=value('province');return `<p>Tell Hisaab a little about your work. These optional answers are saved only when you tap Save; you can edit or forget them here.</p>${province&&province!==workspace.profile.province?`<div class="warning-row">${icon('octagon-alert')}<span>Your remembered location and tax profile differ.</span><button class="warning-action" data-action="tax-profile">Review</button></div>`:''}<form id="memory-form">${choices('Age group','age-band',['Under 18','18–24','25–34','35–44','45+'])}${choices('What do you do?','work',['Developer / IT','Designer','Writer / marketing','Freelancer / other','Small business'])}${choices('Province / region','province',['Punjab','Sindh','Khyber Pakhtunkhwa','Balochistan','Islamabad','AJK / GB','Outside Pakistan'])}${choices('Preferred language','preferred-language',['English','Roman Urdu','Urdu'])}<p class="note">These answers do not change your tax declarations or verified tax rules.</p><button class="btn primary wide" type="submit">Save what I told you</button></form><h3>Remembered facts</h3>${items.length?items.map(m=>`<div class="memory-row"><div><b>${h(m.value)}</b><small>${h(m.source)} · ${dateLabel(m.givenOn)}</small></div><button class="icon-btn" data-forget-memory="${m.id}" aria-label="Forget ${h(m.key)}">${icon('trash-2')}</button></div>`).join(''):'<p class="note">Nothing remembered yet.</p>'}`;}

function prefillChatRecord(){
 const form=document.querySelector<HTMLFormElement>('#income-form,#expense-form,#invoice-form');if(!form)return;
 const set=(name:string,value:string|boolean|number)=>{const el=form.elements.namedItem(name) as HTMLInputElement|HTMLSelectElement|null;if(!el)return;if(el instanceof HTMLInputElement&&el.type==='checkbox')el.checked=!!value;else el.value=String(value);};
 const pending=workspace.conversation.messages.find(m=>m.id===editingProposal);
 if(pending?.record){const r=parseRecord(pending.record.table,pending.record.after);for(const [key,value] of Object.entries(r))if(['string','number','boolean'].includes(typeof value))set(key,value as string);}
 else{const p=chatPrefill(chatDraft);set('currency',p.currency);set('rate',p.currency==='PKR'?'1':'');if(p.amount)set(form.id==='income-form'?'gross':'amount',p.amount);set('category','Other');if(form.id==='income-form'){set('category','other');if(p.source){set('rail',p.source);set('client',p.source);}set('description',chatDraft.slice(0,400));}else if(p.vendor)set('vendor',p.vendor);}
 const submit=form.querySelector('button[type="submit"]');if(submit)submit.textContent='Review proposal';
}
async function stageChatRecord(table:'receipts'|'expenses'|'invoices',record:unknown){
 const prior=workspace.conversation.messages.find(m=>m.id===editingProposal),id=editingProposal;
 await change(w=>{if(prior&&prior.decision!=='pending')throw Error('This proposal has already been decided.');
 const m=draftRecordMessage(w,table,record,{month:today().slice(0,7),year,language:languageOf(chatDraft||prior?.text||'')});
 if(prior?.record){m.record!.before=prior.record.before;const old=w.conversation.messages.find(x=>x.id===id);if(old)old.decision='rejected';w.conversation.activity.push({id:crypto.randomUUID(),proposalId:id,recordId:parseRecord(table,prior.record.after).id,decision:'rejected',on:new Date().toISOString()});}
 w.conversation.messages.push(m);w.conversation.activity.push({id:crypto.randomUUID(),proposalId:m.id,recordId:parseRecord(table,m.record!.after).id,decision:'proposed',on:new Date().toISOString()});});
 chatDraft='';editingProposal='';page='Today';render();
}
function financialProposalView(m:ChatMessage){const r=m.record!;let record;try{record=parseRecord(r.table,r.after);}catch{return '<p>Invalid proposal. Make a new one.</p>';}
 const entries=Object.entries(record).filter(([key])=>key!=='id'&&key!=='receipt');
 return `<article class="proposal-card"><small>${m.decision==='pending'?'Not saved · needs your confirmation':h(m.decision)}</small><h2>${h(m.text)}</h2><p>Why: you asked Hisaab to record this. Check every field against your receipt or statement.</p><dl class="quiet-totals">${entries.map(([key,value])=>`<div><dt>${h(key)}</dt><dd>${h(typeof value==='boolean'?value?'Yes':'No':String(value||'Not supplied'))}</dd></div>`).join('')}</dl><p class="note">Source: your chat and the details you entered. Missing evidence is not verified. No statement lines are classified automatically.</p>${m.decision==='pending'?`<button class="btn primary wide" data-record-decision="confirmed" data-record-proposal="${m.id}">Confirm and save</button><div class="proposal-secondary"><button class="btn secondary" data-record-edit="${m.id}">Edit</button><button class="btn secondary" data-record-decision="rejected" data-record-proposal="${m.id}">Reject</button></div>`:m.decision==='confirmed'?`<button class="btn secondary wide" data-record-decision="undone" data-record-proposal="${m.id}">Undo record change</button>`:''}</article>`;
}
function activityView(){const messages=[...workspace.conversation.messages,...workspace.conversation.threads.flatMap(t=>t.messages)];return workspace.conversation.activity.length?`<div class="history-list">${[...workspace.conversation.activity].reverse().map(a=>{const m=messages.find(m=>m.id===a.proposalId);return `<div class="memory-row"><div><b>${h(m?.text||'Record proposal')} · ${h(a.decision)}</b><small>${dateLabel(a.on.slice(0,10))}</small></div><button class="text-link" data-source-id="${a.recordId}">View record</button></div>`;}).join('')}</div>`:'<p>No record proposals yet. Ask Hisaab to record income or an expense.</p>';}

function chatFileView(m:ChatMessage){const f=m.file!,ready=chatFiles.get(m.id);return `<article class="document-card"><h3>${icon('file-text')}${h(f.name)}</h3><p>${h(f.format.toUpperCase())} · TY ${m.year}${ready?' · '+new Intl.NumberFormat('en').format(ready.size)+' bytes':''}</p><p class="note">Snapshot of your records · not reviewed / not a filed return. Rule ${h(RULE_VERSION)}. Generated locally.</p>${ready?`<button class="btn primary wide" data-chat-file="${m.id}" data-file-action="share">Share to WhatsApp</button><button class="btn secondary wide" data-chat-file="${m.id}" data-file-action="download">Download</button>`:`<button class="btn primary wide" data-chat-file="${m.id}" data-file-action="prepare" ${preparingFile?'disabled':''}>${preparingFile===m.id?'Preparing…':'Prepare file'}</button>`}</article>`;}
async function chatFileAction(id:string,action:string){
 const m=workspace.conversation.messages.find(m=>m.id===id);if(!m?.file)return;
 let file=chatFiles.get(id);
 if(!file){if(preparingFile)return;preparingFile=id;render();const signal=fileAbort.signal;try{file=await generateChatFile(m.file,signal);if(signal.aborted)return;if(chatFiles.size>=5)chatFiles.delete(chatFiles.keys().next().value!);chatFiles.set(id,file);}finally{preparingFile='';if(!signal.aborted)render();}return;}
 if(action==='share'&&navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:m.file.name});}catch(e){if(!(e instanceof DOMException&&e.name==='AbortError'))throw e;}return;}
 const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);if(action==='share')toast('Attach the downloaded file in WhatsApp. This browser cannot share files directly.');
}

async function openChatSection(section:ChatMessage['section']){if(!section)return;page='Today';const ids=section==='Income'?receipts().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map(r=>r.id):section==='Expenses'?expenses().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map(r=>r.id):section==='Invoices'?workspace.invoices.filter(i=>inYear(i.date,year)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map(r=>r.id):section==='Statements'?[...workspace.lines].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map(r=>r.id):[];await saveConversation([...workspace.conversation.messages,{id:crypto.randomUUID(),role:'assistant',text:'',kind:'records',section,month:today().slice(0,7),year,sourceIds:ids,decision:'pending',language:'en'}]);render();}
function chatRecordsView(m:ChatMessage){const total=m.section==='Income'?fmt(sum(workspace.receipts.filter(r=>inYear(r.date,m.year)).map(r=>receiptMath(r).net))):m.section==='Expenses'?fmt(sum(workspace.expenses.filter(r=>inYear(r.date,m.year)).map(expenseMath))):m.section==='Invoices'?'Totals shown in each invoice’s currency':m.section==='Statements'?'Balances kept separately by account':'Estimate · needs review';return `<article class="analysis-card"><h2>${h(m.section||'Records')}</h2><p>TY ${m.year} · ${h(total)}</p><small>Latest 5 records at time of opening. Totals reflect your current records.</small>${m.sourceIds.length?sourcesView(workspace,m.sourceIds,true):'<p>No records in this preview.</p>'}<button class="btn primary wide" data-page="${m.section==='Filing Pack'?'Pack':h(m.section||'Home')}">Open full ${m.section==='Tax'?'estimate':'list'}</button></article>`;}
function savingView(m:ChatMessage){return savingTips(workspace,m.year,m.month).map(t=>`<article class="analysis-card"><small>TY ${m.year} · ${h(RULE_VERSION)}</small><h2>${h(t.title)}</h2>${t.amount!==null?`<strong>${fmt(t.amount)}</strong>`:''}<p>${h(t.detail)}</p>${sourcesView(workspace,t.ids)}<button class="btn secondary wide" data-analysis-proposal="review" data-analysis-message="${m.id}">${h(t.action)}</button><small>Estimate, not tax or financial advice.</small></article>`).join('');}

function irisMemoryView(){return `<h3>IRIS codes you provide</h3><p>These stay separate from verified rules. Check the exact tax year, code and label on your own IRIS screen. Memory never overrides a verified tax rule.</p>${workspace.conversation.irisMemory.map(m=>`<div class="memory-row"><div><b>${h(m.code)} · ${h(m.label)}</b><small>TY ${m.taxYear} · ${h(m.path)} · From you, not verified · ${dateLabel(m.givenOn)}</small></div><button class="icon-btn" data-forget-iris="${m.id}" aria-label="Forget IRIS code ${h(m.code)}">${icon('trash-2')}</button></div>`).join('')}<form id="iris-memory-form">${select('Tax year','taxYear',['2027','2026'],String(year))}${input('Code shown on your IRIS screen','code','','text')}${input('Exact field label','label','','text')}${input('Path / section on your screen','path','','text',false)}${checkInput('Remember this as From you, not verified','remember',false)}<button class="btn secondary wide" type="submit">Save or update this code</button></form>`;}

async function connectCloudAccount(){
 if(workspace.security.offlineOnly)throw Error('Never touch the network is on. Turn it off before connecting.');
 setCloudNetworkAllowed(true);drawer='cloud';cloudWorking=true;cloudMessage='Checking account and online services…';render();
 try{const [user,capabilities,assistant]=await Promise.all([accountUser(),authCapabilities(),hostedStatus()]);if(workspace.security.offlineOnly||mode==='locked')return;cloudUser=user?{id:user.id,email:user.email}:null;googleReady=!!capabilities.external.google;cloudReady=assistant.available;cloudModel=assistant.model;cloudProvider=assistant.provider;if(user){cloudCompanies=await listCompanies();if(cloudCompanies.length===1)selectCompany(cloudCompanies[0].id);pushReady=await pushAvailability();pushOn=await remindersActive();}cloudMessage=user?'Signed in. Your passphrase still protects your books.':googleReady?'Sign in to sync your encrypted books across devices.':'The backend is ready. Google OAuth credentials still need owner setup.';
 }catch(e){cloudMessage=safeError(e);}finally{cloudWorking=false;if(drawer==='cloud')render();}
}
function cloudAccountView(){return `<p>Supabase stores your account and an encrypted vault copy. Income, chats and memory are encrypted before upload. Google sign-in cannot decrypt them; use your workspace passphrase on each new device.</p><p role="status">${h(cloudMessage)}</p>${cloudUser?`<p>${h(cloudUser.email||'Signed in')}</p>${cloudCompanies.length?`<label class="field">Company<select id="cloud-company"><option value="">Choose a company</option>${cloudCompanies.map(company=>`<option value="${company.id}" ${activeCompany()===company.id?'selected':''}>${h(company.name)}</option>`).join('')}</select></label>`:'<p>Create a company workspace to keep its encrypted books separate.</p>'}<p class="note">Company workspaces organize records. The existing tax estimate supports individual freelancer scenarios; corporate/AOP returns need practitioner review.</p><form id="company-form">${input('New company name','companyName','','text')}<button class="btn secondary wide" type="submit">Create company</button></form><p class="note">${h(cloudCompanies.find(company=>company.id===activeCompany())?.role||'Choose a company')} access · membership is checked by the database.</p><button class="btn primary wide" data-action="cloud-upload" ${cloudCompanies.find(company=>company.id===activeCompany())?.role==='viewer'?'disabled':''}>Sync this encrypted workspace</button><button class="btn secondary wide" data-action="cloud-load">Load cloud workspace</button><p class="note">Loading replaces this browser’s books after you confirm and enter the cloud workspace passphrase. Export a local backup first if either copy has unsynced changes. Conflicts never overwrite another device silently.</p><button class="text-link" data-action="backup">Download encrypted local backup</button><button class="text-link" data-action="cloud-signout">Sign out</button>`:`<button class="btn primary wide" data-action="cloud-google" ${googleReady&&!cloudWorking?'':'disabled'}>Continue with Google</button>${!googleReady?'<p class="note">Google sign-in is not configured yet. Local workspaces continue to work.</p>':''}`}${cloudUser?`<h3>Gentle reminders</h3><p>Monthly statement check-ins arrive at 09:00 Pakistan time. Notices use the Hisaab name and ح icon; your device controls their font and popup appearance. No client names or balances appear on the lock screen.</p>${pushSupported()?`${!pushOn?checkInput('Also remind me to review the selected tax year’s Filing Pack','push-filing',false).replace('name="push-filing"','id="push-filing" name="push-filing"'):''}<button class="btn secondary wide" data-action="${pushOn?'push-disable':'push-enable'}" ${pushReady?'':'disabled'}>${pushOn?'Turn off background reminders':'Enable background reminders'}</button>`:'<p class="note">Push is unavailable here. Calendar reminders work without it. Some phones require installing the web app first.</p>'}`:''}<h3>Online assistant</h3><p>${cloudReady?`${h(cloudProvider)} · ${h(cloudModel)} · limited free usage`:'Provider setup is pending. Guided chat remains available.'}</p><p class="note">Before each cloud question, you see the exact redacted chat request. No ledger snapshot is uploaded to the model. Hosted replies cannot calculate tax, invent IRIS codes or save records. Private chats are not used for shared training.</p>`;}
function cloudPreviewView(){return cloudPreview?`<p>Recipient: ${h(cloudProvider)} and its serving model provider · ${h(cloudModel)}.</p><p>Client names, account references, emails and long account/identity numbers are redacted. Check for any sensitive details the automatic redaction missed.</p><pre class="privacy-preview">${h(JSON.stringify({message:cloudPreview.message,history:cloudPreview.history},null,2))}</pre><p class="note">Only this text is sent after your tap. No passphrase, ledger snapshot, attached document or confirmed memory is included. Free-provider limits may interrupt replies.</p><button class="btn primary wide" data-action="cloud-send">Send this request</button>`:'<p>No request is waiting. Close and try your question again.</p>';}
async function sendCloudPreview(){
 const request=cloudPreview;if(!request||chatSaving||workspace.security.offlineOnly)return;
 chatSaving=true;pendingChatText=request.original;const controller=new AbortController();chatAbort=controller;drawer='';render();
 try{const response=await hostedChat(request.message,request.history,controller.signal);if(controller.signal.aborted)return;const lang=languageOf(request.original),base={month:today().slice(0,7),year,sourceIds:[],decision:'pending' as const,language:lang};await saveConversation([...workspace.conversation.messages,{...base,id:crypto.randomUUID(),role:'user',text:request.original,kind:'text'},{...base,id:crypto.randomUUID(),role:'assistant',text:!response.in_scope?reply(lang,'I’m here to help with finance, economics, accounting and personal finance. What money question would you like to explore?','Main finance, economics, accounting aur personal finance mein madad ke liye hoon. Paison ke bare mein kya samajhna chahenge?','میں مالیات، معاشیات، اکاؤنٹنگ اور ذاتی مالیات میں مدد کے لیے ہوں۔ آپ پیسوں کے بارے میں کیا سمجھنا چاہیں گے؟'):response.checked_tax?reply(lang,'I’ll use the checked tax worksheet for this. Any missing eligibility evidence stays visible.','Is sawal ke liye checked tax worksheet dekhein. Missing evidence saaf dikhaya jayega.','اس سوال کے لیے تصدیق شدہ ٹیکس ورک شیٹ دیکھیں۔ نامکمل ثبوت واضح رہے گا۔'):response.reply,kind:response.in_scope&&response.checked_tax?'readiness':'text'}]);cloudPreview=null;
 }catch(e){if(!controller.signal.aborted&&mode!=='locked'){toast(safeError(e));cloudPreview=request;}}finally{if(chatAbort===controller){chatSaving=false;pendingChatText='';chatAbort=null;}render();}
}
