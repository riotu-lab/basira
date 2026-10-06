import {describe,it,expect,vi} from 'vitest';
const sdk=vi.hoisted(()=>({get:vi.fn(),del:vi.fn().mockResolvedValue(undefined),list:vi.fn()}));
vi.mock('@vercel/blob',()=>sdk);
vi.mock('@vercel/blob/client',()=>({handleUpload:vi.fn()}));
import {ContentUploads,uploadGrant} from '../server/contentUploads';
describe('private large media uploads',()=>{
 it('rejects unavailable storage rather than announcing unsupported uploads',()=>{expect(()=>new ContentUploads(undefined).prepare('video/mp4',12)).toThrow('large_upload_unavailable');});
 it('issues a bounded, tamper-protected capability and rejects arbitrary targets',()=>{const service=new ContentUploads('test-secret'),g=service.prepare('video/mp4',10);expect(uploadGrant(g.ticket,'test-secret').path).toBe(g.path);expect(()=>uploadGrant(g.ticket,'other-secret')).toThrow();expect(()=>uploadGrant('https://localhost/private','test-secret')).toThrow();expect(()=>service.prepare('text/html',10)).toThrow();expect(()=>service.prepare('video/mp4',201*1024*1024)).toThrow();});
 it('accepts the expanded size boundary',()=>{expect(()=>new ContentUploads('test-secret').prepare('video/mp4',200*1024*1024)).not.toThrow();});
 it('deletes temporary media after processing errors',async()=>{const service=new ContentUploads('test-secret'),g=service.prepare('video/mp4',3);sdk.get.mockResolvedValue({statusCode:200,blob:{size:3},stream:new ReadableStream({start(c){c.enqueue(new Uint8Array([1,2,3]));c.close();}})});await expect(service.consume(g.ticket,new AbortController().signal,async()=>{throw Error('processing failed');})).rejects.toThrow('processing failed');expect(sdk.del).toHaveBeenCalledWith(g.path,{token:'test-secret'});});
 it('rejects metadata size mismatches and still cleans up',async()=>{const service=new ContentUploads('test-secret'),g=service.prepare('video/mp4',3);sdk.get.mockResolvedValue({statusCode:200,blob:{size:1000}});await expect(service.consume(g.ticket,new AbortController().signal,async()=>true)).rejects.toThrow('invalid_upload');expect(sdk.del).toHaveBeenCalledWith(g.path,{token:'test-secret'});});
});
