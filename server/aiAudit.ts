import {auditPolicy,DEFAULT_AUDIT_POLICY,AUDIT_RETENTION_SCRIPT,type AuditPolicy} from './auditRetention.js';
import {trainingScope} from './trainingEnvironment.js';
import {AsyncLocalStorage} from 'node:async_hooks';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {ApiError} from './validation.js';
export type AuditRecord={version:1;id:string;createdAt:number;updatedAt:number;operation:string;status:'started'|'completed'|'failed';reviewStatus:'pending';context:unknown;input:unknown;output?:unknown;error?:string;durationMs?:number;calls:unknown[];};
export interface AuditStore{save(record:AuditRecord):Promise<void>;list(limit?:number):Promise<AuditRecord[]>;remove(id:string):Promise<void>;close?():void;}
export const aiRequestContext=new AsyncLocalStorage<Record<string,unknown>>();
const active=new AsyncLocalStorage<AuditRecord>();
export function sanitizeAudit(value:unknown,env:NodeJS.ProcessEnv):unknown{
 const secrets=Object.entries(env).filter(([key,v])=>v&&/KEY|TOKEN|SECRET|PASSWORD|DATABASE_URL|REDIS.*URL|KV_REST.*URL/i.test(key)).map(([,v])=>v!).filter(v=>v.length>=4);
 function clean(v:any,depth=0):any{
  if(depth>30)return {omitted:'depth_limit'};
  if(v instanceof AbortSignal)return undefined;
  if(v instanceof Uint8Array)return {omitted:'binary',bytes:v.byteLength,sha256:createHash('sha256').update(v).digest('hex')};
  if(typeof v==='string'){
   let text=v.replace(/BASIRA_TRAINING_SESSION=[a-f0-9]{64}/g,'BASIRA_TRAINING_SESSION=[redacted]').replace(/data:[^;,]+;base64,[A-Za-z0-9+/=]+/g,'[media omitted]').replace(/Bearer\s+[^\s"']+/gi,'Bearer [redacted]').replace(/\bsk-[A-Za-z0-9_-]{10,}\b/g,'[redacted]');
   for(const secret of secrets)text=text.split(secret).join('[redacted]');
   return text;
  }
  if(v&&typeof v==='object'&&typeof v.data==='string'&&['wav','mp3'].includes(v.format)){const bytes=Buffer.from(v.data,'base64');return {format:v.format,omitted:'audio',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};}
  if(Array.isArray(v))return v.map(x=>clean(x,depth+1));
  if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([k])=>!['__proto__','constructor','prototype'].includes(k)).map(([k,x])=>[k,/authorization|api.?key|access.?token|meeting.?token|password|secret|session.?token/i.test(k)?'[redacted]':clean(x,depth+1)]));
  return v;
 }
 return clean(value);
}
export class SqliteAuditStore implements AuditStore{
 private db:any;
 constructor(private path:string,private policy:AuditPolicy=DEFAULT_AUDIT_POLICY){}
 private async open(){
  if(!this.db){const {DatabaseSync}=await import('node:sqlite');if(this.db)return this.db;mkdirSync(dirname(resolve(this.path)),{recursive:true,mode:0o700});this.db=new DatabaseSync(this.path);this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS ai_calls (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, record TEXT NOT NULL); CREATE INDEX IF NOT EXISTS ai_calls_created ON ai_calls(created_at);');}
  return this.db;
 }
 private async prune(){const db=await this.open();db.prepare('DELETE FROM ai_calls WHERE created_at<=?').run(Date.now()-this.policy.days*86400000);db.prepare('DELETE FROM ai_calls WHERE id IN (SELECT id FROM ai_calls ORDER BY created_at DESC,id DESC LIMIT -1 OFFSET ?)').run(this.policy.maxRecords);while(Number(db.prepare('SELECT COALESCE(SUM(length(CAST(record AS BLOB))),0) AS bytes FROM ai_calls').get().bytes)>this.policy.maxBytes)db.prepare('DELETE FROM ai_calls WHERE id=(SELECT id FROM ai_calls ORDER BY created_at,id LIMIT 1)').run();}
 async save(r:AuditRecord){if(Buffer.byteLength(JSON.stringify(r))>this.policy.maxBytes)throw Error('audit_record_too_large');(await this.open()).prepare('INSERT INTO ai_calls(id,created_at,record) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET record=excluded.record').run(r.id,r.createdAt,JSON.stringify(r));await this.prune();}
 async list(limit=50){await this.prune();return (await this.open()).prepare('SELECT record FROM ai_calls ORDER BY created_at DESC, id DESC LIMIT ?').all(Math.min(1000,Math.max(1,limit))).map((r:any)=>JSON.parse(r.record));}
 async remove(id:string){(await this.open()).prepare('DELETE FROM ai_calls WHERE id=?').run(id);}
 close(){this.db?.close();this.db=undefined;}
}
export class RedisAuditStore implements AuditStore{
 constructor(private url:string,private token:string,private request:typeof fetch=fetch,private prefix='basira:ai-audit:v1',private policy:AuditPolicy=DEFAULT_AUDIT_POLICY){}
 private async commands(commands:unknown[][]){
  const url=new URL(this.url);if(url.protocol!=='https:'||url.username||url.password)throw Error('audit_configuration');
  const r=await this.request(this.url.replace(/\/$/,'')+'/multi-exec',{method:'POST',headers:{Authorization:`Bearer ${this.token}`,'Content-Type':'application/json'},body:JSON.stringify(commands),signal:AbortSignal.timeout(4000),redirect:'error'});
  if(!r.ok)throw Error('audit_storage_unavailable');const data=await r.json();if(!Array.isArray(data)||data.length!==commands.length||data.some(v=>v.error))throw Error('audit_storage_unavailable');return data.map(v=>v.result);
 }
 private async retain(record?:AuditRecord){const p=this.prefix;const result=await this.commands([['EVAL',AUDIT_RETENTION_SCRIPT,3,`${p}:index`,`${p}:sizes`,`${p}:bytes`,p,Date.now(),this.policy.days,this.policy.maxRecords,this.policy.maxBytes,record?.id||'',record?.createdAt||0,record?JSON.stringify(record):'']]);if(!Number.isInteger(result[0])||result[0]<0)throw Error('audit_retention_failed');}
 async save(r:AuditRecord){await this.retain(r);}
 async list(limit=50){await this.retain();const [ids]=await this.commands([['ZREVRANGE',`${this.prefix}:index`,0,Math.min(1000,Math.max(1,limit))-1]]);if(!ids.length)return [];const [values]=await this.commands([['MGET',...ids.map((id:string)=>`${this.prefix}:record:${id}`)]]);return values.filter(Boolean).map((v:string)=>JSON.parse(v));}
 async remove(id:string){await this.commands([['EVAL',"local n=tonumber(redis.call('HGET',KEYS[2],ARGV[1]) or '0');redis.call('DEL',KEYS[4]);redis.call('ZREM',KEYS[1],ARGV[1]);redis.call('HDEL',KEYS[2],ARGV[1]);if redis.call('EXISTS',KEYS[3])==1 then redis.call('DECRBY',KEYS[3],n) end;return 1",4,`${this.prefix}:index`,`${this.prefix}:sizes`,`${this.prefix}:bytes`,`${this.prefix}:record:${id}`,id]]);}
}
export function auditStore(env:NodeJS.ProcessEnv):AuditStore{
 const backend=env.AI_AUDIT_STORE||(env.VERCEL?'redis':'sqlite');
 if(backend==='sqlite'&&!env.VERCEL)return new SqliteAuditStore(env.AI_AUDIT_SQLITE_PATH||'.local/ai-audit/ai-calls.sqlite',auditPolicy(env));
 const url=env.UPSTASH_REDIS_REST_URL||env.KV_REST_API_URL,token=env.UPSTASH_REDIS_REST_TOKEN||env.KV_REST_API_TOKEN;
 if(backend!=='redis'||!url||!token)throw new ApiError('ai_audit_unavailable',503);
 return new RedisAuditStore(url,token,fetch,`basira:ai-audit:v2:${trainingScope(env)}`,auditPolicy(env));
}
export class AiAudit{
 private store?:AuditStore;
 readonly enabled:boolean;
 constructor(private env:NodeJS.ProcessEnv,store?:AuditStore){this.store=store;this.enabled=env.AI_AUDIT_ENABLED!=='false'&&(!process.env.VITEST||env.AI_AUDIT_ENABLED==='true');}
 private async save(record:AuditRecord){try{this.store??=auditStore(this.env);await this.store.save(sanitizeAudit(record,this.env) as AuditRecord);}catch{throw new ApiError('ai_audit_unavailable',503);}}
 async run<T>(operation:string,input:unknown,work:()=>Promise<T>):Promise<T>{
  if(!this.enabled)return work();
  const now=Date.now(),record:AuditRecord={version:1,id:randomUUID(),createdAt:now,updatedAt:now,operation,status:'started',reviewStatus:'pending',context:aiRequestContext.getStore()||{},input:sanitizeAudit(input,this.env),calls:[]};
  // A missing database stops before a billable AI request, rather than silently losing logs.
  await this.save(record);
  return active.run(record,async()=>{
   try{const output=await work();record.output=sanitizeAudit(output,this.env);record.status='completed';return output;}
   catch(e){record.status='failed';record.error=e instanceof ApiError?e.code:'operation_failed';throw e;}
   finally{record.updatedAt=Date.now();record.durationMs=record.updatedAt-now;await this.save(record);}
  });
 }
 async capture(path:string,provider:string,init:RequestInit,response:Response,durationMs:number){
  const record=active.getStore();if(!record||!this.enabled)return;
  let requestBody:unknown;
  if(typeof init.body==='string'){try{requestBody=JSON.parse(init.body);}catch{requestBody=init.body;}}
  else if(init.body instanceof FormData)requestBody=Object.fromEntries([...init.body.entries()].map(([k,v])=>[k,typeof v==='string'?v:{omitted:'uploaded_file',bytes:v.size,mime:v.type}]));
  const clone=response.clone();let raw:unknown;
  if(path==='audio/speech'&&response.ok){const bytes=Buffer.from(await clone.arrayBuffer());raw={omitted:'generated_audio',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};}
  else{const text=await clone.text();try{raw=JSON.parse(text);}catch{raw=text;}}
  record.calls.push(sanitizeAudit({provider,path,httpStatus:response.status,durationMs,providerRequestId:response.headers.get('x-request-id'),request:requestBody,response:raw},this.env));
 }
}
