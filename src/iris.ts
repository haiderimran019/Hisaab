/* Where each Hisaab figure goes in IRIS.

   This is the file that decides whether Hisaab saves anybody an afternoon. A
   freelancer who knows their export tax base still has to find the box in IRIS
   that wants it, and that is where the hours go. Bookkeeping named after the
   return is the whole point of the product.

   ──────────────────────────────────────────────────────────────────────────
   READ THIS BEFORE FILLING ANYTHING IN

   Every `code` and `irisLabel` below is **empty on purpose**, and no build may
   ship them invented. A wrong field code does not produce a wrong screen; it
   produces a figure filed in the wrong place, which is a misdeclaration with
   the customer's name on it. The sections of law are safe to state — they come
   from docs/TAX-RULES.md, which was checked against the Ordinance — but a code
   is only ever correct if a person read it off a real return.

   To fill one in: open IRIS, start (do not submit) a return for the right tax
   year and taxpayer type, navigate to `irisPath`, and copy the field's code and
   its label **exactly as IRIS prints them**, then set `verified:true` and put
   the exact source in `source` (IRIS screen or FBR return form SRO …), the date in `checkedOn`, and your name in `checkedBy`. `npm run iris` regenerates the
   worksheet in docs/, and `npm run iris:check` fails if the two disagree.

   `irisPath` is a pointer written from the structure of the return, to tell you
   where to look. It is not itself a verified fact, and nothing in the app shows
   it to a customer as one.
   ────────────────────────────────────────────────────────────────────────── */

/** Bumped whenever a code changes, so a Filing Pack can say which map produced
    it. The `.draft` suffix is removed only when every required field is
    verified — `irisStatus()` is what decides that, not a human editing this. */
export const IRIS_MAP_VERSION='IRIS-TY2026-TY2027.provenance-v2.draft';

export type IrisForm=
 |'Return of Income — individual'      // s.114
 |'Final / fixed tax schedule'         // s.154A, s.154B receipts
 |'Adjustable tax / tax already paid'  // credits for tax collected
 |'Wealth statement'                   // s.116
 |'Registration / profile';            // NTN, filer status, business profile

export type IrisField={
 taxYear:number;
 source:string;
 checkedOn:string;
 checkedBy:string;
 /** Hisaab's own stable key. Never changes, even if IRIS renumbers. */
 id:string;
 /** What Hisaab calls this figure, in the words the app uses. */
 label:string;
 /** Which value from estimate(), so the pack can resolve it without guessing.
     'declaration' means it is a profile fact, not a computed amount. */
 figure:string;
 form:IrisForm;
 /** Where to look in IRIS. A pointer to verify, not a verified fact. */
 irisPath:string;
 /** The label IRIS prints. Transcribe exactly, including its odd capitalisation. */
 irisLabel:string;
 /** The numeric field code IRIS shows. Transcribe. Never derive or guess. */
 code:string;
 /** Section references. These are checked; see docs/TAX-RULES.md. */
 law:string;
 /** Tax years this entry is known to apply to. */
 years:number[];
 /** True only once a person transcribed `code` and `irisLabel` from a real
     return. Nothing in the app treats an unverified entry as authoritative. */
 verified:boolean;
 /** Initials and date of whoever transcribed it, so the claim has an owner. */
 transcribedBy:string;
 /** A figure the return cannot be completed without. An optional one may be
     left unverified without blocking the map as a whole. */
 required:boolean;
 note:string;
};

type IrisTemplate=Omit<IrisField,'taxYear'>;
const F=(f:Omit<IrisTemplate,'irisLabel'|'code'|'verified'|'transcribedBy'|'source'|'checkedOn'|'checkedBy'>):IrisTemplate=>
 ({...f,irisLabel:'',code:'',verified:false,transcribedBy:'',source:'',checkedOn:'',checkedBy:''});

