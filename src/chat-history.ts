import {z} from 'zod';
import {messageSchema,threadSchema} from './conversation';
export type Thread=z.infer<typeof threadSchema>;
export function archiveCurrent(threads:Thread[],messages:z.infer<typeof messageSchema>[],id:string,date:string):Thread[]{
 if(!messages.length)return threads;
 if(threads.length>=200&&!threads.some(t=>t.id===id))throw Error('Chat history is full. Export a backup before removing older chats.');
 const thread={id:id||crypto.randomUUID(),title:(messages.find(m=>m.role==='user')?.text||'Conversation').slice(0,80),savedOn:date,messages:structuredClone(messages)};
 return [...threads.filter(t=>t.id!==thread.id),thread];
}
