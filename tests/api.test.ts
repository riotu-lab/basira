// @vitest-environment node
// In-process HTTP handler tests. No bound socket, no real provider calls.
import {IncomingMessage,ServerResponse} from 'node:http';
import {Socket} from 'node:net';
import {describe,it,expect,vi} from 'vitest';
import {createApp} from '../server/app';
async function invoke(path:string,body?:unknown,env:NodeJS.ProcessEnv={},origin?:string,headers:Record<string,string>={}){
  const {app,dispose}=createApp(env,vi.fn());
  return new Promise<{status:number;body:any}>(resolve=>{
    const req=new IncomingMessage(new Socket());req.method=body===undefined?'GET':'POST';req.url=path;
    const encoded=body===undefined?null:Buffer.from(JSON.stringify(body));
    req.headers={host:'localhost:3000',...headers,...(origin?{origin}:{}),...(encoded?{'content-type':'application/json','content-length':String(encoded.length)}:{})};
    const res=new ServerResponse(req);
    const chunks:string[]=[];res.write=((chunk:any)=>{chunks.push(String(chunk));return true;}) as typeof res.write;
    res.end=((chunk:any)=>{if(chunk!==undefined)chunks.push(String(chunk));const raw=chunks.join('');void dispose();resolve({status:res.statusCode,body:String(res.getHeader('Content-Type')).includes('text/event-stream')?raw:JSON.parse(raw)});return res;}) as typeof res.end;
    app(req,res);if(encoded)req.push(encoded);req.push(null);
  });
}
describe('HTTP route guards',()=>{
  it('identifies the app on health without credentials',async()=>expect(await invoke('/api/health')).toEqual({status:200,body:{service:'basira',status:'ok'}}));
  it('returns capabilities without exposing configured secrets',async()=>{
    const r=await invoke('/api/config',undefined,{OPENAI_API_KEY:'test-secret',LIVEAVATAR_API_KEY:'avatar-secret'});
    expect(r.body.ai.configured).toBe(true);expect(r.body.avatar.configured).toBe(false);
    expect(JSON.stringify(r.body)).not.toContain('test-secret');expect(JSON.stringify(r.body)).not.toContain('avatar-secret');
  });
  it('does not require Redis or a fixed start allowance for Tavus on Vercel',async()=>{
    const r=await invoke('/api/config',undefined,{VERCEL:'1',OPENAI_API_KEY:'test',AVATAR_PROVIDER:'tavus',TAVUS_API_KEY:'test',TAVUS_FACE_ID:'face',TAVUS_PAL_ID:'pal',AVATAR_DEMO_MAX_STARTS:'0'});
    expect(r.body.avatar).toEqual({provider:'tavus',configured:true,missing:[]});
  });
  it('rejects cross-origin API requests',async()=>expect((await invoke('/api/conversation',{language:'en',turns:[]},{},'https://unrelated.example')).status).toBe(403));
  it('returns a specific missing-model error, never scripted text',async()=>expect(await invoke('/api/conversation',{language:'en',turns:[]})).toEqual({status:503,body:{error:'model_not_configured'}}));
  it('rejects unsupported language',async()=>expect((await invoke('/api/conversation',{language:'fr',turns:[]})).status).toBe(400));
  it('rejects session caps outside the existing demo limit',async()=>expect((await invoke('/api/avatar/session',{maxSessionSeconds:600})).status).toBe(400));
  it('requires model, avatar, license confirmation and explicit enablement',async()=>expect(await invoke('/api/avatar/session',{})).toEqual({status:503,body:{error:'avatar_not_configured'}}));
});

it('retains ownership and reports failed stop until a retry is acknowledged (mocked provider)',async()=>{
  vi.useFakeTimers();
  let stops=0;
  const provider=vi.fn(async(url:string)=>{
    if(url.endsWith('/token'))return new Response(JSON.stringify({data:{session_token:'test-only-token'}}));
    if(url.endsWith('/start'))return new Response(JSON.stringify({data:{livekit_url:'wss://example.invalid',livekit_client_token:'test-only',ws_url:'wss://example.invalid'}}));
    stops++;return new Response(null,{status:stops===1?503:200});
  });
  const {app,dispose}=createApp({OPENAI_API_KEY:'test-only',LIVEAVATAR_API_KEY:'test-only',LIVEAVATAR_AVATAR_ID:'test-only',LIVEAVATAR_ENABLE_LIVE:'true',LIVEAVATAR_LICENSE_CONFIRMED:'true'},provider as unknown as typeof fetch);
  const send=(path:string,body:object)=>new Promise<{status:number;body:any}>(resolve=>{
    const req=new IncomingMessage(new Socket());req.method='POST';req.url=path;
    const data=Buffer.from(JSON.stringify(body));req.headers={host:'localhost:3000','content-type':'application/json','content-length':String(data.length)};
    const res=new ServerResponse(req);res.end=((chunk:any)=>{resolve({status:res.statusCode,body:JSON.parse(String(chunk))});return res;}) as typeof res.end;
    app(req,res);req.push(data);req.push(null);
  });
  try{
    const started=await send('/api/avatar/session',{});expect(started.status).toBe(200);
    const stopped=await send('/api/avatar/stop',{id:started.body.id});expect(stopped).toEqual({status:502,body:{error:'avatar_stop_unconfirmed'}});
    expect((await send('/api/avatar/session',{})).status).toBe(409);
    await vi.advanceTimersByTimeAsync(5000);expect(stops).toBe(2);
    expect((await send('/api/avatar/session',{})).status).toBe(200);
  }finally{await dispose();vi.useRealTimers();}
});

