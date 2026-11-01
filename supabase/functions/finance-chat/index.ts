import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {FINANCE_POLICY,checkedAnswer} from './policy.ts';
const origin='https://haiderimran019.github.io';
const cors={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, GET, OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async req=>{
 if(req.headers.get('origin')&&req.headers.get('origin')!==origin)return reply(403,{error:'Origin not allowed'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 const key=Deno.env.get('AI_API_KEY'),model='xingchen-agi/xing4.0-29b-a4b:free';
 if(req.method==='GET')return reply(200,{available:!!key&&model.endsWith(':free'),provider:'OpenRouter → Phala',model,limit:'20 requests per signed-in user per hour; provider quotas also apply'});
 if(req.method!=='POST'||!req.headers.get('content-type')?.startsWith('application/json'))return reply(400,{error:'JSON required'});
 const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];if(!token)return reply(401,{error:'Sign in required'});
 const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false}});
 const {data:{user},error}=await client.auth.getUser(token);if(error||!user||user.is_anonymous)return reply(401,{error:'Sign in required'});
 if(!key||!model.endsWith(':free'))return reply(503,{error:'Hosted AI is not configured yet. Guided finance tools are available.'});
 try{
  const raw=await req.text();if(raw.length>10000)return reply(413,{error:'Message too long'});const data=JSON.parse(raw);
  if(typeof data.message!=='string'||!data.message.trim()||data.message.length>2000||data.consent!==true||!Array.isArray(data.history)||data.history.length>6)return reply(400,{error:'Review the privacy preview before sending'});
  if(typeof data.company_id!=='string'||!/^[0-9a-f-]{36}$/i.test(data.company_id))return reply(400,{error:'Choose a company first'});
  const scoped=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false},global:{headers:{Authorization:'Bearer '+token}}});
  const {data:company,error:companyError}=await scoped.from('companies').select('id').eq('id',data.company_id).maybeSingle();if(companyError||!company)return reply(403,{error:'Company membership required'});
  const history=data.history.map((m:{role:string;content:string})=>{if(!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>600)throw Error('Invalid history');return {role:m.role,content:m.content};});
  if(/\bIRIS\b|\bFBR\b|\bPSEB\b|154A|tax (?:rate|code|owe|due)|ٹیکس.*(?:کوڈ|شرح)/i.test(data.message))return reply(200,{in_scope:true,checked_tax:true,reply:'Please use Hisaab’s checked tax estimate and verified rule register for this question.'});
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const {data:allowed,error:quotaError}=await admin.rpc('consume_ai_quota',{account_id:user.id,company:data.company_id});if(quotaError||!allowed)return reply(429,{error:'Your hourly AI limit is reached. Guided finance tools still work.'});
  const upstream=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','HTTP-Referer':origin+'/Hisaab/','X-Title':'Hisaab'},body:JSON.stringify({model,messages:[{role:'system',content:FINANCE_POLICY},...history,{role:'user',content:data.message}],temperature:0.3,max_tokens:500,stream:false,response_format:{type:'json_object'},reasoning:{enabled:false,exclude:true},provider:{only:['Phala'],allow_fallbacks:false,data_collection:'deny',zdr:true,max_price:{prompt:0,completion:0}}}),signal:AbortSignal.timeout(25000)});
  if(!upstream.ok){let message='';try{const problem=(await upstream.json()).error;message=(String(problem?.message||'')+' '+String(problem?.metadata?.raw||'')).toLowerCase();}catch{}const reasonTags=['credit','budget','free-models-per-day','free-models-per-min','rate limit','rate_limit','quota','exceed','upstream','provider','insufficient','limit: 0','busy','capacity','data collection','policy'].filter(tag=>message.includes(tag));return reply(503,{error:'The free AI provider is unavailable or its quota is reached. Guided tools remain available.',providerStatus:upstream.status,reasonTags});}
  const response=await upstream.text();if(response.length>32000)throw Error('Oversized response');const value=JSON.parse(response);return reply(200,checkedAnswer(value.choices?.[0]?.message?.content||''));
 }catch{return reply(503,{error:'I could not verify that answer. Try a shorter finance question or use the checked tools.'});}
});
