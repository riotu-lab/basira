export type AuditPolicy={days:number;maxRecords:number;maxBytes:number};
export const DEFAULT_AUDIT_POLICY:AuditPolicy={days:7,maxRecords:1000,maxBytes:20*1024*1024};
export function auditPolicy(env:NodeJS.ProcessEnv):AuditPolicy{
 const bounded=(v:string|undefined,d:number,min:number,max:number)=>{const n=Number(v);return Number.isInteger(n)&&n>=min&&n<=max?n:d;};
 return {days:bounded(env.AI_AUDIT_RETENTION_DAYS,7,1,90),maxRecords:bounded(env.AI_AUDIT_MAX_RECORDS,1000,10,10000),maxBytes:bounded(env.AI_AUDIT_MAX_BYTES,20*1024*1024,1024*1024,40*1024*1024)};
}
// One atomic save/prune transaction. Dedicated metadata is scoped to this audit namespace.
export const AUDIT_RETENTION_SCRIPT=`
local index=KEYS[1];local sizes=KEYS[2];local totalkey=KEYS[3]
local prefix=ARGV[1];local now=tonumber(ARGV[2]);local days=tonumber(ARGV[3]);local countcap=tonumber(ARGV[4]);local bytecap=tonumber(ARGV[5]);local cutoff=now-days*86400000
local function drop(id)
 local size=tonumber(redis.call('HGET',sizes,id) or '0')
 redis.call('DEL',prefix..':record:'..id);redis.call('ZREM',index,id);redis.call('HDEL',sizes,id)
 if redis.call('EXISTS',totalkey)==1 then redis.call('DECRBY',totalkey,size) end
end
local stale=redis.call('ZRANGEBYSCORE',index,'-inf',cutoff)
for _,id in ipairs(stale) do drop(id) end
local excess=redis.call('ZCARD',index)-countcap
if excess>0 then for _,id in ipairs(redis.call('ZRANGE',index,0,excess-1)) do drop(id) end end
if redis.call('EXISTS',totalkey)==0 then
 redis.call('DEL',sizes);local sum=0
 local rows=redis.call('ZRANGE',index,0,-1,'WITHSCORES')
 for i=1,#rows,2 do
  local id=rows[i];local k=prefix..':record:'..id;local n=redis.call('STRLEN',k)
  if n==0 then redis.call('ZREM',index,id) else
   redis.call('HSET',sizes,id,n);sum=sum+n
   redis.call('PEXPIRE',k,math.max(1,tonumber(rows[i+1])+days*86400000-now))
  end
 end
 redis.call('SET',totalkey,sum)
end
local id=ARGV[6];local created=tonumber(ARGV[7]);local record=ARGV[8]
if id~='' and created>cutoff then
 if string.len(record)>bytecap then return -1 end
 local previous=tonumber(redis.call('HGET',sizes,id) or '0')
 redis.call('SET',prefix..':record:'..id,record,'PX',math.max(1,created+days*86400000-now))
 redis.call('ZADD',index,created,id);redis.call('HSET',sizes,id,string.len(record));redis.call('INCRBY',totalkey,string.len(record)-previous)
end
while redis.call('ZCARD',index)>countcap or tonumber(redis.call('GET',totalkey) or '0')>bytecap do
 local oldest=redis.call('ZRANGE',index,0,0);if #oldest==0 then break end;drop(oldest[1])
end
for _,k in ipairs(KEYS) do redis.call('EXPIRE',k,(days+1)*86400) end
return redis.call('ZCARD',index)`;
