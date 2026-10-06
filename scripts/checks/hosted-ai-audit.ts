import 'dotenv/config';
import {randomUUID,createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {RedisAuditStore} from '../../server/aiAudit';
const base=process.argv[2];
if(!base||new URL(base).protocol!=='https:')throw Error('Supply the deployed HTTPS URL');
const report:{url:string;at:string;checks:unknown[];error?:string}={url:base,at:new Date().toISOString(),checks:[]};
try{
 const configResponse=await fetch(base+'/api/config',{signal:AbortSignal.timeout(30000)});
 if(!configResponse.ok)throw Error('hosted_configuration_unavailable');
 const config=await configResponse.json();
 if(!config.audit?.enabled||config.audit.backend!=='redis'||!config.audit.configured)throw Error('hosted_redis_audit_not_configured');
 report.checks.push({stage:'hosted_config',audit:config.audit});
 const url=process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL;
 const token=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
 if(!url||!token)throw Error('redis_verification_credentials_missing');
 const store=new RedisAuditStore(url,token);
 for(const language of ['ar','en']){
  const sessionId=`audit-hosted-probe-${randomUUID()}`;
  const response=await fetch(base+'/api/conversation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,language,turns:[{id:randomUUID(),role:'user',text:language==='ar'?'اختبار آلي لسجل الجودة: اسأل سؤالًا قصيرًا عن الإنصات باحترام.':'Synthetic quality-log verification: ask one short question about respectful listening.',at:Date.now(),delivery:'text'}]}),signal:AbortSignal.timeout(60000)});
  const output=await response.json();
  if(!response.ok)throw Error(['ai_audit_unavailable','model_auth_failed','model_rate_limited'].includes(output.error)?output.error:'hosted_conversation_failed');
  const record=(await store.list(100)).find(r=>(r.context as any).sessionId===sessionId);
  if(!record||record.status!=='completed'||record.output!==output.text||record.calls.length!==1||(record.context as any).requestId!==response.headers.get('x-request-id'))throw Error('hosted_response_not_verified_in_redis');
  report.checks.push({stage:'live_response_saved_in_redis',language,httpStatus:response.status,recordId:record.id,sessionId,requestLinked:true,outputMatches:true,responseSha256:createHash('sha256').update(output.text).digest('hex')});
 }
}catch(e){report.error=e instanceof Error&&/^[a-z_]+$/.test(e.message)?e.message:'hosted_verification_failed';process.exitCode=1;}
await mkdir('artifacts/reports',{recursive:true});await writeFile('artifacts/reports/hosted-ai-audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
