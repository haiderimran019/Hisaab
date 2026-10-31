import test from 'node:test';
import assert from 'node:assert/strict';
import {analysisIntent,languageOf,conversationSchema} from '../src/conversation.ts';
import {blankWorkspace,parseWorkspace} from '../src/core.ts';
import {createVault,unlock} from '../src/vault.ts';
import {analysisView} from '../src/ui-analysis.ts';
import {demo} from '../src/demo.ts';

test('analysis utterances route locally in English, Roman Urdu and Urdu',()=>{
 for(const [text,kind] of [['analyze my statements','all'],['is mahine kya hua?','summary'],['where does my money go?','spending'],['which client pays most?','clients'],['اس مہینے کیا ہوا؟','summary'],['آمدنی کے ذرائع','sources']])assert.equal(analysisIntent(text),kind);
 assert.equal(languageOf('is mahine kya hua?'),'roman');assert.equal(languageOf('اس مہینے کیا ہوا؟'),'ur');
 assert.equal(analysisIntent('write a poem'),'text');
});
test('old v3 workspaces gain empty conversation metadata without losing records',()=>{
 const w=demo(),old=JSON.parse(JSON.stringify(w));delete old.conversation;
 const opened=parseWorkspace(old);assert.deepEqual(opened.receipts,w.receipts);assert.deepEqual(opened.conversation,{messages:[],packNotes:{},threads:[],activeId:'',memory:[],activity:[],irisMemory:[]});
});
test('conversations and proposal decisions round-trip only inside the existing encrypted vault',async()=>{
 const w=blankWorkspace(),secret='Private conversation text';
 w.conversation.messages.push({id:crypto.randomUUID(),role:'assistant',text:secret,kind:'proposal',month:'2026-10',year:2027,sourceIds:[],decision:'rejected',language:'en'});
 w.conversation.packNotes['2027']='An accountant-only note';
 const {envelope}=await createVault(w,'test-only correct horse battery staple'),serialized=JSON.stringify(envelope);
 assert.ok(!serialized.includes(secret));assert.ok(!serialized.includes('accountant-only'));
 const opened=await unlock(serialized,'test-only correct horse battery staple');assert.deepEqual(opened.workspace.conversation,w.conversation);
});
test('conversation metadata rejects excessive histories and arbitrary action payloads',()=>{
 assert.equal(conversationSchema.safeParse({messages:[],code:'execute this'}).success,false);
 const message={id:crypto.randomUUID(),role:'user',text:'hi',kind:'text',month:'2026-10',year:2027,sourceIds:[],decision:'pending',language:'en'};
 assert.equal(conversationSchema.safeParse({messages:Array.from({length:121},()=>message)}).success,false);
});
test('analysis treats imported names as escaped data, never executable markup',()=>{
 const w=demo();w.receipts[0].client='<img src=x onerror=alert(1)>';
 const html=analysisView(w,{id:crypto.randomUUID(),role:'assistant',text:'',kind:'clients',month:'2026-10',year:2027,sourceIds:[],decision:'pending',language:'en'});
 assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));assert.ok(html.includes('data-source-id'));
});
