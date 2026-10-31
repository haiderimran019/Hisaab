import {assistantRouteSchema,type AssistantRoute} from './assistant-contract';
import {analysisIntent} from './conversation';
import {browserAiReady,routeInBrowser} from './browser-ai';
declare const __HISAAB_LOCAL_AI__:boolean;
export async function classifyLocally(message:string,options:{offlineOnly:boolean;signal?:AbortSignal;enabled?:boolean;history?:{role:'user'|'assistant';content:string}[];fetchImpl?:typeof fetch}):Promise<{route:AssistantRoute;engine:'qwen'|'guided'}>{
 const fallback={route:{intent:analysisIntent(message) as AssistantRoute['intent'],term:'none' as const},engine:'guided' as const};
 const enabled=options.enabled??(typeof __HISAAB_LOCAL_AI__!=='undefined'&&__HISAAB_LOCAL_AI__);
 if(options.signal?.aborted)return fallback;
 if(browserAiReady()){const route=await routeInBrowser(message,options.history??[],options.signal);return route?{route,engine:'qwen'}:fallback;}
 if(options.offlineOnly||!enabled)return fallback;
 try{const response=await (options.fetchImpl??fetch)('/hisaab-ai/route',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',signal:options.signal,body:JSON.stringify({message,history:options.history??[]})});if(!response.ok)return fallback;const raw=await response.text();if(raw.length>4000)return fallback;const data=JSON.parse(raw);const parsed=assistantRouteSchema.safeParse({intent:data.intent,term:data.term});if(!parsed.success)return fallback;return {route:parsed.data,engine:'qwen'};}catch{return fallback;}
}
