import {it,expect,vi,afterEach} from 'vitest';
import {renderHook,act,cleanup} from '@testing-library/react';
import {useContinuationNudge,CONTINUATION_NUDGE_MS} from '../src/useContinuationNudge';
afterEach(()=>{cleanup();vi.useRealTimers();});
it('waits for quiet, cancels on speech, and never repeats a nudge for the same saved turn',()=>{
 vi.useFakeTimers();const send=vi.fn();const {rerender}=renderHook(({busy,enabled,id})=>useContinuationNudge(enabled,id,busy,send),{initialProps:{busy:false,enabled:true,id:'one'}});
 act(()=>vi.advanceTimersByTime(10000));rerender({busy:true,enabled:true,id:'one'});act(()=>vi.advanceTimersByTime(20000));expect(send).not.toHaveBeenCalled();
 rerender({busy:false,enabled:true,id:'one'});act(()=>vi.advanceTimersByTime(CONTINUATION_NUDGE_MS));expect(send).toHaveBeenCalledTimes(1);
 rerender({busy:true,enabled:true,id:'one'});rerender({busy:false,enabled:true,id:'one'});act(()=>vi.advanceTimersByTime(60000));expect(send).toHaveBeenCalledTimes(1);
 rerender({busy:false,enabled:true,id:'two'});act(()=>vi.advanceTimersByTime(CONTINUATION_NUDGE_MS));expect(send).toHaveBeenCalledTimes(2);
});
it('does not nudge after disconnection, disablement or unmount',()=>{
 vi.useFakeTimers();const send=vi.fn();const {rerender,unmount}=renderHook(({enabled})=>useContinuationNudge(enabled,'one',false,send),{initialProps:{enabled:true}});
 rerender({enabled:false});act(()=>vi.advanceTimersByTime(30000));expect(send).not.toHaveBeenCalled();
 rerender({enabled:true});unmount();act(()=>vi.advanceTimersByTime(30000));expect(send).not.toHaveBeenCalled();
});
