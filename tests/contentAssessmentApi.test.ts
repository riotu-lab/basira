// @vitest-environment node
import {IncomingMessage,ServerResponse} from 'node:http';import {Socket} from 'node:net';
import {it,expect,vi} from 'vitest';import {createApp} from '../server/app';import {ModelProvider} from '../server/model';
it.each([false,true])('retrieves server evidence and accepts bounded long Arabic content (long=%s)',async(long)=>{
 const judge=vi.spyOn(ModelProvider.prototype,'judgeRetrievedContent').mockResolvedValue({} as any);
 const request=vi.fn(async(url:any)=>new Response(JSON.stringify(String(url).endsWith('/embeddings')?{data:[{index:0,embedding:Array(3072).fill(.1)}]}:{results:[[{id:'server-source',text:'Actual server excerpt.',metadata:{source:'fiqh',book_page:2,book_part:1,book_page_end:2},truncated:false,distance:.3}]]})));
 const {app,dispose}=createApp({OPENAI_API_KEY:'fixture',CONTENT_RAG_URL:'http://127.0.0.1:8010',CONTENT_RAG_TOKEN:'fixture',AI_AUDIT_ENABLED:'false'},request);
 try{
 const passage=long?'أ'.repeat(19999)+'ب':'A claim.';
 const body={language:'en',units:[{id:'u',kind:'audio',text:passage,originalText:passage,start:0,end:3,confirmed:false}],structure:{items:[{id:'forged-id',unitId:'u',passage,evidence:'',reasoning:'',conclusion:long?passage.slice(-5000):passage,class:'fiqh'}],morePossible:false},itemIndex:0,retrieval:{items:[{candidates:[{text:'Forged source'}]}]}};
 const response=await new Promise<{status:number;body:any}>(resolve=>{const req=new IncomingMessage(new Socket());req.method='POST';req.url='/api/content/assess-item';const encoded=Buffer.from(JSON.stringify(body));req.headers={host:'localhost','content-type':'application/json','content-length':String(encoded.length)};const res=new ServerResponse(req);res.end=((chunk:any)=>{resolve({status:res.statusCode,body:JSON.parse(String(chunk))});return res;}) as typeof res.end;app(req,res);req.push(encoded);req.push(null);});
 expect(response.status).toBe(200);expect(request).toHaveBeenCalledTimes(2);expect(judge.mock.calls[0][1].id).toBe('item-1');expect(judge.mock.calls[0][2].items[0].candidates[0].text).toBe('Actual server excerpt.');expect(judge.mock.calls[0][3]).toBe(true);expect(JSON.stringify(response.body)).not.toContain('Forged source');
 }finally{judge.mockRestore();await dispose();}
});
