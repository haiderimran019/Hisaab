import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyLocally} from '../src/local-assistant.ts';
import {routeWithModel} from '../local-server/route.ts';
import {MODEL_ID} from '../src/assistant-contract.ts';
import {answerTerm,detectTerm} from '../src/tax-help.ts';
import {archiveCurrent} from '../src/chat-history.ts';
import {demo} from '../src/demo.ts';
import {createVault,unlock} from '../src/vault.ts';

test('Never touch the network prevents local model requests as well',async()=>{
 let calls=0;const result=await classifyLocally('which client pays most?',{enabled:true,offlineOnly:true,fetchImpl:async()=>{calls++;throw Error();}});
 assert.equal(calls,0);assert.equal(result.engine,'guided');assert.equal(result.route.intent,'clients');
});
test('model routing has no write action or free-form arithmetic output',async()=>{
 const fetchImpl:typeof fetch=async()=>new Response(JSON.stringify({intent:'delete-record',term:'none',amount:500}));
 const result=await classifyLocally('which client pays most?',{enabled:true,offlineOnly:false,fetchImpl});assert.equal(result.engine,'guided');
});
test('gateway uses the selected free model and discards invented response fields',async()=>{
 let body:any;const fetchImpl:typeof fetch=async(_url,init)=>{body=JSON.parse(String(init?.body));return new Response(JSON.stringify({message:{content:JSON.stringify({intent:'clients',term:'none'})}}));};
 const result=await routeWithModel({message:'which customer contributes most?'},fetchImpl);
 assert.equal(result.intent,'clients');assert.equal(body.model,MODEL_ID);assert.equal(body.think,false);assert.equal(body.stream,false);
 await assert.rejects(()=>routeWithModel({message:'hi'},async()=>new Response(JSON.stringify({message:{content:'{"intent":"text","term":"iris","code":"invented"}'}}))));
});
test('IRIS help remains unverified regardless of what a model may know',()=>{
 assert.equal(detectTerm('IRIS ka code kya hai?'),'iris');assert.match(answerTerm('iris','en'),/don't have the verified IRIS code/);
 assert.ok(answerTerm('withholding','roman').includes('Withholding'));assert.ok(answerTerm('net','ur').includes('نیٹ'));
});
test('new chat preserves previous messages in the existing encrypted vault',async()=>{
 const w=demo(),message={id:crypto.randomUUID(),role:'user' as const,text:'My private finance question',kind:'text' as const,month:'2026-10',year:2027,sourceIds:[],decision:'pending' as const,language:'en' as const};
 w.conversation.threads=archiveCurrent([], [message],crypto.randomUUID(),'2026-10-31');
 const {envelope}=await createVault(w,'test-only correct horse battery staple');assert.ok(!JSON.stringify(envelope).includes(message.text));
 const reopened=await unlock(JSON.stringify(envelope),'test-only correct horse battery staple');assert.equal(reopened.workspace.conversation.threads[0].messages[0].text,message.text);
});

test('editable memory is encrypted and deletion removes it from the reopened workspace',async()=>{
 const w=demo();w.conversation.memory.push({id:crypto.randomUUID(),key:'work',value:'Designer',source:'You told me',givenOn:'2026-10-31',verified:false});
 const first=await createVault(w,'test-only another strong passphrase');assert.ok(!JSON.stringify(first.envelope).includes('Designer'));
 const reopened=await unlock(JSON.stringify(first.envelope),'test-only another strong passphrase');assert.equal(reopened.workspace.conversation.memory[0].value,'Designer');
 reopened.workspace.conversation.memory=[];const second=await createVault(reopened.workspace,'test-only another strong passphrase');
 assert.deepEqual((await unlock(JSON.stringify(second.envelope),'test-only another strong passphrase')).workspace.conversation.memory,[]);
});

test('user IRIS codes persist encrypted, remain unverified, and disappear after deletion',async()=>{
 const {rememberedIris}=await import('../src/user-iris-memory.ts');const w=demo();w.conversation.irisMemory.push({id:crypto.randomUUID(),taxYear:2027,code:'USER-TEST-ONLY',label:'User supplied test label',path:'User screen',source:'From you, not verified',givenOn:'2026-10-31'});
 const {envelope}=await createVault(w,'test-only iris code passphrase');assert.ok(!JSON.stringify(envelope).includes('USER-TEST-ONLY'));
 const opened=await unlock(JSON.stringify(envelope),'test-only iris code passphrase');assert.equal(rememberedIris(opened.workspace,2027)[0].source,'From you, not verified');assert.deepEqual(rememberedIris(opened.workspace,2026),[]);
 opened.workspace.conversation.irisMemory=[];const next=await createVault(opened.workspace,'test-only iris code passphrase');assert.deepEqual(rememberedIris((await unlock(JSON.stringify(next.envelope),'test-only iris code passphrase')).workspace,2027),[]);
});