const IRIS_TEMPLATES:IrisTemplate[]=[

 /* ── What the export regime needs (s.154A) ───────────────────────────────
    The largest group, because it is what most of Hisaab's customers earn. The
    receipts are taxed at source by the authorized dealer and the return
    declares them under the final/fixed regime rather than as business income. */

 F({id:'it-export-base',label:'IT / ITeS export tax base',figure:'itBase',
  form:'Final / fixed tax schedule',
  irisPath:'Return of Income → the fixed/final tax schedule, the row for export of IT and IT-enabled services under s.154A',
  law:'s.154A; First Schedule; TY2027 rate card p.9 — 0.25% where PSEB-registered',
  years:[2026,2027],required:true,
  note:'The gross amount realised through an authorized dealer, in PKR, before the dealer deducted tax. Hisaab holds this per receipt as taxBase and will not infer it from a net credit.'}),

 F({id:'service-export-base',label:'Other export services tax base',figure:'serviceBase',
  form:'Final / fixed tax schedule',
  irisPath:'Return of Income → the fixed/final tax schedule, the row for export of services other than IT / ITeS under s.154A',
  law:'s.154A; TY2027 rate card p.9 — 1% in other cases',
  years:[2026,2027],required:true,
  note:'Separate row from IT/ITeS because the rate differs. Whether a service is IT/ITeS is a classification question, not something Hisaab decides.'}),

 F({id:'export-tax',label:'Tax on export receipts',figure:'exportTax',
  form:'Final / fixed tax schedule',
  irisPath:'Return of Income → the fixed/final tax schedule, the computed tax column against the s.154A rows',
  law:'s.154A read with s.168–169 (final tax)',
  years:[2026,2027],required:true,
  note:'IRIS normally computes this from the base and does not accept it typed. Transcribe the code so the pack can be checked against what IRIS worked out.'}),

 F({id:'export-withheld',label:'Tax already collected by your bank',figure:'paidExport',
  form:'Adjustable tax / tax already paid',
  irisPath:'Return of Income → the tax-already-paid or adjustable-tax annexure, the row for tax collected on export proceeds under s.154A',
  law:'s.154A; s.168',
  years:[2026,2027],required:true,
  note:'Taken from the bank credit advice or the PRC, not from the invoice. A mismatch between this and the schedule above is the single most common reason a return is queried.'}),

 /* ── Domestic business income ────────────────────────────────────────────
    The normal-tax side. Hisaab models a simple cash-basis individual business
    and says so; anything else is flagged for a practitioner rather than filed. */

 F({id:'domestic-turnover',label:'Domestic receipts',figure:'localBase',
  form:'Return of Income — individual',
  irisPath:'Return of Income → business income statement → gross revenue / turnover',
  law:'s.18 (income from business)',
  years:[2026,2027],required:true,
  note:'Pakistani-client revenue. Export receipts are not included here; they sit under the final regime above.'}),

 F({id:'business-expenses',label:'Deductible expenses',figure:'expenseDeduction',
  form:'Return of Income — individual',
  irisPath:'Return of Income → business income statement → total expenses / deductions',
  law:'s.20–21 (deductions and their limits); s.32–34 (method and apportionment)',
  years:[2026,2027],required:true,
  note:'Hisaab applies the business-use percentage per expense. Apportionment between export and domestic activity is a judgement it flags rather than makes.'}),

 F({id:'business-profit',label:'Business profit',figure:'profit',
  form:'Return of Income — individual',
  irisPath:'Return of Income → business income statement → net profit, carried to the computation',
  law:'s.18; s.9 (taxable income)',
  years:[2026,2027],required:true,
  note:'Turnover less fees less deductible expenses, floored at zero. Hisaab does not carry a loss forward and says so in its own note.'}),

 F({id:'business-tax',label:'Tax on business profit',figure:'business.base',
  form:'Return of Income — individual',
  irisPath:'Return of Income → computation of tax → normal tax on taxable income',
  law:'First Schedule Part I Division I — non-salaried individual slab rates',
  years:[2026,2027],required:true,
  note:'IRIS computes this. Transcribe the code so the pack can be reconciled against it.'}),

 F({id:'business-surcharge',label:'Surcharge above PKR 10 million',figure:'business.surcharge',
  form:'Return of Income — individual',
  irisPath:'Return of Income → computation of tax → the surcharge line, shown only once taxable income exceeds the threshold',
  law:'s.4AB — 10% surcharge on the tax payable by certain individuals and AOPs',
  years:[2026,2027],required:false,
  note:'Only appears above the threshold, so it may be absent from a return you open to transcribe from. Leave unverified rather than guessing; it is marked optional for that reason.'}),

 F({id:'domestic-withheld',label:'Other tax already deducted',figure:'paidLocal',
  form:'Adjustable tax / tax already paid',
  irisPath:'Return of Income → the adjustable-tax annexure, the rows for tax deducted by your Pakistani clients',
  law:'s.153 (payments for services); s.168 (credit for tax collected)',
  years:[2026,2027],required:true,
  note:'Which s.153 row applies depends on how the client classified the payment. Hisaab records the amount and leaves the row to the filer.'}),

 /* ── Flagged, not filed ──────────────────────────────────────────────────
    Hisaab refuses to produce a figure for these; the entries exist so the pack
    can point at the right part of the return and say "this needs a person". */

 F({id:'social-media-base',label:'Social media and digital platform receipts',figure:'specialBase',
  form:'Final / fixed tax schedule',
  irisPath:'Return of Income → the fixed/final tax schedule, the s.154B row for payments through social media and digital platforms',
  law:'s.154B (TY2027) — 5% ATL / 10% non-ATL',
  years:[2027],required:false,
  note:'Hisaab does not treat this as automatically final and refuses to compute a liability for it. The entry exists so the pack can name the row and say a practitioner must decide.'}),

 F({id:'wealth-statement',label:'Wealth statement',figure:'declaration',
  form:'Wealth statement',
  irisPath:'IRIS → Declaration → the wealth statement filed with the return of income',
  law:'s.116 — wealth statement; s.116 reconciliation of assets',
  years:[2026,2027],required:true,
  note:'Hisaab produces no part of this. It holds income records, not assets, and the reconciliation needs everything a person owns. Named here so the pack can say plainly that the return is not complete without it.'}),

 /* ── Registration facts, which decide the rate ───────────────────────────── */

 F({id:'pseb-registration',label:'PSEB IT / ITeS registration',figure:'declaration',
  form:'Registration / profile',
  irisPath:'Not in IRIS — PSEB maintains its own register at pseb.org.pk; the certificate is evidence kept with your records',
  law:'TY2027 rate card p.9 — the 0.25% rate applies where registered with PSEB',
  years:[2026,2027],required:true,
  note:'This is the single largest swing in the product: 0.25% against 1% on the same base. Hisaab records it as a declaration and verifies nothing. Do not add a code here; there is no IRIS field.'}),

 F({id:'filer-status',label:'Active Taxpayer List status',figure:'declaration',
  form:'Registration / profile',
  irisPath:'Not a return field — ATL status follows from having filed; check the published Active Taxpayer List',
  law:'Tenth Schedule — higher rates for persons not appearing on the ATL',
  years:[2026,2027],required:false,
  note:'Affects withholding rates your clients and bank apply, not a box you fill in. Here so the pack can explain why a deducted amount differed from the headline rate.'}),

 F({id:'return-filed',label:'Return of income filed',figure:'declaration',
  form:'Return of Income — individual',
  irisPath:'IRIS → Declaration → Income Tax Return, for the tax year being filed',
  law:'s.114 — persons required to furnish a return; s.154A final-tax conditions',
  years:[2026,2027],required:true,
  note:'Filing the return is itself one of the conditions for s.154A final-tax treatment, which is why Hisaab asks the filer to confirm it rather than assuming it.'}),
];

