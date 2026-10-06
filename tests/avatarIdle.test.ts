// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {AvatarIdleGuard} from '../src/avatarLimits';
afterEach(()=>vi.useRealTimers());
it('ends at 150 seconds idle and removes its timer',()=>{
 vi.useFakeTimers();const expired=vi.fn(),guard=new AvatarIdleGuard(expired);guard.start();
 vi.advanceTimersByTime(149999);expect(expired).not.toHaveBeenCalled();
 vi.advanceTimersByTime(1);expect(expired).toHaveBeenCalledTimes(1);
 vi.advanceTimersByTime(300000);expect(expired).toHaveBeenCalledTimes(1);
});
it('resets on activity and cancels on session cleanup',()=>{
 vi.useFakeTimers();const expired=vi.fn(),guard=new AvatarIdleGuard(expired);guard.start();
 vi.advanceTimersByTime(140000);guard.touch();vi.advanceTimersByTime(140000);expect(expired).not.toHaveBeenCalled();
 guard.stop();vi.advanceTimersByTime(300000);expect(expired).not.toHaveBeenCalled();
});
it('synthetic interface events cannot keep an unattended session alive',()=>{
 vi.useFakeTimers();const expired=vi.fn(),guard=new AvatarIdleGuard(expired);guard.start();
 vi.advanceTimersByTime(140000);window.dispatchEvent(new Event('input'));vi.advanceTimersByTime(10000);expect(expired).toHaveBeenCalledOnce();
});
