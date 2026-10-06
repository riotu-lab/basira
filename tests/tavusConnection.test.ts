import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {TavusConnection} from '../src/tavus';
const mock=vi.hoisted(()=>({handlers:{} as Record<string,Function>,call:{} as any,create:vi.fn()}));
vi.mock('@daily-co/daily-js',()=>({default:{createCallObject:mock.create}}));
const participant={local:false,session_id:'renderer',tracks:{audio:{track:{kind:'audio'}},video:{track:{kind:'video'}}}};
beforeEach(()=>{
 mock.handlers={};mock.call={on:vi.fn((name,fn)=>{mock.handlers[name]=fn;}),join:vi.fn(async()=>{}),participants:()=>({renderer:participant}),sendAppMessage:vi.fn(),leave:vi.fn(async()=>{}),destroy:vi.fn(async()=>{})};mock.create.mockReturnValue(mock.call);
 vi.stubGlobal('MediaStream',class{constructor(private tracks:any[]){}getVideoTracks(){return this.tracks.filter(t=>t.kind==='video');}getAudioTracks(){return this.tracks.filter(t=>t.kind==='audio');}});
 vi.stubGlobal('fetch',vi.fn(async(path)=>new Response(JSON.stringify(path.includes('/session')?{id:'opaque-stop-handle',conversationId:'c1',url:'https://tavus.daily.co/c1',meetingToken:'temporary-token'}:{stopped:true}))));
});
afterEach(()=>{vi.unstubAllGlobals();});
function video(){return {muted:false,play:vi.fn(async()=>{}),pause:vi.fn(),srcObject:null} as unknown as HTMLVideoElement;}
it('joins with microphone/camera disabled and ends billing even if media leave fails',async()=>{
 const c=new TavusConnection(vi.fn()),v=video();await c.start(v,new AbortController().signal);
 expect(mock.create).toHaveBeenCalledWith({audioSource:false,videoSource:false});expect(mock.call.join).toHaveBeenCalledWith(expect.objectContaining({audioSource:false,videoSource:false}));
 expect(v.srcObject).not.toBeNull();expect(v.muted).toBe(true);
 mock.call.leave.mockRejectedValueOnce(Error('transport lost'));await c.stop();
 expect(mock.call.destroy).toHaveBeenCalled();expect(v.srcObject).toBeNull();expect(fetch).toHaveBeenCalledWith('/api/avatar/stop',expect.objectContaining({body:JSON.stringify({id:'opaque-stop-handle'})}));
});
it('does not let a delayed play promise restart speaking after interruption',async()=>{
 const c=new TavusConnection(vi.fn()),v=video(),started=vi.fn();await c.start(v,new AbortController().signal);
 let played!:()=>void;vi.mocked(v.play).mockImplementationOnce(()=>new Promise<void>(r=>{played=r;}));
 const speaking=c.speak(new ArrayBuffer(4),started),id=mock.call.sendAppMessage.mock.calls[0][0].properties.inference_id;
 const event=(type:string,interrupted?:boolean)=>({fromId:'renderer',data:{message_type:'conversation',conversation_id:'c1',inference_id:id,event_type:type,properties:{role:'pal',interrupted}}});
 mock.handlers['app-message'](event('conversation.started_speaking'));
 const interruption=c.interrupt();played();await Promise.resolve();expect(started).not.toHaveBeenCalled();expect(v.muted).toBe(true);expect(v.pause).toHaveBeenCalled();
 mock.handlers['app-message'](event('conversation.stopped_speaking',true));await interruption;await expect(speaking).resolves.toBe(false);await c.stop();
});
it('fails closed on network interruption and tears down the session',async()=>{
 const disconnected=vi.fn(),c=new TavusConnection(disconnected),v=video();await c.start(v,new AbortController().signal);
 mock.handlers['network-connection']({event:'interrupted',type:'sfu'});expect(disconnected).toHaveBeenCalledWith('avatar_network_interrupted');expect(v.muted).toBe(true);await c.stop();
});
it('warns and expires separately from network failure; stops media and queued speech',async()=>{
 vi.useFakeTimers();
 try{
  const lost=vi.fn(),expired=vi.fn(),remaining=vi.fn(),c=new TavusConnection(lost,expired,remaining),v=video();
  await c.start(v,new AbortController().signal);
  await vi.advanceTimersByTimeAsync(60000);expect(expired).not.toHaveBeenCalled();
  c.listening(true);await vi.advanceTimersByTimeAsync(100000);c.listening(true);
  await vi.advanceTimersByTimeAsync(100000);c.listening(true);
  await vi.advanceTimersByTimeAsync(20000);expect(remaining).toHaveBeenCalledWith(15);
  const speaking=c.speak(new ArrayBuffer(96000),vi.fn());
  await vi.advanceTimersByTimeAsync(15000);
  expect(expired).toHaveBeenCalledTimes(1);expect(lost).not.toHaveBeenCalled();
  expect(v.muted).toBe(true);expect(v.srcObject).toBeNull();await expect(speaking).resolves.toBe(false);
  expect(fetch).toHaveBeenCalledWith('/api/avatar/stop',expect.anything());await c.stop();
 }finally{vi.useRealTimers();}
});