it('classifies LiveAvatar credit-related HTTP 403 and releases a never-started session (mocked)',async()=>{
 const provider=vi.fn(async(url:string,_init?:RequestInit)=>url.endsWith('/token')?new Response(JSON.stringify({data:{session_token:'test-token'}})):url.endsWith('/start')?new Response(JSON.stringify({message:'Insufficient credits'}),{status:403}):new Response(JSON.stringify({message:'Session not found'}),{status:404}));
 const {app,dispose}=createApp({OPENAI_API_KEY:'test',LIVEAVATAR_API_KEY:'test',LIVEAVATAR_AVATAR_ID:'test',LIVEAVATAR_ENABLE_LIVE:'true',LIVEAVATAR_LICENSE_CONFIRMED:'true'},provider as unknown as typeof fetch);
 const send=()=>new Promise<{status:number;body:any}>(resolve=>{
  const req=new IncomingMessage(new Socket());req.method='POST';req.url='/api/avatar/session';const data=Buffer.from(JSON.stringify({maxSessionSeconds:60}));req.headers={host:'localhost','content-type':'application/json','content-length':String(data.length)};
  const res=new ServerResponse(req);res.end=((chunk:any)=>{resolve({status:res.statusCode,body:JSON.parse(String(chunk))});return res;}) as typeof res.end;app(req,res);req.push(data);req.push(null);
 });
 const log=vi.spyOn(console,'warn').mockImplementation(()=>{});
 try{expect(await send()).toEqual({status:502,body:{error:'avatar_credits_unavailable'}});expect(await send()).toEqual({status:502,body:{error:'avatar_credits_unavailable'}});const body=JSON.parse((provider.mock.calls[0] as unknown as [string,RequestInit])[1].body as string);expect(body.max_session_duration).toBe(60);}
 finally{await dispose();log.mockRestore();}
});
it.each(['finish','recover'])('waits for an in-flight saved answer before %s (mocked engine)',async(action)=>{
 const {TrainingStore}=await import('../server/trainingStore');const {TrainingEngine}=await import('../server/trainingSession');const {ApiError}=await import('../server/validation');
 const session={id:'session',language:'en',tradition:'hinduism',revision:1,createdAt:0,records:[{id:'record',question:{id:'question'}}],currentId:'record',ended:false} as any;
 const read=vi.spyOn(TrainingStore.prototype,'get').mockResolvedValue(session);
 const act=vi.spyOn(TrainingEngine.prototype,'act').mockRejectedValueOnce(new ApiError('training_busy',409)).mockResolvedValueOnce({session:{...session,ended:true},text:''});
 try{const response=await invoke('/api/training/session/action',{token:'a'.repeat(64),id:'finish-event',action});expect(response.status).toBe(200);expect(response.body.session.ended).toBe(true);expect(act).toHaveBeenCalledTimes(2);expect(act.mock.calls[0][1].id).toBe(act.mock.calls[1][1].id);}finally{read.mockRestore();act.mockRestore();}
});

it.each(['ar','en'] as const)('preserves intentional silence in %s JSON and SSE, and announces only actual completion',async language=>{
 const {TrainingStore}=await import('../server/trainingStore');const {TrainingEngine}=await import('../server/trainingSession');
 const {trainingGatewayKey,trainingContext}=await import('../server/trainingGateway');
 const env={TAVUS_API_KEY:'fixture-only'};const session:any={id:'test',language,currentId:'r',records:[{id:'r',question:{id:'q'}}],ended:false};
 const read=vi.spyOn(TrainingStore.prototype,'get').mockResolvedValue(session);
 const completion=vi.spyOn(TrainingEngine.prototype,'completion');
 try{for(const ended of [false,true])for(const stream of [false,true]){
  completion.mockResolvedValue({session:{...session,ended},text:''});
  const response=await invoke('/api/training-llm/chat/completions',{stream,messages:[{role:'system',content:trainingContext('a'.repeat(64))},{role:'user',content:'أم أم. انظر، العقل. هو. وشيء. مهم.'}]},env,undefined,{authorization:'Bearer '+trainingGatewayKey(env)});
  expect(response.status).toBe(200);
  const content=stream?JSON.parse(response.body.split('\n')[0].slice(6)).choices[0].delta.content:response.body.choices[0].message.content;
  expect(content).toBe(ended?(language==='ar'?'انتهى التدريب. يمكنك الآن مراجعة إجاباتك.':'Practice has ended. You can now review your answers.'):'');
 }}finally{read.mockRestore();completion.mockRestore();}
},20000);

it('retries quotation extraction once without accepting invented words',async()=>{
 const {ModelProvider}=await import('../server/model');
 const units=[{id:'t',kind:'text',text:'قال الله تعالى: قل هو الله واحد',originalText:'قال الله تعالى: قل هو الله واحد',confirmed:true}];
 const extract=vi.spyOn(ModelProvider.prototype,'extractContent').mockResolvedValueOnce({morePossible:false,claims:[{unitId:'t',passage:'Invented',quote:'Invented',citation:'',kind:'quran_quote'}]}).mockResolvedValueOnce({morePossible:false,claims:[]});
 try{const result=await invoke('/api/content/review',{language:'ar',units,includeArguments:false});expect(result.status).toBe(200);expect(extract).toHaveBeenCalledTimes(2);expect(JSON.stringify(result.body)).not.toContain('Invented');}finally{extract.mockRestore();}
});
it('rejects invalid overview counts before making a model call',async()=>{
 const r=await invoke('/api/content/summary',{language:'en',kind:'text',counts:{supported_in_excerpt:-1}});expect(r.status).toBe(400);
});
