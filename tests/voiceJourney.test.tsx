// Mocked capture/playback + HTTP. Not a physical microphone or avatar test.
import {act,cleanup,renderHook,waitFor} from '@testing-library/react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {useJourney} from '../src/useJourney';
import {Microphone,PcmPlayer} from '../src/audio';
beforeEach(()=>{
  localStorage.clear();
  vi.spyOn(PcmPlayer.prototype,'prepare').mockResolvedValue();
  vi.spyOn(PcmPlayer.prototype,'play').mockImplementation(async(_pcm,start)=>{start();return true;});
  vi.spyOn(PcmPlayer.prototype,'close').mockResolvedValue();
  vi.spyOn(Microphone.prototype,'start').mockResolvedValue();
  vi.spyOn(Microphone.prototype,'finish').mockResolvedValue(new Blob(['fixture'],{type:'audio/webm'}));
  vi.stubGlobal('fetch',vi.fn(async(path:string)=>{
    if(path==='/api/config')return new Response(JSON.stringify({ai:{configured:true},voice:{configured:true,languages:['ar','en']},avatar:{configured:false},languages:['ar','en']}));
    if(path.startsWith('/api/transcribe'))return new Response(JSON.stringify({text:'My actual transcribed answer'}));
    if(path==='/api/speech')return new Response(new Uint8Array([0,0]));
    return new Response(JSON.stringify({text:'One question?',latencyMs:1}));
  }));
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
async function setup(){
  const h=renderHook(()=>useJourney());
  act(()=>h.result.current.setInteraction('voice'));
  await act(()=>h.result.current.begin());
  return h;
}
it('sends a completed push-to-talk recording without manual confirm/send',async()=>{
  const h=await setup();
  await act(()=>h.result.current.toggleMicrophone());
  await act(()=>h.result.current.toggleMicrophone());
  await waitFor(()=>expect(h.result.current.turns.filter(t=>t.role==='user')).toHaveLength(1));
  expect(h.result.current.turns[1].text).toBe('My actual transcribed answer');
  expect(h.result.current.input).toBe('');
});
it('keeps optional transcript confirmation and discards a transcription interrupted before delivery',async()=>{
  const h=await setup();act(()=>h.result.current.setAutoSend(false));
  await act(()=>h.result.current.toggleMicrophone());await act(()=>h.result.current.toggleMicrophone());
  expect(h.result.current.input).toBe('My actual transcribed answer');
  expect(h.result.current.turns.filter(t=>t.role==='user')).toHaveLength(0);
  act(()=>h.result.current.setAutoSend(true));
  let release!:(value:Response)=>void;
  vi.mocked(fetch).mockImplementationOnce(()=>new Promise<Response>(r=>{release=r;}));
  await act(()=>h.result.current.toggleMicrophone());
  let pending!:Promise<void>;
  await act(async()=>{pending=h.result.current.toggleMicrophone();await Promise.resolve();});
  await act(()=>h.result.current.interrupt());
  await act(async()=>{release(new Response(JSON.stringify({text:'stale words'})));await pending;});
  expect(h.result.current.turns.filter(t=>t.role==='user')).toHaveLength(0);
});
