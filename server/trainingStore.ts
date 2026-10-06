import {trainingEnvironment,trainingScope} from './trainingEnvironment.js';
import {dirname} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import type {TrainingSession} from '../src/trainingSession.js';
import {ApiError} from './validation.js';
// Capability-authenticated records; no provider credentials or media are stored here.
export class TrainingStore{
 private db:any;
 constructor(private env:NodeJS.ProcessEnv,private request:typeof fetch=fetch){}
 private get redis(){return trainingEnvironment(this.env)!=='development'||this.env.TRAINING_STORE==='redis';}
 private async command(args:unknown[]){const url=this.env.UPSTASH_REDIS_REST_URL||this.env.KV_REST_API_URL,token=this.env.UPSTASH_REDIS_REST_TOKEN||this.env.KV_REST_API_TOKEN;if(!url||!token||!url.startsWith('https://'))throw new ApiError('training_storage_unavailable',503);const r=await this.request(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(8000)});const d=await r.json();if(!r.ok||d.error)throw new ApiError('training_storage_unavailable',503);return d.result;}
 private async local(){if(!this.db){const {DatabaseSync}=await import('node:sqlite');const path=this.env.TRAINING_SQLITE_PATH||`.local/training/${trainingScope(this.env)}.sqlite`;mkdirSync(dirname(path),{recursive:true,mode:0o700});this.db=new DatabaseSync(path);this.db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS training_sessions (id TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS training_stopped (id TEXT PRIMARY KEY, expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS training_locks (id TEXT PRIMARY KEY, owner TEXT NOT NULL, expires INTEGER NOT NULL)');}return this.db;}
 private key(token:string){if(!/^[a-f0-9]{64}$/.test(token))throw new ApiError('training_session_missing',404);return `basira:training:v2:${trainingScope(this.env)}:`+createHash('sha256').update(token).digest('hex');}
 async get(token:string):Promise<TrainingSession>{const key=this.key(token);const value=this.redis?await this.command(['GET',key]):(await this.local()).prepare('SELECT value FROM training_sessions WHERE id=?').get(key)?.value;if(!value)throw new ApiError('training_session_missing',404);const session=JSON.parse(value);if(session.live&&await this.callStopped(token,session.live.callId))delete session.live;return session;}
 async put(token:string,s:TrainingSession){if(s.live&&await this.callStopped(token,s.live.callId))delete s.live;const key=this.key(token),value=JSON.stringify(s);if(this.redis)await this.command(['SET',key,value,'EX',60*60*24*30]);else (await this.local()).prepare('INSERT INTO training_sessions VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').run(key,value);}
 async revokeCall(token:string,callId:string){const key=this.key(token)+':stopped:'+callId;if(this.redis)await this.command(['SET',key,'1','EX',600]);else{const db=await this.local();db.prepare('DELETE FROM training_stopped WHERE expires<?').run(Date.now());db.prepare('INSERT OR REPLACE INTO training_stopped VALUES (?,?)').run(key,Date.now()+600000);}}
 private async callStopped(token:string,callId:string){const key=this.key(token)+':stopped:'+callId;return this.redis?!!await this.command(['GET',key]):!!(await this.local()).prepare('SELECT id FROM training_stopped WHERE id=? AND expires>?').get(key,Date.now());}
 async remove(token:string){const key=this.key(token);if(this.redis)await this.command(['DEL',key]);else (await this.local()).prepare('DELETE FROM training_sessions WHERE id=?').run(key);}
 async exclusive<T>(token:string,fn:()=>Promise<T>):Promise<T>{const key=this.key(token)+':lock',owner=randomUUID(),expires=Date.now()+300000;let acquired=false;
  if(this.redis)acquired=await this.command(['SET',key,owner,'NX','PX',300000])==='OK';else {const db=await this.local();db.prepare('DELETE FROM training_locks WHERE expires<?').run(Date.now());acquired=db.prepare('INSERT OR IGNORE INTO training_locks VALUES (?,?,?)').run(key,owner,expires).changes===1;}
  if(!acquired)throw new ApiError('training_busy',409);
  try{return await fn();}finally{if(this.redis)await this.command(['EVAL','if redis.call("get",KEYS[1]) == ARGV[1] then return redis.call("del",KEYS[1]) else return 0 end',1,key,owner]);else (await this.local()).prepare('DELETE FROM training_locks WHERE id=? AND owner=?').run(key,owner);}
 }
 close(){this.db?.close();}
}
