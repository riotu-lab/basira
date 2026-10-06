import {trainingRuntimeInstance} from '../server/trainingEnvironment';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {TavusProtocol} from '../src/tavusProtocol';
import {TavusProvider} from '../server/tavus';
const env={TAVUS_API_KEY:'test-only-secret',TAVUS_FACE_ID:'face1',TAVUS_PAL_ID:'pal1'};
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status});
afterEach(()=>vi.useRealTimers());
describe('Tavus echo protocol — synthetic events, no live provider',()=>{
 it('keeps audio messages below 4KB and confirms only the matching completed utterance',async()=>{
  vi.useFakeTimers();const events:any[]=[],start=vi.fn(),p=new TavusProtocol('c1',e=>events.push(e));p.ready=true;
  const spoken=p.speak(new ArrayBuffer(48000),start);await vi.advanceTimersByTimeAsync(600);
  expect(events.every(e=>JSON.stringify(e).length<4096)).toBe(true);
  expect(events.filter(e=>e.properties.done)).toHaveLength(1);
  const id=events[0].properties.inference_id;
  expect(events.every(e=>e.properties.inference_id===id)).toBe(true);
  p.handle({message_type:'conversation',conversation_id:'wrong',event_type:'conversation.started_speaking',inference_id:id,properties:{role:'pal'}});expect(start).not.toHaveBeenCalled();
  for(const role of ['pal','replica'])p.handle({message_type:'conversation',conversation_id:'c1',event_type:'conversation.started_speaking',inference_id:id,properties:{role}});
  expect(start).toHaveBeenCalledTimes(1);
  p.handle({message_type:'conversation',conversation_id:'c1',event_type:'conversation.stopped_speaking',inference_id:id,properties:{role:'pal',interrupted:false}});
  await expect(spoken).resolves.toBe(true);p.close();
 });
 it('cancels unsent chunks and blocks new speech until interruption is acknowledged',async()=>{
  vi.useFakeTimers();const events:any[]=[],start=vi.fn(),p=new TavusProtocol('c1',e=>events.push(e));p.ready=true;
  const spoken=p.speak(new ArrayBuffer(96000),start),id=events[0].properties.inference_id;
  const interrupted=p.interrupt();await expect(spoken).resolves.toBe(false);await vi.advanceTimersByTimeAsync(1000);
  expect(events.filter(e=>e.event_type==='conversation.echo')).toHaveLength(1);
  await expect(p.speak(new ArrayBuffer(4),start)).rejects.toThrow('avatar_not_ready');
  p.handle({message_type:'conversation',conversation_id:'c1',event_type:'conversation.started_speaking',inference_id:id,properties:{role:'pal'}});expect(start).not.toHaveBeenCalled();
  p.handle({message_type:'conversation',conversation_id:'c1',event_type:'conversation.stopped_speaking',inference_id:id,properties:{role:'pal',interrupted:true}});
  await interrupted;p.close();
 });
 it('fails closed when interruption is unconfirmed; does not treat missing IDs as an acknowledgement',async()=>{
  vi.useFakeTimers();const p=new TavusProtocol('c1',()=>{});p.ready=true;
  const spoken=p.speak(new ArrayBuffer(100),()=>{});const interrupted=p.interrupt();const check=expect(interrupted).rejects.toThrow('interrupt_not_acknowledged');
  p.handle({message_type:'conversation',conversation_id:'c1',event_type:'conversation.stopped_speaking',properties:{role:'pal'}});
  await vi.advanceTimersByTimeAsync(5001);await check;await expect(spoken).resolves.toBe(false);expect(p.ready).toBe(false);p.close();
 });
 it('never claims complete playback without a start event and explicit uninterrupted completion',async()=>{
  const events:any[]=[],p=new TavusProtocol('c1',e=>events.push(e));p.ready=true;
  const spoken=p.speak(new ArrayBuffer(4),()=>{});
  p.handle({message_type:'conversation',conversation_id:'c1',event_type:'conversation.stopped_speaking',inference_id:events[0].properties.inference_id,properties:{role:'pal',interrupted:false}});
  await expect(spoken).resolves.toBe(false);p.close();
 });
});
describe('Tavus server lifecycle — mocked HTTPS',()=>{
 it('requires echo mode before creating any billable session',async()=>{
  const fetcher=vi.fn(async()=>response({pipeline_mode:'full'})),p=new TavusProvider(env,fetcher);
  await expect(p.start(new AbortController().signal)).rejects.toMatchObject({code:'avatar_session_configuration'});expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it('caps sessions, uses private rooms, and supports cleanup across instances without exposing the key',async()=>{
  const calls:any[]=[];const fetcher=vi.fn(async(url:any,init:any)=>{calls.push({url,...init});return response(url.endsWith('/pals/pal1')?{pipeline_mode:'echo'}:url.endsWith('/end')?{}:{conversation_id:'c1',conversation_url:'https://tavus.daily.co/c1',meeting_token:'temporary-room-token'});});
  const p=new TavusProvider(env,fetcher),data=await p.start(new AbortController().signal);
  expect(JSON.stringify(data)).not.toContain(env.TAVUS_API_KEY);
  expect(JSON.parse(calls[1].body)).toMatchObject({pal_id:'pal1',face_id:'face1',require_auth:true,max_participants:2,properties:{max_call_duration:300,participant_left_timeout:0,participant_absent_timeout:30}});
  const other=new TavusProvider(env,fetcher);await other.stop(data.id);expect(calls.at(-1).url.endsWith('/conversations/c1/end')).toBe(true);
  await expect(other.stop('c1')).rejects.toMatchObject({code:'invalid_avatar_handle'});
  await p.dispose();
 });
 it('allows simultaneous sessions when the provider accepts them, without a local cooldown',async()=>{
  let creates=0;
  const fetcher=vi.fn(async(url:any)=>response(url.endsWith('/pals/pal1')?{pipeline_mode:'echo'}:url.endsWith('/end')?{}:{conversation_id:`c${++creates}`,conversation_url:`https://tavus.daily.co/c${creates}`,meeting_token:'token'}));
  const p=new TavusProvider(env,fetcher);
  try{
   const sessions=await Promise.all([p.start(new AbortController().signal),p.start(new AbortController().signal)]);
   expect(creates).toBe(2);expect(sessions[0].conversationId).not.toBe(sessions[1].conversationId);
   await p.stop(sessions[0].id);
   await p.start(new AbortController().signal);expect(creates).toBe(3);
  }finally{await p.dispose();}
 });
 it('ends a created session if its browser request is cancelled',async()=>{
  const ctrl=new AbortController(),calls:string[]=[];
  const fetcher=vi.fn(async(url:any)=>{calls.push(url);if(url.endsWith('/pals/pal1'))return response({pipeline_mode:'echo'});if(url.endsWith('/end'))return response({});ctrl.abort();return response({conversation_id:'c1',conversation_url:'https://tavus.daily.co/c1',meeting_token:'token'});});
  const p=new TavusProvider(env,fetcher);await expect(p.start(ctrl.signal)).rejects.toMatchObject({code:'request_cancelled'});expect(calls.at(-1)?.endsWith('/c1/end')).toBe(true);
 });
 it.each([[401,'unauthorized','avatar_auth_failed'],[403,'credits exhausted','avatar_credits_unavailable'],[400,'invalid face','avatar_session_configuration'],[402,'Concurrent conversation quota exceeded','avatar_concurrency_limit'],[403,'Maximum session duration exceeds plan limit','avatar_plan_restriction'],[429,'Request quota exceeded','avatar_rate_limited'],[402,'Payment required','avatar_billing_restriction'],[402,'Insufficient conversation minutes','avatar_credits_unavailable']])('classifies HTTP %s without returning raw provider content',async(status,detail,code)=>{
  const p=new TavusProvider(env,vi.fn(async()=>response({error:detail},status as number)));await expect(p.start(new AbortController().signal)).rejects.toMatchObject({code});
 });
 it('classifies network errors and enforces a provider-independent text path',async()=>{
  const p=new TavusProvider(env,vi.fn(async()=>{throw Error('DNS');}));await expect(p.start(new AbortController().signal)).rejects.toMatchObject({code:'avatar_connection_failed'});
  expect(new TavusProvider({}).missing).toEqual(['TAVUS_API_KEY','TAVUS_FACE_ID','TAVUS_PAL_ID']);
 });
});

it('accepts observed room-scoped events with provider-assigned IDs and ignores retired duplicates',async()=>{
 const sent:any[]=[],started=vi.fn(),p=new TavusProtocol('room',e=>sent.push(e));p.ready=true;
 const first=p.speak(new ArrayBuffer(4),started);
 const event=(type:string,id:string)=>({message_type:'conversation',event_type:type,inference_id:id,properties:{role:'pal',interrupted:false}});
 p.handle(event('conversation.started_speaking','provider-one'));
 p.handle(event('conversation.stopped_speaking','provider-one'));await expect(first).resolves.toBe(true);
 const second=p.speak(new ArrayBuffer(4),started);
 p.handle(event('conversation.started_speaking','provider-one'));expect(started).toHaveBeenCalledTimes(1);
 p.handle(event('conversation.started_speaking','provider-two'));expect(started).toHaveBeenCalledTimes(2);
 const cancelled=p.interrupt();p.handle(event('conversation.stopped_speaking','provider-one'));
 p.handle(event('conversation.stopped_speaking','provider-two'));await cancelled;await expect(second).resolves.toBe(false);p.close();
});

it.each(['مرحبا، ماذا يعني لك الإيمان؟','Hello, what does faith mean to you?'])('sends text echo verbatim and confirms correlated playback: %s',async text=>{
 const sent:any[]=[],p=new TavusProtocol('room',e=>sent.push(e)),started=vi.fn();p.ready=true;
 const spoken=p.speak(text,started);
 expect(sent).toHaveLength(1);expect(sent[0].properties).toMatchObject({modality:'text',text,done:true});expect(sent[0].properties.audio).toBeUndefined();
 p.handle({message_type:'conversation',event_type:'conversation.started_speaking',inference_id:'provider',properties:{role:'pal'}});
 p.handle({message_type:'conversation',event_type:'conversation.stopped_speaking',inference_id:'provider',properties:{role:'pal',interrupted:false}});
 await expect(spoken).resolves.toBe(true);expect(started).toHaveBeenCalledOnce();p.close();
});
it('rejects oversized UTF-8 text without truncating or sending it',async()=>{
 const send=vi.fn(),p=new TavusProtocol('room',send);p.ready=true;
 await expect(p.speak('ع'.repeat(2100),()=>{})).rejects.toThrow('avatar_text_too_long');expect(send).not.toHaveBeenCalled();p.close();
});
it('interrupts text echo and prevents another reply until acknowledgement',async()=>{
 const sent:any[]=[],p=new TavusProtocol('room',e=>sent.push(e));p.ready=true;
 const spoken=p.speak('مرحبا',()=>{});
 p.handle({message_type:'conversation',event_type:'conversation.started_speaking',inference_id:'one',properties:{role:'pal'}});
 const stopped=p.interrupt();await expect(spoken).resolves.toBe(false);
 expect(sent.at(-1).event_type).toBe('conversation.interrupt');
 await expect(p.speak('Next',()=>{})).rejects.toThrow('avatar_not_ready');
 p.handle({message_type:'conversation',event_type:'conversation.stopped_speaking',inference_id:'one',properties:{role:'pal',interrupted:true}});
 await stopped;p.close();
});

it('rejects a full video PAL that permits biometric emotion inference',async()=>{
 const p=new TavusProvider({...env,TAVUS_FULL_PAL_ID:'full'},vi.fn(async()=>response({pipeline_mode:'full',system_prompt:'Basira',layers:{perception:{emotion_recognition:'full'}}})));
 await expect(p.start(new AbortController().signal,'ar')).rejects.toMatchObject({code:'avatar_session_configuration'});
});

it('creates full calls with Basira instructions, restricted perception, language and no recording',async()=>{
 const {rules}=await import('../server/model');const calls:any[]=[];
 const fetcher=vi.fn(async(url:any,init:any)=>{calls.push({url,...init});return response(url.endsWith('/pals/full')?{pipeline_mode:'full',system_prompt:rules,layers:{perception:{emotion_recognition:'limited'}}}:url.endsWith('/end')?{}:{conversation_id:'video',conversation_url:'https://tavus.daily.co/video',meeting_token:'temporary'});});
 const p=new TavusProvider({...env,TAVUS_FULL_PAL_ID:'full'},fetcher);
 try{await p.start(new AbortController().signal,'ar',[{id:'old',role:'user',text:'Remember my previous answer.',at:1,delivery:'text'}]);const body=JSON.parse(calls[1].body);expect(body.pal_id).toBe('full');expect(body.conversational_context).toContain('Remember my previous answer.');expect(body.conversational_context).toContain('untrusted historical dialogue');expect(body.custom_greeting).toContain('عودتك');expect(body.conversational_context).toContain('https://quran.com/16/125');expect(body.properties).toMatchObject({languages:['ar'],max_call_duration:300,enable_recording:false,auto_start_recording:false});}finally{await p.dispose();}
});

describe('Source-guided FULL configuration',()=>{
 it('refuses to create a paid call before its public callback is deployed',async()=>{
  const fetcher=vi.fn(async()=>new Response('not found',{status:404}));
  const p=new TavusProvider({...env,TAVUS_TRAINING_PAL_ID_DEV:'training',BASIRA_PUBLIC_URL_DEV:'https://example.test'},fetcher);
  await expect(p.start(new AbortController().signal,'en',[],{token:'a'.repeat(64),opening:'Canonical question',callId:'call-test'})).rejects.toMatchObject({code:'training_avatar_not_configured'});
  expect(fetcher.mock.calls).toHaveLength(1);
 });
 it('requires custom Basira routing and disables speculative turn submission',async()=>{
  const calls:any[]=[];const fetcher=vi.fn(async(url:any,init:any)=>{calls.push({url,body:init?.body});return response(url.endsWith('/health')?{gateway:'basira-source-training-v1',scope:'development-local',instance:trainingRuntimeInstance}:url.includes('/pals/')?{pipeline_mode:'full',layers:{llm:{model:'basira-training-development-local',base_url:'https://example.test/api/training-llm',speculative_inference:false}}}:url.endsWith('/end')?{}:{conversation_id:'training-call',conversation_url:'https://tavus.daily.co/training',meeting_token:'mock-token'});});
  const p=new TavusProvider({...env,TAVUS_TRAINING_PAL_ID_DEV:'training',BASIRA_PUBLIC_URL_DEV:'https://example.test'},fetcher);
  const started=await p.start(new AbortController().signal,'ar',[],{token:'a'.repeat(64),opening:'سؤال من قاعدة الأسئلة',callId:'call-test'});
  const create=JSON.parse(calls.find(c=>c.url.endsWith('/conversations')).body);
  expect(create.pal_id).toBe('training');expect(create.custom_greeting).toBe('سؤال من قاعدة الأسئلة');expect(create.conversational_context).toContain('BASIRA_CALL=call-test');expect(create.conversational_context).not.toContain('HISTORY:');await p.stop(started.id);await p.dispose();
 });
});
