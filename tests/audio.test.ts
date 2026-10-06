import {afterEach,describe,it,expect,vi} from 'vitest';
import {Microphone,PcmPlayer} from '../src/audio';
afterEach(()=>vi.unstubAllGlobals());
describe('Audio lifecycle with mocked browser media',()=>{
  it('does not start stale playback when cancelled during AudioContext resume',async()=>{
    let resume!:()=>void;const createBufferSource=vi.fn();
    vi.stubGlobal('AudioContext',class {resume(){return new Promise<void>(r=>{resume=r;});}createBufferSource=createBufferSource;});
    const player=new PcmPlayer(),onStart=vi.fn();
    const pending=player.play(new ArrayBuffer(4),onStart);player.stop();resume();
    await expect(pending).resolves.toBe(false);expect(createBufferSource).not.toHaveBeenCalled();expect(onStart).not.toHaveBeenCalled();
  });
  it('stops a microphone granted after the session was cancelled',async()=>{
    let permission!:(stream:MediaStream)=>void;const stop=vi.fn();
    vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:vi.fn(()=>new Promise<MediaStream>(r=>{permission=r;}))}});
    vi.stubGlobal('MediaRecorder',class {});
    const mic=new Microphone(),pending=mic.start(vi.fn());mic.cancel();
    permission({getTracks:()=>[{stop}]} as unknown as MediaStream);
    await expect(pending).rejects.toThrow('cancelled');expect(stop).toHaveBeenCalledOnce();
  });
  it('releases all microphone tracks on mute/cancel',async()=>{
    const stop=vi.fn();let recorderStop=vi.fn();
    vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:vi.fn().mockResolvedValue({getTracks:()=>[{stop}]})}});
    vi.stubGlobal('MediaRecorder',class {state='recording';static isTypeSupported(){return true;}start(){}stop(){recorderStop();}onstop=null;ondataavailable=null;});
    const mic=new Microphone();await mic.start(vi.fn());mic.cancel();
    expect(stop).toHaveBeenCalledOnce();expect(recorderStop).toHaveBeenCalledOnce();
  });
});

it('releases a granted microphone when the recorder cannot initialize',async()=>{
 const stop=vi.fn();vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:vi.fn().mockResolvedValue({getTracks:()=>[{stop}]})}});
 vi.stubGlobal('MediaRecorder',class {static isTypeSupported(){return true;}constructor(){throw Error('encoder_unavailable');}});
 const mic=new Microphone();await expect(mic.start(vi.fn())).rejects.toThrow('encoder_unavailable');expect(stop).toHaveBeenCalledOnce();
});
