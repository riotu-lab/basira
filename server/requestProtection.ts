import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import type {Request,Response,NextFunction} from 'express';
import {trainingScope} from './trainingEnvironment.js';
export function paidRequestWeight(path:string,body:any){
 if(['/api/training/session/read','/api/training/session/delete','/api/training/video-stop','/api/avatar/stop'].includes(path))return 0;
 if(path==='/api/training/session/action')return ['finish','recover'].includes(body?.action)?0:2;
 if(['/api/content/media-retention/metadata','/api/content/media-retention/delete'].includes(path))return 1;
 if(path.startsWith('/api/content/media/')||path==='/api/content/image'||['/api/training/speech-review','/api/training/visual-review'].includes(path))return 6;
 if(path.startsWith('/api/content/'))return 3;
 if(['/api/training/session','/api/training/video-session','/api/avatar/video-session','/api/avatar/session'].includes(path))return 5;
 return ['/api/conversation','/api/feedback','/api/compare','/api/speech','/api/transcribe','/api/training/assess','/api/training/followup','/api/ai-audit/avatar-utterance'].includes(path)?2:0;
}
export const LIMIT_SCRIPT=`
local retry=0
for i,k in ipairs(KEYS) do
 local used=tonumber(redis.call('GET',k) or '0')
 if used+tonumber(ARGV[1])>tonumber(ARGV[i+2]) then retry=math.max(retry,redis.call('TTL',k)) end
end
if retry>0 then return retry end
for i,k in ipairs(KEYS) do
 local n=redis.call('INCRBY',k,ARGV[1]);if n==tonumber(ARGV[1]) then redis.call('EXPIRE',k,ARGV[2]) end
end
return 0`;
export class RequestProtection{
 private memory=new Map<string,{used:number;expires:number}>();
 private secret:string;private url?:string;private token?:string;private clientLimit:number;private ipLimit:number;
 constructor(private env:NodeJS.ProcessEnv,private request:typeof fetch=fetch){this.secret=env.REQUEST_PROTECTION_SECRET||env.OPENAI_API_KEY||randomBytes(32).toString('hex');this.url=env.UPSTASH_REDIS_REST_URL||env.KV_REST_API_URL;this.token=env.UPSTASH_REDIS_REST_TOKEN||env.KV_REST_API_TOKEN;const n=Number(env.AI_REQUEST_UNITS_PER_MINUTE||240);this.clientLimit=Number.isInteger(n)&&n>=30&&n<=3000?n:240;this.ipLimit=this.clientLimit*10;}
 private hash(v:string){return createHmac('sha256',this.secret).update(v).digest('hex');}
 async consume(client:string,ip:string,cost:number){
  const keys=[`basira:requests:${trainingScope(this.env)}:client:${this.hash(client)}`,`basira:requests:${trainingScope(this.env)}:ip:${this.hash(ip)}`];
  if(this.url&&this.token){try{const u=new URL(this.url);if(u.protocol!=='https:'||u.username||u.password)throw Error();const r=await this.request(u,{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${this.token}`,'Content-Type':'application/json'},body:JSON.stringify(['EVAL',LIMIT_SCRIPT,2,...keys,cost,60,this.clientLimit,this.ipLimit]),signal:AbortSignal.timeout(4000)});const j=await r.json();if(!r.ok||j.error||!Number.isInteger(j.result)||j.result<0)throw Error();return j.result as number;}catch{throw Error('request_protection_unavailable');}}
  if(this.env.VERCEL)throw Error('request_protection_unavailable');
  const now=Date.now();for(const [k,v]of this.memory)if(v.expires<=now)this.memory.delete(k);
  const limits=[this.clientLimit,this.ipLimit];let retry=0;keys.forEach((k,i)=>{const v=this.memory.get(k);if(v&&v.used+cost>limits[i])retry=Math.max(retry,Math.ceil((v.expires-now)/1000));});if(retry)return retry;
  keys.forEach(k=>{const v=this.memory.get(k)||{used:0,expires:now+60000};v.used+=cost;this.memory.set(k,v);});return 0;
 }
 private client(req:Request,res:Response){
  const raw=req.headers.cookie?.match(/(?:^|;\s*)basira_client=([a-f0-9]+\.[a-f0-9]+)/)?.[1];
  if(raw){const [id,sig]=raw.split('.'),want=Buffer.from(this.hash('client:'+id)),got=Buffer.from(sig);if(id.length===32&&got.length===want.length&&timingSafeEqual(want,got))return id;}
  const id=randomBytes(16).toString('hex');res.append('Set-Cookie',`basira_client=${id}.${this.hash('client:'+id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${this.env.VERCEL?'; Secure':''}`);return id;
 }
 middleware=async(req:Request,res:Response,next:NextFunction)=>{
  const cost=req.method==='POST'?paidRequestWeight(req.path,req.body):0;if(!cost)return next();
  const ip=this.env.VERCEL?(req.get('x-vercel-forwarded-for')?.split(',')[0].trim()||'unknown'):req.socket.remoteAddress||'local';
  try{const retry=await this.consume(this.client(req,res),ip,cost);if(retry){res.setHeader('Retry-After',String(retry));res.status(429).json({error:'request_limit',retryAfterSeconds:retry});return;}next();}catch{res.status(503).json({error:'request_protection_unavailable'});}
 };
}
