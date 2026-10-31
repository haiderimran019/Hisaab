import {createServer} from 'node:http';
import {routeWithModel} from './route.ts';
import {MODEL_ID} from '../src/assistant-contract.ts';
const allowed=new Set(['http://127.0.0.1:5174','http://localhost:5174']);
let active=false;
const server=createServer(async(req,res)=>{
 const send=(status:number,value:unknown)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
 if(!['127.0.0.1:11435','localhost:11435'].includes(req.headers.host||''))return send(403,{error:'Local requests only'});
 if(req.headers.origin&&!allowed.has(req.headers.origin))return send(403,{error:'Origin denied'});
 if(req.method==='GET'&&req.url==='/health')return send(200,{model:MODEL_ID,localOnly:true});
 if(req.method!=='POST'||req.url!=='/route')return send(404,{error:'Not found'});
 if(req.headers['content-type']?.split(';')[0].trim().toLowerCase()!=='application/json')return send(415,{error:'JSON required'});
 if(active)return send(429,{error:'Assistant busy'});
 active=true;const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);
 res.on('close',()=>{if(!res.writableEnded)controller.abort();});
 try{let raw='';for await(const chunk of req){raw+=chunk.toString();if(Buffer.byteLength(raw)>32000){send(413,{error:'Message too large'});return;}}
  const route=await routeWithModel(JSON.parse(raw),fetch,controller.signal);if(!res.destroyed)send(200,{...route,model:MODEL_ID});
 }catch{if(!res.destroyed)send(503,{error:'Local assistant unavailable; use guided mode'});}finally{active=false;clearTimeout(timeout);}
});
server.listen(11435,'127.0.0.1',()=>process.stdout.write('Hisaab local assistant ready at 127.0.0.1:11435 (no public listener)\n'));
