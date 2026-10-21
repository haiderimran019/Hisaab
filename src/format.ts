/* Shared presentation helpers. PKR is the base currency everywhere. */
export const icon=(name:string,cls='')=>`<i data-lucide="${name}" class="${cls}" aria-hidden="true"></i>`;
export const fmt=(n:number,c='PKR')=>new Intl.NumberFormat('en-PK',{style:'currency',currency:c,maximumFractionDigits:2,minimumFractionDigits:0}).format(n);
export const num=(n:number)=>new Intl.NumberFormat('en-PK',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
export const dateLabel=(d:string)=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(d));
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const pkr=(n:number)=>fmt(n,'PKR');
