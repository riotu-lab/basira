import React from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup,act} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
const mocks=vi.hoisted(()=>({create:vi.fn(),api:vi.fn()}));
vi.mock('@daily-co/daily-js',()=>({default:{createCallObject:mocks.create}}));
vi.mock('../src/api',()=>({api:mocks.api,RequestError:class extends Error{code='test';}}));
import {VideoCall} from '../src/VideoCall';
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
function track(kind:string){return {kind,enabled:true,stop:vi.fn()};}
class Stream{tracks:any[];constructor(tracks:any[]=[]){this.tracks=tracks;}getTracks(){return this.tracks;}getVideoTracks(){return this.tracks.filter(t=>t.kind==='video');}getAudioTracks(){return this.tracks.filter(t=>t.kind==='audio');}addTrack(t:any){this.tracks.push(t);}removeTrack(t:any){this.tracks=this.tracks.filter(x=>x!==t);}}
function setup(){
 vi.stubGlobal('MediaStream',Stream);vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue();vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{});
 const audio=track('audio'),video=track('video');const gum=vi.fn(async(c:any)=>new Stream(c.audio===false?[video]:c.video===false?[audio]:[audio,video]));
 vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:gum},sendBeacon:vi.fn()});
 const c={on:vi.fn(),join:vi.fn(async()=>{}),leave:vi.fn(async()=>{}),destroy:vi.fn(async()=>{}),setLocalVideo:vi.fn(),setLocalAudio:vi.fn(),sendAppMessage:vi.fn(),setInputDevicesAsync:vi.fn(async()=>{}),participants:()=>({remote:{local:false,session_id:'avatar',tracks:{video:{track:track('video')},audio:{track:track('audio')}}}})};
 mocks.create.mockReset().mockReturnValue(c);mocks.api.mockReset().mockImplementation(async(path:string)=>path.includes('video-session')?{id:'test',url:'mock',meetingToken:'mock',conversationId:'mock',maxSessionSeconds:300}:{});
 return {c,gum,audio,video};
}
it('starts once without camera, toggles it within the same call, stops tracks and cleans up (mocked SDK)',async()=>{
 const {c,gum,audio,video}=setup();const view=render(<VideoCall embedded autoStart initialCamera={false} lang="en" language="en" onBack={()=>{}} onReview={()=>{}}/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Camera on'})).toBeEnabled());expect(gum.mock.calls[0][0].video).toBe(false);expect(mocks.create.mock.calls[0][0].videoSource).toBe(false);
 const stage=document.querySelector('.video-call-stage');fireEvent.click(screen.getByRole('button',{name:'Camera on'}));await screen.findByRole('button',{name:'Camera off'});
 expect(c.setInputDevicesAsync).toHaveBeenCalledWith({videoSource:video});expect(document.querySelector('.video-call-stage')).toBe(stage);expect(gum.mock.calls[1][0].audio).toBe(false);
 fireEvent.click(screen.getByRole('button',{name:'Camera off'}));await screen.findByRole('button',{name:'Camera on'});expect(video.stop).toHaveBeenCalled();expect(audio.stop).not.toHaveBeenCalled();expect(mocks.create).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole('button',{name:'Mute'}));expect(c.setLocalAudio).toHaveBeenCalledWith(false);
 fireEvent.click(screen.getByRole('button',{name:'End call'}));await waitFor(()=>expect(c.destroy).toHaveBeenCalled());expect(audio.stop).toHaveBeenCalled();expect(mocks.api).toHaveBeenCalledWith('/api/avatar/stop',{id:'test'});view.unmount();
});
it('honours start-with-camera and keeps voice connected if later camera permission fails',async()=>{
 const {gum,c}=setup();render(<VideoCall embedded autoStart initialCamera lang="en" language="en" onBack={()=>{}} onReview={()=>{}}/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Camera off'})).toBeEnabled());expect(gum.mock.calls[0][0].video).not.toBe(false);
 fireEvent.click(screen.getByRole('button',{name:'Camera off'}));await waitFor(()=>expect(screen.getByRole('button',{name:'Camera on'})).toBeEnabled());
 gum.mockRejectedValueOnce(new DOMException('Denied','NotAllowedError'));fireEvent.click(screen.getByRole('button',{name:'Camera on'}));await screen.findByText(/Camera unavailable/);expect(c.leave).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Mute'})).toBeEnabled();
});
it('stops a camera granted after the call ends',async()=>{
 const {gum,video}=setup();render(<VideoCall autoStart initialCamera={false} lang="en" language="en" onBack={()=>{}} onReview={()=>{}}/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Camera on'})).toBeEnabled());
 let resolve!:(s:Stream)=>void;gum.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));fireEvent.click(screen.getByRole('button',{name:'Camera on'}));fireEvent.click(screen.getByRole('button',{name:'End call'}));resolve(new Stream([video]));await waitFor(()=>expect(video.stop).toHaveBeenCalled());
});
it('stops the paid call before handing its actual transcript to text chat',async()=>{
 const {c}=setup(),continueText=vi.fn();render(<VideoCall autoStart initialCamera={false} lang="en" language="en" onBack={()=>{}} onReview={()=>{}} onContinueText={continueText}/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Camera on'})).toBeEnabled());
 const listener=c.on.mock.calls.find(args=>args[0]==='app-message')![1];
 listener({fromId:'avatar',data:{message_type:'conversation',event_type:'conversation.utterance',inference_id:'user-1',properties:{role:'user',speech:'My original answer.'}}});
 fireEvent.click(screen.getByRole('button',{name:'Continue without avatar'}));
 await waitFor(()=>expect(continueText).toHaveBeenCalled());expect(c.destroy).toHaveBeenCalled();expect(continueText.mock.calls[0][1][0].text).toBe('My original answer.');
});

it('sends typed input as a respond event and reconnects only after cleanup, preserving history',async()=>{
 const {c}=setup(),restart=vi.fn();render(<VideoCall autoStart initialCamera={false} initialSessionId="saved-session" initialTurns={[{id:'old',role:'user',text:'An earlier answer.',at:1,delivery:'text'}]} onRestart={restart} lang="en" language="en" onBack={()=>{}} onReview={()=>{}}/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Camera on'})).toBeEnabled());
 expect(mocks.api).toHaveBeenCalledWith('/api/avatar/video-session',expect.objectContaining({history:expect.arrayContaining([expect.objectContaining({text:'An earlier answer.'})])}),expect.anything());
 fireEvent.change(screen.getByRole('textbox',{name:'Type a message'}),{target:{value:'A typed answer.'}});fireEvent.click(screen.getByRole('button',{name:'Send'}));
 expect(c.sendAppMessage).toHaveBeenCalledWith(expect.objectContaining({event_type:'conversation.respond',properties:{text:'A typed answer.'}}),'avatar');
 fireEvent.click(screen.getByRole('button',{name:'End call'}));await screen.findByRole('button',{name:'Reconnect'});fireEvent.click(screen.getByRole('button',{name:'Reconnect'}));await waitFor(()=>expect(restart).toHaveBeenCalled());expect(c.destroy).toHaveBeenCalled();expect(restart.mock.calls[0][0]).toBe('saved-session');expect(restart.mock.calls[0][1].map((t:any)=>t.text)).toEqual(['An earlier answer.','A typed answer.']);
});
it('blocks reconnect when stopping the previous session is unconfirmed',async()=>{
 setup();const restart=vi.fn();mocks.api.mockImplementation(async(path:string)=>{if(path.endsWith('/stop'))throw Error('offline');return{id:'test',url:'mock',meetingToken:'mock',conversationId:'mock',maxSessionSeconds:300};});render(<VideoCall autoStart initialCamera={false} onRestart={restart} lang="en" language="en" onBack={()=>{}} onReview={()=>{}}/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'End call'})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'End call'}));await screen.findByRole('button',{name:'Reconnect'});fireEvent.click(screen.getByRole('button',{name:'Reconnect'}));await waitFor(()=>expect(mocks.api.mock.calls.filter(c=>c[0].endsWith('/stop')).length).toBeGreaterThan(1));expect(restart).not.toHaveBeenCalled();
});
it('shows connection preparation and does not disconnect a live call for a recoverable training error',async()=>{
 const {c}=setup();const props={embedded:true,autoStart:true,initialCamera:false,lang:'en' as const,language:'en' as const,trainingToken:'a'.repeat(64),onBack:()=>{},onReview:()=>{}};
 const view=render(<VideoCall {...props}/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Mute'})).toBeEnabled());
 view.rerender(<VideoCall {...props} trainingError="invalid_model_evidence"/>);
 expect(await screen.findByRole('button',{name:'Resume answer'})).toBeVisible();expect(c.leave).not.toHaveBeenCalled();expect(screen.getByText('Microphone ready')).toBeVisible();
});

it('recovers transient SDK network interruptions and distinguishes service speech detection from local microphone readiness',async()=>{
 const {c}=setup();render(<VideoCall embedded autoStart initialCamera={false} lang="en" language="en" onBack={()=>{}} onReview={()=>{}}/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Mute'})).toBeEnabled());
 const network=c.on.mock.calls.find(v=>v[0]==='network-connection')![1];
 act(()=>network({event:'interrupted'}));expect(screen.getByText('Reconnecting… Your words are saved.')).toBeVisible();expect(c.leave).not.toHaveBeenCalled();
 act(()=>network({event:'connected'}));expect(screen.queryByText('Reconnecting… Your words are saved.')).toBeNull();
 const message=c.on.mock.calls.find(v=>v[0]==='app-message')![1];
 act(()=>message({fromId:'avatar',data:{conversation_id:'mock',event_type:'conversation.started_speaking',properties:{role:'user'}}}));expect(screen.getByText('Speech detected by service')).toBeVisible();
 act(()=>message({fromId:'avatar',data:{conversation_id:'mock',event_type:'conversation.stopped_speaking',properties:{role:'user'}}}));expect(screen.getByText('Microphone ready')).toBeVisible();expect(c.leave).not.toHaveBeenCalled();
});
it('holds a fresh opening until remote playback connects, without hiding saved reconnect history',async()=>{
 setup();let release!:()=>void;
 vi.spyOn(HTMLMediaElement.prototype,'play').mockImplementation(()=>new Promise<void>(resolve=>{release=resolve;}));
 const props={embedded:true,autoStart:true,initialCamera:false,lang:'en' as const,language:'en' as const,trainingToken:'a'.repeat(64),onBack:()=>{},onReview:()=>{}};
 render(<VideoCall {...props} trainingTurns={[{id:'opening',role:'assistant',text:'What would you like to explore?',at:1,delivery:'uncertain'}]}/>);
 await screen.findByText('Your conversation is about to begin');
 expect(screen.queryByText('What would you like to explore?')).toBeNull();
 await waitFor(()=>expect(release).toBeTypeOf('function'));
 await act(async()=>release());
 await screen.findByText('What would you like to explore?');
});
it('opens training review only after confirmed cleanup, with duplicate clicks blocked',async()=>{
 const {c}=setup(),review=vi.fn();let release!:()=>void;
 mocks.api.mockImplementation(async(path:string)=>path.endsWith('/video-stop')?new Promise<void>(r=>{release=r;}):{id:'sealed',url:'mock',meetingToken:'mock',conversationId:'mock',maxSessionSeconds:300});
 render(<VideoCall embedded autoStart initialCamera={false} lang="en" language="en" trainingToken={'a'.repeat(64)} onReview={review} onBack={()=>{}}/>);
 const button=await screen.findByRole('button',{name:'End training & review'});fireEvent.click(button);fireEvent.click(button);
 expect(review).not.toHaveBeenCalled();await waitFor(()=>expect(release).toBeTypeOf('function'));
 await act(async()=>release());await waitFor(()=>expect(review).toHaveBeenCalledTimes(1));expect(c.destroy).toHaveBeenCalled();
});
it('keeps review primary and reconnect secondary after a dropped training call; does not auto-review',async()=>{
 const {c}=setup(),review=vi.fn();render(<VideoCall embedded autoStart initialCamera={false} lang="en" language="en" trainingToken={'a'.repeat(64)} onReview={review} onBack={()=>{}} onRestart={()=>{}}/>);
 await screen.findByRole('button',{name:'End training & review'});
 act(()=>c.on.mock.calls.find(v=>v[0]==='error')![1]({}));
 expect(await screen.findByRole('button',{name:'Review conversation'})).toHaveClass('primary');expect(screen.getByRole('button',{name:'Reconnect'})).toHaveClass('secondary');expect(review).not.toHaveBeenCalled();
});
it('does not open training review when provider cleanup remains unconfirmed',async()=>{
 setup();const review=vi.fn();mocks.api.mockImplementation(async(path:string)=>{if(path.endsWith('/video-stop'))throw Error('offline');return {id:'sealed',url:'mock',meetingToken:'mock',conversationId:'mock',maxSessionSeconds:300};});
 render(<VideoCall embedded autoStart initialCamera={false} lang="en" language="en" trainingToken={'a'.repeat(64)} onReview={review} onBack={()=>{}}/>);
 fireEvent.click(await screen.findByRole('button',{name:'End training & review'}));await screen.findByRole('button',{name:'Review conversation'});expect(review).not.toHaveBeenCalled();
});

it('automatically opens a completed retry comparison only after stopping the live call',async()=>{
 const {c}=setup(),review=vi.fn();let release!:()=>void;
 mocks.api.mockImplementation(async(path:string)=>path.endsWith('/video-stop')?new Promise<void>(r=>{release=r;}):{id:'sealed',url:'mock',meetingToken:'mock',conversationId:'mock',maxSessionSeconds:300});
 const props={embedded:true,autoStart:true,initialCamera:false,lang:'en' as const,language:'en' as const,trainingToken:'a'.repeat(64),onReview:review,onBack:()=>{}};
 const view=render(<VideoCall {...props} trainingEnded={false}/>);await screen.findByRole('button',{name:'End training & review'});
 view.rerender(<VideoCall {...props} trainingEnded={true}/>);await waitFor(()=>expect(release).toBeTypeOf('function'));expect(review).not.toHaveBeenCalled();
 await act(async()=>release());await waitFor(()=>expect(review).toHaveBeenCalledTimes(1));expect(c.destroy).toHaveBeenCalled();
});
