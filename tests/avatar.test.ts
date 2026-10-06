import {afterEach,describe,expect,it,vi} from 'vitest';
import {AvatarProtocol} from '../src/live';
afterEach(()=>vi.useRealTimers());
describe('Avatar protocol with synthetic events; not a live avatar test',()=>{
  it('requires provider readiness before sending audio',async()=>{
    const send=vi.fn(),p=new AvatarProtocol(send);
    await expect(p.speak(new ArrayBuffer(4),vi.fn())).rejects.toThrow('avatar_not_ready');
    expect(send).not.toHaveBeenCalled();
  });
  it('uses one utterance ID, cancels queued audio, and ignores late speech events',async()=>{
    const events:any[]=[],started=vi.fn(),p=new AvatarProtocol(e=>events.push(e));
    p.handle({type:'session.state_updated',state:'connected'});
    const spoken=p.speak(new ArrayBuffer(96000),started);
    expect(events).toHaveLength(3);
    const utterance=events[0].event_id;
    expect(events.every(e=>e.event_id===utterance)).toBe(true);
    p.handle({type:'agent.speak_started',source_event_id:utterance});expect(started).toHaveBeenCalledTimes(1);
    const interrupted=p.interrupt();await expect(spoken).resolves.toBe(false);
    p.handle({type:'agent.speak_started',source_event_id:utterance});expect(started).toHaveBeenCalledTimes(1);
    await expect(p.speak(new ArrayBuffer(4),started)).rejects.toThrow('avatar_not_ready');
    p.handle({type:'agent.audio_buffer_cleared',source_event_id:events.at(-1).event_id});await interrupted;
    const next=p.speak(new ArrayBuffer(4),started),nextId=events.at(-1).event_id;
    p.handle({type:'agent.speak_ended',source_event_id:utterance});
    p.handle({type:'agent.speak_ended',source_event_id:nextId});await expect(next).resolves.toBe(true);p.close();
  });
  it('requires acknowledgement of the correct interrupt ID',async()=>{
    vi.useFakeTimers();const p=new AvatarProtocol(vi.fn());p.handle({type:'session.state_updated',state:'connected'});
    const interrupted=p.interrupt();const assertion=expect(interrupted).rejects.toThrow('interrupt_not_acknowledged');
    p.handle({type:'agent.audio_buffer_cleared',source_event_id:'wrong'});await vi.advanceTimersByTimeAsync(5001);await assertion;p.close();
  });
});
