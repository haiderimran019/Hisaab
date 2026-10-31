/* Local prototype only: the model selects an allowlisted view/definition.
   No model prose, arithmetic, record writes or credentials cross this boundary. */
import {assistantRouteSchema,localChatInputSchema,MODEL_ID,ROUTER_POLICY} from '../src/assistant-contract.ts';
export async function routeWithModel(input:unknown,fetchImpl:typeof fetch=fetch,signal?:AbortSignal){
 const parsed=localChatInputSchema.parse(input);
 const response=await fetchImpl('http://127.0.0.1:11434/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal,body:JSON.stringify({model:MODEL_ID,stream:false,think:false,keep_alive:'2m',format:{type:'object',properties:{intent:{type:'string',enum:assistantRouteSchema.shape.intent.options},term:{type:'string',enum:assistantRouteSchema.shape.term.options}},required:['intent','term'],additionalProperties:false},messages:[{role:'system',content:ROUTER_POLICY},...parsed.history,{role:'user',content:parsed.message}],options:{temperature:0,num_ctx:4096,num_predict:160}})});
 if(!response.ok)throw Error('Local assistant unavailable');
 const raw=await response.text();if(raw.length>64000)throw Error('Local assistant response too large');
 const data=JSON.parse(raw),content=data?.message?.content;if(typeof content!=='string'||content.length>2000)throw Error('Invalid local assistant reply');
 return assistantRouteSchema.parse(JSON.parse(content));
}
