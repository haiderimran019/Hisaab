/* Filing dates, and the care they need.

   docs/TAX-RULES.md says: "No official filing deadline is assumed because
   extensions change." That decision was right and it still holds — **no date
   here enters any tax figure.** What it was wrong about was the customer's
   question, which is not "what does the law compute" but "how long have I got".

   So this file states the statutory dates, labels them statutory, and says in
   the same breath that FBR extends the return date most years and that Hisaab
   does not track extensions. A countdown to a date that may move is useful as
   long as it admits the date may move.

   Checked against FBR's own due-dates page (individuals and AOPs: on or before
   30 September) and FBR's tax calendar for the section 147 instalment dates.
   What is deliberately absent:

   - **The section 147 threshold.** Sources disagree — FBR's calendar ties the
     quarterly formula to a last-assessed income figure that other sources state
     differently. So the obligation is marked as one Hisaab does not evaluate,
     and no threshold number appears anywhere in this file.
   - **Penalty amounts.** Section 182 penalties and the ATL surcharge were only
     confirmable from unofficial sources whose own figures contradicted each
     other. A wrong penalty figure frightens people into bad decisions. */

export type Obligation={
 id:string;
 label:string;
 /** Month and day of the statutory date. Year is resolved against a tax year. */
 month:number;day:number;
 /** Which tax year's deadline this is, relative to the year ending 30 June. */
 offsetYears:number;
 law:string;
 /** True when every filer Hisaab serves has this obligation. False when it
     depends on something the app does not and will not evaluate. */
 universal:boolean;
 note:string;
};

/** The tax year ends 30 June. Everything else is dated from that. */
export const YEAR_END={month:6,day:30};

export const OBLIGATIONS:Obligation[]=[
 {id:'return',label:'Income tax return',month:9,day:30,offsetYears:0,
  law:'s.114 (who must file); s.118 (due date)',universal:true,
  note:'For an individual, on or before 30 September following the tax year end. FBR has extended this date in most recent years, sometimes more than once. Hisaab does not track extensions and you should not plan around one.'},

 {id:'wealth-statement',label:'Wealth statement',month:9,day:30,offsetYears:0,
  law:'s.116',universal:true,
  note:'Filed together with the return, so it shares its date. Hisaab produces no part of it — it holds your income records, not everything you own.'},

 {id:'advance-q1',label:'Advance tax — September quarter',month:9,day:15,offsetYears:-1,
  law:'s.147(5)',universal:false,
  note:'Only if you are liable to pay advance tax, which depends on your last assessed tax. Hisaab does not evaluate that and names no threshold, because published figures disagree. Ask your practitioner once, then you will know for years.'},
 {id:'advance-q2',label:'Advance tax — December quarter',month:12,day:15,offsetYears:-1,
  law:'s.147(5)',universal:false,note:'Same condition as the September instalment.'},
 {id:'advance-q3',label:'Advance tax — March quarter',month:3,day:15,offsetYears:0,
  law:'s.147(5)',universal:false,note:'Same condition as the September instalment.'},
 {id:'advance-q4',label:'Advance tax — June quarter',month:6,day:15,offsetYears:0,
  law:'s.147(5)',universal:false,note:'Same condition as the September instalment. Falls before the tax year ends, which catches people out.'},
];

const iso=(y:number,m:number,d:number)=>
 `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

/** The date an obligation falls on, for a given Pakistani tax year.
    A tax year is named for the calendar year it ends in: TY2027 runs
    1 July 2026 to 30 June 2027. */
export const dateFor=(o:Obligation,taxYear:number)=>iso(taxYear+o.offsetYears,o.month,o.day);

export type Upcoming={
 id:string;label:string;date:string;law:string;universal:boolean;note:string;
 /** Negative once the date has passed. */
 daysAway:number;
 state:'past'|'today'|'soon'|'ahead';
};

const DAY=86_400_000;

/** Everything for a tax year, in date order, with how far off each one is.
    `today` is passed in rather than read, so this is testable and so a device
    with a wrong clock produces a wrong countdown rather than a wrong figure. */
export function schedule(taxYear:number,today:string):Upcoming[]{
 const now=Date.parse(today+'T00:00:00Z');
 if(Number.isNaN(now))throw Error('Invalid date');
 return OBLIGATIONS
  .map(o=>{
   const date=dateFor(o,taxYear);
   const daysAway=Math.round((Date.parse(date+'T00:00:00Z')-now)/DAY);
   return {id:o.id,label:o.label,date,law:o.law,universal:o.universal,note:o.note,daysAway,
    state:(daysAway<0?'past':daysAway===0?'today':daysAway<=30?'soon':'ahead') as Upcoming['state']};
  })
  .sort((a,b)=>a.date.localeCompare(b.date));
}

/** The next thing actually due, for the one-line prompt on Home. Obligations
    that depend on something unevaluated are included but marked, because
    leaving them out would be its own kind of dishonesty. */
export function nextDue(taxYear:number,today:string){
 return schedule(taxYear,today).find(o=>o.daysAway>=0)??null;
}

/** Plain words for a countdown, without inventing urgency. */
export function countdown(o:Upcoming){
 if(o.daysAway<0)return `was due ${Math.abs(o.daysAway)} day${Math.abs(o.daysAway)===1?'':'s'} ago`;
 if(o.daysAway===0)return 'due today';
 if(o.daysAway===1)return 'due tomorrow';
 if(o.daysAway<=60)return `due in ${o.daysAway} days`;
 const months=Math.round(o.daysAway/30);
 return `due in about ${months} month${months===1?'':'s'}`;
}

/** Carried wherever a date is shown. The product's credibility rests on never
    letting a reference date read as a promise. */
export const DEADLINE_CAVEAT=
 'These are the statutory dates. FBR has extended the return date in most recent '
 +'years, and Hisaab does not track extensions — check IRIS or an FBR notification '
 +'before relying on one. No date here is used in any tax calculation.';
