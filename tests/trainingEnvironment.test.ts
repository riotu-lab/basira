// @vitest-environment node
import {describe,it,expect,vi} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {trainingEnvironment,trainingRouting,trainingScope} from '../server/trainingEnvironment';
import {trainingGatewayKey,trainingGatewayAuth} from '../server/trainingGateway';
import {TrainingStore} from '../server/trainingStore';
import {TrainingEngine} from '../server/trainingSession';
import {createCallbackProxy} from '../scripts/dev/callback-proxy';
import {configureTrainingPal} from '../scripts/setup/training-pal';
import {rules} from '../server/model';
// @ts-ignore -- plain JS deployment helper is also executed directly by Node.
import {productionTrainingValues} from '../scripts/deploy/training-env.mjs';
const env={TAVUS_API_KEY:'test-key-not-real',TAVUS_FACE_ID:'face'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status});

describe('Development / production boundaries',()=>{
 it('never routes a local app to legacy or production callbacks and PALs',()=>{
  expect(trainingEnvironment({NODE_ENV:'production'})).toBe('development');
  expect(trainingRouting({...env,BASIRA_PUBLIC_URL:'https://prod.test',TAVUS_TRAINING_PAL_ID:'prod'})).toMatchObject({environment:'development',palId:undefined,publicUrl:undefined});
  expect(trainingRouting({...env,BASIRA_PUBLIC_URL_PROD:'https://prod.test',TAVUS_TRAINING_PAL_ID_PROD:'prod',BASIRA_PUBLIC_URL_DEV:'https://dev.test',TAVUS_TRAINING_PAL_ID_DEV:'dev'})).toMatchObject({palId:'dev',publicUrl:'https://dev.test'});
  expect(()=>trainingRouting({BASIRA_PUBLIC_URL_DEV:'https://prod.test',BASIRA_PUBLIC_URL_PROD:'https://prod.test'})).toThrow();
  expect(()=>trainingRouting({TAVUS_TRAINING_PAL_ID_DEV:'same',TAVUS_TRAINING_PAL_ID_PROD:'same'})).toThrow();
 });
 it('isolates preview and selects production based on the hosting environment',()=>{
  expect(trainingEnvironment({VERCEL:'1',VERCEL_ENV:'production',BASIRA_ENV:'development'})).toBe('production');
  expect(trainingRouting({VERCEL:'1',VERCEL_ENV:'preview',BASIRA_PUBLIC_URL_PROD:'https://prod.test',TAVUS_TRAINING_PAL_ID_PROD:'prod'}).palId).toBeUndefined();
  expect(()=>trainingScope({BASIRA_DEV_INSTANCE:'../production'})).toThrow();
 });
 it('uses different gateway credentials even with the same Tavus account',()=>{
  const dev=trainingGatewayKey(env),prod=trainingGatewayKey({...env,BASIRA_ENV:'production'});
  expect(prod).not.toBe(dev);expect(()=>trainingGatewayAuth('Bearer '+dev,{...env,BASIRA_ENV:'production'})).toThrow();
 });
 it('isolates Redis records and locks for the same capability across environments',async()=>{
  const cache=new Map<string,string>(),commands:any[]=[];
  const request=vi.fn(async(_url:any,init:any)=>{const command=JSON.parse(init.body),[action,key,value]=command;commands.push(command);if(action==='GET')return json({result:cache.get(key)||null});if(action==='SET'){if(command.includes('NX')&&cache.has(key))return json({result:null});cache.set(key,value);return json({result:'OK'});}if(action==='EVAL'){cache.delete(command[3]);return json({result:1});}if(action==='DEL'){cache.delete(key);return json({result:1});}throw Error('unexpected');});
  const shared={...env,TRAINING_STORE:'redis',UPSTASH_REDIS_REST_URL:'https://redis.test',UPSTASH_REDIS_REST_TOKEN:'redis-fixture'};
  const dev=new TrainingStore(shared,request),prod=new TrainingStore({...shared,BASIRA_ENV:'production'},request),token='a'.repeat(64);
  await dev.put(token,{id:'development'} as any);await expect(prod.get(token)).rejects.toMatchObject({code:'training_session_missing'});
  await prod.put(token,{id:'production'} as any);await dev.remove(token);expect((await prod.get(token)).id).toBe('production');
  await dev.exclusive(token,()=>prod.exclusive(token,async()=>{}));
  expect(commands.some(c=>c[1]?.includes?.('development-local'))).toBe(true);expect(commands.some(c=>c[1]?.includes?.(':production:'))).toBe(true);
 });
 it('isolates scopes even when SQLite is deliberately pointed at the same file',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'basira-env-')),path=join(dir,'same.sqlite');const a=new TrainingStore({TRAINING_SQLITE_PATH:path,BASIRA_DEV_INSTANCE:'a'}),b=new TrainingStore({TRAINING_SQLITE_PATH:path,BASIRA_DEV_INSTANCE:'b'});
  try{const token='b'.repeat(64);await a.put(token,{id:'a'} as any);await expect(b.get(token)).rejects.toThrow();}finally{a.close();b.close();rmSync(dir,{recursive:true,force:true});}
 });
 it('exports only production training values regardless of the local runtime settings',()=>{
  const values=productionTrainingValues({BASIRA_ENV:'development',TRAINING_STORE:'sqlite',NGROK_AUTHTOKEN:'private',BASIRA_PUBLIC_URL_DEV:'https://dev.test',TAVUS_TRAINING_PAL_ID_DEV:'dev',BASIRA_PUBLIC_URL_PROD:'https://prod.test',TAVUS_TRAINING_PAL_ID_PROD:'prod'});
  expect(values).toEqual({BASIRA_ENV:'production',TRAINING_STORE:'redis',BASIRA_PUBLIC_URL_PROD:'https://prod.test',TAVUS_TRAINING_PAL_ID_PROD:'prod'});
  expect(()=>productionTrainingValues({BASIRA_PUBLIC_URL_PROD:'https://example.ngrok-free.app',TAVUS_TRAINING_PAL_ID_PROD:'x'})).toThrow();
 });
});
describe('Environment-specific PAL setup — mocked provider',()=>{
 it('creates a separate development PAL without changing production',async()=>{
  const request=vi.fn(async()=>json({pal_id:'new-dev'}));
  const result=await configureTrainingPal({...env,BASIRA_PUBLIC_URL_DEV:'https://dev.test',TAVUS_TRAINING_PAL_ID_PROD:'existing-prod'},false,request);
  const body=JSON.parse((request.mock.calls[0] as any)[1].body);expect(body.pal_name).toBe('Basira source-guided training (development)');expect(body.layers.llm.base_url).toBe('https://dev.test/api/training-llm');expect(body.layers.llm.model).toBe('basira-training-development-local');expect(result.key).toBe('TAVUS_TRAINING_PAL_ID_DEV');
 });
 it('patches only a recognized development PAL and never force-overwrites Maker work',async()=>{
  const request=vi.fn(async(_url:any,init:any)=>init.method==='GET'?json({pipeline_mode:'full',pal_name:'Basira source guided training development ',system_prompt:rules}):json({},409));
  await expect(configureTrainingPal({...env,BASIRA_PUBLIC_URL_DEV:'https://new-dev.test',TAVUS_TRAINING_PAL_ID_DEV:'dev'},true,request)).rejects.toThrow('HTTP 409');
  expect(request.mock.calls[1][0]).toBe('https://tavusapi.com/v2/pals/dev');expect(request.mock.calls[1][1].method).toBe('PATCH');
  expect(JSON.parse(request.mock.calls[1][1].body)[0].path).toBe('/layers/llm');
 });
});
describe('Local callback tunnel proxy — real HTTP, no external tunnel',()=>{
 it('blocks app routes and wrong credentials while passing SSE through unchanged',async()=>{
  let calls=0;const upstream=createServer((_req,res)=>{calls++;res.writeHead(200,{'content-type':'text/event-stream'});res.write('data: first\n\n');setTimeout(()=>res.end('data: [DONE]\n\n'),20);});upstream.listen(0,'127.0.0.1');await once(upstream,'listening');const port=(upstream.address() as any).port;
  const proxy=createCallbackProxy(port,env);proxy.listen(0,'127.0.0.1');await once(proxy,'listening');const base='http://127.0.0.1:'+(proxy.address() as any).port;
  try{
   expect((await fetch(base+'/api/config')).status).toBe(404);
   expect((await fetch(base+'/api/training-llm/chat/completions',{method:'POST'})).status).toBe(401);
   expect((await fetch(base+'/api/training-llm/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+trainingGatewayKey({...env,BASIRA_ENV:'production'})}})).status).toBe(401);
   expect(calls).toBe(0);
   const response=await fetch(base+'/api/training-llm/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+trainingGatewayKey(env),'Content-Type':'application/json'},body:'{}'});
   expect(response.headers.get('content-type')).toBe('text/event-stream');expect(await response.text()).toBe('data: first\n\ndata: [DONE]\n\n');expect(calls).toBe(1);
  }finally{proxy.closeAllConnections();upstream.closeAllConnections();await Promise.all([new Promise<void>(resolve=>proxy.close(()=>resolve())),new Promise<void>(resolve=>upstream.close(()=>resolve()))]);}
 });
});
