/* The model sees only the current request and bounded recent chat, on device.
   No provider API, telemetry or user-data training endpoint exists here. */
import type {WebWorkerMLCEngine} from '@mlc-ai/web-llm';
import {assistantRouteSchema,ROUTER_POLICY,type AssistantRoute} from './assistant-contract';
export const BROWSER_MODEL='Qwen3-1.7B-q4f16_1-MLC';
let engine:WebWorkerMLCEngine|null=null,worker:Worker|null=null,generation=0;
export const browserAiReady=()=>!!engine;
export function stopBrowserAi(){generation++;engine?.interruptGenerate();worker?.terminate();engine=null;worker=null;}
export async function startBrowserAi(offlineOnly:boolean,onProgress:(text:string)=>void){
 if(offlineOnly)throw Error('Never touch the network is on. Model downloads are blocked.');
 if(!('gpu' in navigator))throw Error('This browser does not support WebGPU. Guided chat is ready to use.');
 stopBrowserAi();const token=generation;
 const {CreateWebWorkerMLCEngine}=await import('@mlc-ai/web-llm');
 if(token!==generation)return;
 const ownedWorker=new Worker(new URL('./browser-ai-worker.ts',import.meta.url),{type:'module'});worker=ownedWorker;
 try{const loaded=await CreateWebWorkerMLCEngine(ownedWorker,BROWSER_MODEL,{initProgressCallback:p=>{if(token===generation)onProgress(p.text);},logLevel:'ERROR'},{context_window_size:4096});
 if(token!==generation){ownedWorker.terminate();return;}engine=loaded;onProgress('Qwen3-1.7B is ready on this device.');
 }catch(error){if(worker===ownedWorker)stopBrowserAi();throw error;}
}
export async function routeInBrowser(message:string,history:{role:'user'|'assistant';content:string}[],signal?:AbortSignal):Promise<AssistantRoute|null>{
 const current=engine;if(!current||signal?.aborted)return null;
 const token=generation,interrupt=()=>current.interruptGenerate();signal?.addEventListener('abort',interrupt,{once:true});
 try{const result=await current.chat.completions.create({messages:[{role:'system',content:ROUTER_POLICY},...history.slice(-6).map(m=>({...m,content:m.content.slice(0,600)})),{role:'user',content:message.slice(0,2000)}],temperature:0,max_tokens:160,stream:false,extra_body:{enable_thinking:false},response_format:{type:'json_object'}});
 if(signal?.aborted||token!==generation)return null;
 const content=result.choices[0]?.message.content||'';if(content.length>2000)return null;
 const parsed=assistantRouteSchema.safeParse(JSON.parse(content));return parsed.success?parsed.data:null;
 }catch{return null;}finally{signal?.removeEventListener('abort',interrupt);if(token===generation)await current.resetChat().catch(()=>{});}
}