export const IRIS_FIELDS:IrisField[]=IRIS_TEMPLATES.flatMap(f=>f.years.map(taxYear=>({...f,taxYear})));

export function isVerifiedIrisField(f:IrisField){
 const validDate=/^\d{4}-\d{2}-\d{2}$/.test(f.checkedOn)&&Number.isFinite(Date.parse(f.checkedOn))&&new Date(f.checkedOn).toISOString().slice(0,10)===f.checkedOn;
 return f.verified&&!!f.code.trim()&&!!f.label.trim()&&!!f.irisLabel.trim()&&!!f.irisPath.trim()&&
  (f.source==='IRIS screen'||/^FBR return form SRO \S/.test(f.source))&&validDate&&!!f.checkedBy.trim();
}
export function validateIrisMap(fields:IrisField[]=IRIS_FIELDS){
 for(const f of fields)if(f.verified&&!isVerifiedIrisField(f))throw Error(`TY${f.taxYear} ${f.id}: verified IRIS entries require code, label, source, checkedOn and checkedBy.`);
}

/* ── What the app may and may not say about this map ──────────────────────── */

export const irisField=(id:string,year=2027)=>IRIS_FIELDS.find(f=>f.id===id&&f.taxYear===year)??null;

export const irisFieldsFor=(year:number)=>IRIS_FIELDS.filter(f=>f.taxYear===year);

