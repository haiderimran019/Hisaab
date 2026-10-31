import Decimal from 'decimal.js';
export function parseSpokenAmount(text:string):string|null{
 const normalized=text.replace(/[۰-۹٠-٩]/g,c=>String(c.charCodeAt(0)-(c>='۰'?'۰':'٠').charCodeAt(0))).replace(/,/g,'');
 if(/[-−]\s*\d/.test(normalized))return null;
 const found=[...normalized.matchAll(/(?:Rs\.?\s*|PKR\s*|\$\s*)?(\d+(?:\.\d+)?)(?:\s*(crore|کروڑ|lakh|lac|لاکھ|k|ہزار))?(?![\w.])/gi)];
 if(found.length!==1)return null;
 const m=found[0],factor=/crore|کروڑ/i.test(m[2]||'')?10000000:/lakh|lac|لاکھ/i.test(m[2]||'')?100000:/k|ہزار/i.test(m[2]||'')?1000:1;
 const n=new Decimal(m[1]).mul(factor);return n.gt(0)&&n.lte('999999999999.99')&&n.decimalPlaces()<=2?n.toFixed(2):null;
}
export function recordIntent(text:string):'income'|'expense'|null{
 if(/got paid|record.*income|payment (?:aayi|ayi|received)|dollar (?:aaye|aye)|آمدنی|پیسے آئے|ڈالر آئے/i.test(text))return 'income';
 if(/(?:paid|spent|record|add).*expense|(?:bijli|internet|gas|electricity).*bill|kharch|خرچ|بجلی.*بل/i.test(text))return 'expense';return null;
}
export function chatPrefill(text:string){
 const amount=parseSpokenAmount(text),currency=/\$|USD|dollar|ڈالر/i.test(text)?'USD':/GBP|pounds/i.test(text)?'GBP':/EUR|euros/i.test(text)?'EUR':/AED|dirham/i.test(text)?'AED':'PKR';
 const source=['Upwork','Fiverr','Payoneer','Wise','JazzCash','Easypaisa','Raast'].find(s=>text.toLowerCase().includes(s.toLowerCase()));
 return {amount,currency,source,vendor:/bijli|electricity|بجلی/i.test(text)?'Electricity':/internet/i.test(text)?'Internet':''};
}
