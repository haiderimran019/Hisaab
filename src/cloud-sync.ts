import {parseEnvelope,type EnvelopeV2} from './vault';
export function cloudEnvelope(raw:string):EnvelopeV2{
 const envelope=parseEnvelope(raw);if(envelope.format!=='hisaab-aesgcm-v2')throw Error('Unlock and save this workspace before syncing.');
 return {...envelope,unlockers:envelope.unlockers.filter(u=>u.kind==='passphrase')};
}
export const cloudConflict=(localRevision:number,remoteRevision:number)=>localRevision!==remoteRevision;
export function safeRemoteEnvelope(value:unknown):string{return JSON.stringify(cloudEnvelope(JSON.stringify(value)));}
export async function envelopeIdentity(raw:string){const e=cloudEnvelope(raw);const u=e.unlockers.find(u=>u.kind==='passphrase')!;const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(u)));return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');}
