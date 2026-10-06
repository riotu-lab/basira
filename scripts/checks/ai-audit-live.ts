import 'dotenv/config';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {AiAudit,SqliteAuditStore,RedisAuditStore} from '../../server/aiAudit';
import {ModelProvider} from '../../server/model';
const report:{checks:unknown[];error?:string}={checks:[]};
const path='.local/ai-audit-verification/check.sqlite';
let local=new SqliteAuditStore(path);
try{
 const audit=new AiAudit({...process.env,AI_AUDIT_ENABLED:'true'},local);
 const model=new ModelProvider(process.env,fetch,audit);
 const response=await model.converse('en',[{id:'audit-probe',role:'user',text:'Synthetic audit test: ask one short question about listening respectfully.',at:Date.now(),delivery:'text'}],AbortSignal.timeout(60000));
 local.close();local=new SqliteAuditStore(path);
 const [record]=await local.list(1);
 if(record.status!=='completed'||record.output!==response||!record.calls.length)throw Error('sqlite_verification_failed');
 report.checks.push({kind:'real_model_and_sqlite_reopen',ok:true,operation:record.operation,calls:record.calls.length});
 const url=process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL,token=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
 if(url&&token){
  const store=new RedisAuditStore(url,token,fetch,`basira:ai-audit:probe:${randomUUID()}`);
  try{await store.save({...record,input:{synthetic:true},output:'storage probe',calls:[],context:{}});const [read]=await store.list();if(read.id!==record.id)throw Error('redis_read_failed');report.checks.push({kind:'real_redis_write_read',ok:true});}
  finally{await store.remove(record.id);}
  if((await store.list()).length)throw Error('redis_cleanup_failed');report.checks.push({kind:'real_redis_delete',ok:true});
 }else report.checks.push({kind:'real_redis',skipped:'missing_credentials'});
}catch(e){report.error=e instanceof Error&&/^[a-z_]+$/.test(e.message)?e.message:'verification_failed';process.exitCode=1;}
finally{local.close();await mkdir('artifacts/reports',{recursive:true});await writeFile('artifacts/reports/ai-audit-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
