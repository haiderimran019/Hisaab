/* Guided routing only. No statement text, document content or model output is
   passed to this function. Conversations are bounded workspace metadata. */
import {z} from 'zod';
import {helpTerms} from './assistant-contract';
export const messageSchema=z.object({id:z.string().uuid(),role:z.enum(['user','assistant']),section:z.enum(['Income','Expenses','Invoices','Statements','Tax','Filing Pack']).optional(),helpTerm:z.enum(helpTerms).optional(),file:z.object({name:z.string().max(160),format:z.enum(['pdf','xlsx','csv','json']),snapshot:z.string().max(2000000)}).strict().optional(),record:z.object({table:z.enum(['receipts','expenses','invoices']),before:z.string().max(2800000).nullable(),after:z.string().max(2800000)}).strict().optional(),text:z.string().max(2000),kind:z.enum(['text','summary','clients','sources','spending','cashflow','problems','readiness','all','records','savings','proposal']).default('text'),month:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),year:z.number().int().min(2026).max(2027),sourceIds:z.array(z.string().uuid()).max(14040).default([]),decision:z.enum(['pending','confirmed','rejected','undone']).default('pending'),language:z.enum(['en','roman','ur']).default('en')}).strict();
export const memoryItemSchema=z.object({id:z.string().uuid(),key:z.enum(['age-band','work','preferred-language','province']),value:z.string().min(1).max(160),source:z.literal('You told me'),givenOn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),verified:z.literal(false)}).strict();
export const threadSchema=z.object({id:z.string().uuid(),title:z.string().max(80),savedOn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),messages:z.array(messageSchema).max(120)}).strict();
export const conversationSchema=z.object({messages:z.array(messageSchema).max(120),irisMemory:z.array(z.object({id:z.string().uuid(),taxYear:z.number().int().min(2026).max(2027),code:z.string().trim().min(1).max(80),label:z.string().trim().min(1).max(300),path:z.string().trim().max(300),source:z.literal('From you, not verified'),givenOn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).strict()).max(100).default([]),activity:z.array(z.object({id:z.string().uuid(),proposalId:z.string().uuid(),recordId:z.string().uuid(),decision:z.enum(['proposed','confirmed','rejected','undone']),on:z.string().datetime()})).max(2000).default([]),memory:z.array(memoryItemSchema).max(40).default([]),threads:z.array(threadSchema).max(200).default([]),activeId:z.union([z.literal(''),z.string().uuid()]).default(''),packNotes:z.record(z.string().regex(/^202[67]$/),z.string().max(1000)).default({})}).strict();
export type ChatMessage=z.infer<typeof messageSchema>;
export type AnalysisIntent=ChatMessage['kind'];
export function languageOf(text:string):ChatMessage['language']{return /[\u0600-\u06ff]/u.test(text)?'ur':/\b(mahine|mahina|kya|kahan|paisa|pese|paison|kitna|aaye|aayi|bana|kharch|mera|meri|mere|dikhao|mein|ki|ka|se|hua|hai|banega)\b/i.test(text)?'roman':'en';}
export function analysisIntent(text:string):AnalysisIntent{
 const t=text.toLowerCase().trim();
 if(/(which client|client pays|clients|kis client|کلائنٹ)/.test(t))return 'clients';
 if(/(income by source|source|payment route|آمدنی کے ذرائع)/.test(t))return 'sources';
 if(/(cash\s?flow|balance trend|account balance|بیلنس)/.test(t))return 'cashflow';
 if(/(tax|owe|readiness|filing ready|pack.*missing|تیاری|ٹیکس)/.test(t))return 'readiness';
 if(/(problem|duplicate|unclassified|unmatched|attention|مسئل)/.test(t))return 'problems';
 if(/(spend|money go|losing money|kharch|paisa kahan|خرچ)/.test(t))return 'spending';
 if(/(this month|is mahine|is mahina|monthly summary|reached you|اس ماہ|اس مہینے)/.test(t))return 'summary';
 if(/(analy[sz]e|analysis|statements|تجزیہ)/.test(t))return 'all';
 return 'text';
}
export const reply=(lang:ChatMessage['language'],en:string,roman:string,ur:string)=>lang==='ur'?ur:lang==='roman'?roman:en;
