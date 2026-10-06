import {it,expect,vi,afterEach} from 'vitest';
import {renderHook,act,cleanup} from '@testing-library/react';
import {useConversationActivity} from '../src/useConversationActivity';
import {SPOKEN_TURN_SETTLE_MS} from '../src/conversationTiming';
afterEach(()=>{cleanup();vi.useRealTimers();});
const event=(event_type:string,role='user',extra={})=>({event_type:'conversation.'+event_type,properties:{role,...extra}});
it('waits through a pause, thinks after the grace period, and returns to listening when speech resumes',()=>{
 vi.useFakeTimers();const {result}=renderHook(()=>useConversationActivity(true,false));
 act(()=>result.current.event(event('started_speaking')));expect(result.current.phase).toBe('listening');
 act(()=>result.current.event(event('stopped_speaking')));expect(result.current.phase).toBe('settling');
 act(()=>vi.advanceTimersByTime(SPOKEN_TURN_SETTLE_MS-1));expect(result.current.phase).toBe('settling');
 act(()=>result.current.event(event('started_speaking')));act(()=>vi.advanceTimersByTime(3000));expect(result.current.phase).toBe('listening');
 act(()=>result.current.event(event('utterance')));act(()=>vi.advanceTimersByTime(SPOKEN_TURN_SETTLE_MS));expect(result.current.phase).toBe('thinking');
 act(()=>vi.advanceTimersByTime(20000));expect(result.current.phase).toBe('delayed');
 act(()=>result.current.event(event('started_speaking','pal')));expect(result.current.phase).toBe('speaking');
 act(()=>result.current.event(event('stopped_speaking','replica')));expect(result.current.phase).toBe('idle');
});
it('clears pending animation on disconnect, continued thoughts and unmount',()=>{
 vi.useFakeTimers();const {result,rerender,unmount}=renderHook(({active,waiting})=>useConversationActivity(active,waiting),{initialProps:{active:true,waiting:false}});
 act(()=>result.current.pending());rerender({active:true,waiting:true});expect(result.current.phase).toBe('listening');
 act(()=>vi.advanceTimersByTime(30000));expect(result.current.phase).toBe('listening');
 act(()=>result.current.pending());rerender({active:false,waiting:false});expect(result.current.phase).toBe('idle');
 unmount();expect(vi.getTimerCount()).toBe(0);
});
