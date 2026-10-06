// Uses isolated temporary keys only; no customer audit records are modified.
import 'dotenv/config';
import {randomUUID} from 'node:crypto';
import {RedisAuditStore,type AuditRecord} from '../../server/aiAudit';
import {RequestProtection} from '../../server/requestProtection';
const url=process.env.UPSTASH_REDIS_REST_URL!,token=process.env.UPSTASH_REDIS_REST_TOKEN!,prefix='basira:test:retention:'+randomUUID();
const store=new RedisAuditStore(url,token,fetch,prefix,{days:7,maxRecords:2,maxBytes:2000});
async function command(command:unknown[]){const r=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(command)});const j=await r.json();if(!r.ok||j.error)throw Error('storage_check_failed');return j.result;}
const record=(id:string,createdAt=Date.now(),size=0):AuditRecord=>({id,version:1,createdAt,updatedAt:createdAt,operation:'fixture',reviewStatus:'pending',status:'completed',context:{},input:'x'.repeat(size),calls:[]});
try{
 await store.save(record('old',Date.now()-8*86400000));if((await store.list()).length)throw Error('age_prune_failed');
 for(let i=0;i<3;i++)await store.save(record(String(i),Date.now()+i));
 const rows=await store.list();if(rows.length!==2||rows[0].id!=='2')throw Error('count_prune_failed');
 const ttl=await command(['PTTL',prefix+':record:2']);if(ttl<0||ttl>8*86400000)throw Error('record_ttl_failed');
 const large=record('large',Date.now()+10);large.input='x'.repeat(1950-Buffer.byteLength(JSON.stringify(large)));await store.save(large);if((await store.list()).length!==1)throw Error('byte_prune_failed');
 await store.remove('large');if((await store.list()).length)throw Error('delete_failed');
 const env={...process.env,AI_REQUEST_UNITS_PER_MINUTE:'30'};const one=new RequestProtection(env),two=new RequestProtection(env);const id='test-'+randomUUID();
 if(await one.consume(id,id,30)!==0||await two.consume(id,id,1)<=0)throw Error('shared_limit_failed');
 console.log(JSON.stringify({realRedis:true,agePruning:true,countPruning:true,bytePruning:true,ttl:true,deletion:true,sharedLimitAcrossInstances:true,temporaryRateKeysExpireWithinSeconds:60}));
}finally{await command(['DEL',prefix+':index',prefix+':sizes',prefix+':bytes',...['old','0','1','2','large'].map(id=>prefix+':record:'+id)]);}
