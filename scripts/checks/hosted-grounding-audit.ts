// Real production follow-ups and Redis audit verification. Synthetic text; no avatar.
import 'dotenv/config';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {RedisAuditStore} from '../../server/aiAudit';
const base=process.argv[2];if(!base||new URL(base).protocol!=='https:')throw Error('Supply deployed HTTPS URL');
const report:{url:string;checks:unknown[];error?:string}={url:base,checks:[]};
try{
 const url=process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL,token=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
 if(!url||!token)throw Error('redis_credentials_missing');
 const store=new RedisAuditStore(url,token);
 const bankResponse=await fetch(base+'/api/training/questions',{signal:AbortSignal.timeout(30000)});
 if(!bankResponse.ok)throw Error('catalog_unavailable');
 const q=(await bankResponse.json()).questions.find((q:any)=>q.evidence?.length);
 for(const language of ['ar','en']){
  const sessionId=`grounding-hosted-${randomUUID()}`;
  const response=await fetch(base+'/api/training/followup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,language,questionId:q.id,referenceVersion:q.referenceVersion,turns:[{id:'q',role:'assistant',text:q.question[language],pointIds:q.points.map((p:any)=>p.id)},{id:'a',role:'user',text:language==='ar'?'أفهم بعض الفكرة، لكنني لم أوضح مثال المؤلف بعد.':"I understand some of the idea but haven't explained the author's example yet.",pointIds:q.points.map((p:any)=>p.id)}]}),signal:AbortSignal.timeout(60000)});
  const output=await response.json();if(!response.ok)throw Error(/^[a-z_]+$/.test(output.error)?output.error:'hosted_request_failed');
  const record=(await store.list(100)).find(r=>(r.context as any).sessionId===sessionId);
  if(!record||record.status!=='completed'||JSON.stringify(record.output)!==JSON.stringify(output)||(record.context as any).requestId!==response.headers.get('x-request-id'))throw Error('hosted_audit_mismatch');
  if(!['model_checked','unsupported','not_needed'].includes(output.grounding)||record.calls.length!==(output.grounding==='not_needed'?1:2))throw Error('grounding_not_audited');
  if(output.grounding==='unsupported'&&(output.text||output.pointIds.length||!output.readyForReview))throw Error('rejected_candidate_exposed');
  report.checks.push({language,status:response.status,grounding:output.grounding,calls:record.calls.length,recordId:record.id,requestLinked:true,outputMatches:true});
 }
}catch(e){report.error=e instanceof Error&&/^[a-z_]+$/.test(e.message)?e.message:'verification_failed';process.exitCode=1;}
await mkdir('artifacts/reports',{recursive:true});await writeFile('artifacts/reports/hosted-grounding-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
