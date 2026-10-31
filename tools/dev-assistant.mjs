/* Start the free local prototype. No tunnel, public listener or model download. */
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),children=[];
const start=(cmd,args,env=process.env)=>{const child=spawn(cmd,args,{cwd:root,env,stdio:'inherit'});children.push(child);child.on('error',()=>{process.stderr.write(`Could not start ${cmd}. Install Ollama and run the documented model pull first.\n`);cleanup();process.exitCode=1;});return child;};
const cleanup=()=>{for(const child of children)child.kill('SIGTERM');};
process.on('SIGINT',()=>{cleanup();process.exit();});process.on('SIGTERM',()=>{cleanup();process.exit();});
let running=false;try{const result=await fetch('http://127.0.0.1:11434/api/version',{signal:AbortSignal.timeout(1500)});running=result.ok;}catch{}
if(!running)start('ollama',['serve'],{...process.env,OLLAMA_HOST:'127.0.0.1:11434',OLLAMA_NO_CLOUD:'1',...(process.env.OLLAMA_MODELS?{OLLAMA_MODELS:process.env.OLLAMA_MODELS}:{})});
start(process.execPath,['--import','tsx','local-server/index.ts']);start('npm',['run','dev','--','--port','5174','--strictPort']);