/** The honest state of the map. `ready` is false while any required field is
    unverified, and the app uses that to decide whether it may present itself as
    an IRIS navigation aid at all. Nothing here can be overridden by a flag. */
export function irisStatus(year?:number){
 const fields=year?irisFieldsFor(year):IRIS_FIELDS;
 const required=fields.filter(f=>f.required);
 const verified=fields.filter(isVerifiedIrisField);
 const missing=required.filter(f=>!isVerifiedIrisField(f));
 return {
  total:fields.length,
  verified:verified.length,
  required:required.length,
  missing:missing.map(f=>f.id),
  ready:missing.length===0,
  version:IRIS_MAP_VERSION
 };
}

export type IrisDestination=
 |{known:true;code:string;irisLabel:string;form:IrisForm;law:string;path:string}
 |{known:false;form:IrisForm;law:string;path:string;why:string};

/** The only way the rest of the app is allowed to ask where a figure goes.

    An unverified field returns `known:false` with a pointer and a reason, never
    a code. That is what stops a half-filled map being rendered as though it
    were finished — the type makes the caller handle both cases. */
export function irisDestination(id:string,year=2027,fields=IRIS_FIELDS):IrisDestination|null{
 const f=fields.find(f=>f.id===id&&f.taxYear===year);
 if(!f)return null;
 if(isVerifiedIrisField(f))
  return {known:true,code:f.code,irisLabel:f.irisLabel,form:f.form,law:f.law,path:f.irisPath};
 return {known:false,form:f.form,law:f.law,path:'',
  why:"I don't have the verified IRIS code for this yet. It has not been transcribed with complete source evidence."};
}

/** One line for the Filing Pack, phrased for whoever is reading it. */
export function irisGuidance(id:string,year=2027){
 const d=irisDestination(id,year);
 if(!d)return '';
 return d.known
  ?`IRIS: ${d.form} — field ${d.code} “${d.irisLabel}” (${d.law})`
  :`IRIS field code not yet confirmed. I don’t have the verified IRIS code for this yet.`;
}

/** A sentence the pack and the UI must both carry while the map is a draft, so
    nobody mistakes a pointer for a filing instruction. */
export const IRIS_DRAFT_WARNING=
 "I don't have the verified IRIS code for this yet. The exact field codes have not been transcribed with verified provenance. Use this worksheet for review, not as a filing instruction; check the tax-year-specific screen in IRIS with your practitioner.";

export function userIrisCode(code:string,label:string){
 if(!code.trim()||!label.trim())throw Error('Tell me both the code and label.');
 return {code:code.trim(),label:label.trim(),verified:false as const,source:'From you, not verified' as const};
}
