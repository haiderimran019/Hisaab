import { z } from 'zod';
import { workspaceSchema, type Workspace } from './core';
export const VAULT_KEY='hisaab.encrypted.v1';
export const MAX_BACKUP=8_000_000;
const envelopeSchema=z.object({format:z.literal('hisaab-aesgcm-v1'),iterations:z.literal(600000),salt:z.string().length(24),iv:z.string().length(16),ciphertext:z.string().min(20).max(7500000)}).strict();
export type Envelope=z.infer<typeof envelopeSchema>;
const b64=(b:Uint8Array)=>{let s='';for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode(...b.subarray(i,i+8192));return btoa(s);};
const un64=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export async function derive(passphrase:string,salt:Uint8Array){if(passphrase.length<12||passphrase.length>256)throw Error('Use a passphrase of 12–256 characters');const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(passphrase),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:salt as BufferSource,iterations:600000},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
export async function seal(w:Workspace,key:CryptoKey,salt:Uint8Array):Promise<Envelope>{workspaceSchema.parse(w);const plaintext=new TextEncoder().encode(JSON.stringify(w));if(plaintext.length>3_000_000)throw Error('Workspace exceeds 3 MB. Export a backup and remove large receipt attachments.');const iv=crypto.getRandomValues(new Uint8Array(12));const result=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plaintext);return {format:'hisaab-aesgcm-v1',iterations:600000,salt:b64(salt),iv:b64(iv),ciphertext:b64(new Uint8Array(result))};}
export function parseEnvelope(raw:string){if(raw.length>MAX_BACKUP)throw Error('Backup is too large');const e=envelopeSchema.parse(JSON.parse(raw));if(un64(e.salt).length!==16||un64(e.iv).length!==12)throw Error('Invalid backup parameters');un64(e.ciphertext);return e;}
export async function unlock(raw:string,passphrase:string){const e=parseEnvelope(raw),salt=un64(e.salt),key=await derive(passphrase,salt);let plain:ArrayBuffer;try{plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(e.iv)},key,un64(e.ciphertext));}catch{throw Error('Incorrect passphrase or damaged backup. Try again.');}const workspace=workspaceSchema.parse(JSON.parse(new TextDecoder().decode(plain)));return {workspace,key,salt};}
