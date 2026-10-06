// @vitest-environment node
import {describe,it,expect,vi} from 'vitest';
import {sealAvatarToken,openAvatarToken} from '../server/avatarHandle';
describe('stateless encrypted avatar cleanup handle',()=>{
 it('recovers ownership on another instance without exposing plaintext',()=>{const h=sealAvatarToken('provider-token','server-key');expect(h).not.toContain('provider-token');expect(openAvatarToken(h,'server-key')).toBe('provider-token');});
 it('rejects modified handles and different deployment keys',()=>{const h=sealAvatarToken('token','key');expect(()=>openAvatarToken(h,'other')).toThrow();const b=Buffer.from(h,'base64url');b[30]^=1;expect(()=>openAvatarToken(b.toString('base64url'),'key')).toThrow();});
 it('expires cleanup credentials',()=>{vi.useFakeTimers();try{const h=sealAvatarToken('token','key');vi.advanceTimersByTime(600001);expect(()=>openAvatarToken(h,'key')).toThrow();}finally{vi.useRealTimers();}});
});
