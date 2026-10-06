import {it,expect,vi,afterEach} from 'vitest';
const upload=vi.hoisted(()=>vi.fn().mockResolvedValue({}));
vi.mock('@vercel/blob/client',()=>({upload}));
vi.mock('../src/retainedMedia',()=>({retainMedia:vi.fn().mockResolvedValue(null)}));
vi.mock('../src/api',()=>({api:vi.fn().mockResolvedValue({path:'content-review/test',ticket:'signed'}),RequestError:Error}));
import {postContentMedia} from '../src/contentUpload';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
it('sends the actual MIME type when fallback multipart uploads have extensionless paths',async()=>{
 vi.stubEnv('VITE_VERCEL_DEPLOYMENT','1');vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}')));
 const file=new Blob([new Uint8Array(5*1024*1024)],{type:'audio/wav'});
 await postContentMedia('/api/content/media/audio?language=ar',file,new AbortController().signal);
 expect(upload).toHaveBeenCalledWith('content-review/test',file,expect.objectContaining({contentType:'audio/wav',multipart:true}));
});
