/* Read-only IRIS retrieval: checked catalogue entries + existing deterministic values. */
import {IRIS_FIELDS,isVerifiedIrisField,IRIS_MAP_VERSION,type IrisField} from './iris';
import {estimate,escapeHTML as h,SOURCES,type Workspace} from './core';
import {fmt,dateLabel} from './format';
export function verifiedIrisAnswers(w:Workspace,year:number,fields:IrisField[]=IRIS_FIELDS){
 const e=estimate(w,year),values:Record<string,number>={itBase:e.itBase,serviceBase:e.serviceBase,exportTax:e.exportTax,paidExport:e.paidExport,localBase:e.localBase,expenseDeduction:e.expenseDeduction,profit:e.profit,'business.base':e.business.base,'business.surcharge':e.business.surcharge,paidLocal:e.paidLocal};
 return fields.filter(f=>f.taxYear===year&&isVerifiedIrisField(f)).map(f=>({id:f.id,code:f.code,label:f.irisLabel,path:f.irisPath,source:f.source,checkedOn:f.checkedOn,checkedBy:f.checkedBy,law:f.law,value:values[f.figure]??null,taxYear:year,ruleVersion:e.ruleVersion,mapVersion:IRIS_MAP_VERSION,needsReview:e.liability===null}));
}
export function irisAnswerCards(w:Workspace,year:number){const answers=verifiedIrisAnswers(w,year);return answers.length?answers.map(a=>`<article class="analysis-card"><h3>${h(a.label)}</h3><p>TY ${year} · IRIS ${h(a.code)}</p><p>${h(a.path)}</p>${a.value===null?'':`<strong>${fmt(a.value)}</strong>`}<p class="note">${h(a.source)} · checked ${dateLabel(a.checkedOn)} by ${h(a.checkedBy)}<br>${h(a.law)} · ${h(a.ruleVersion)}<br>${a.needsReview?'Your tax scenario still needs review before entry.':'Verify against your return before entering.'}</p><a class="text-link" href="${h(SOURCES[0].url)}" target="_blank" rel="noopener noreferrer">FBR rule source</a></article>`).join(''):'';}
