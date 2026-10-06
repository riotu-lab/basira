// @vitest-environment node
import {it,expect,vi} from 'vitest';
import {IncomingMessage,ServerResponse} from 'node:http';
import {Socket} from 'node:net';
import {createApp} from '../server/app';
it.each([
 ['pasted text',{kind:'text'}],['image text',{kind:'frame',frameId:'image-1',start:0,end:0}],
 ['audio transcript',{kind:'audio',start:1,end:4}],['video visible text',{kind:'frame',frameId:'frame-1',start:15,end:30}],
])('structures %s through the same HTTP route without retrieval',async(_label,metadata)=>{
 const unit={id:'u',text:'Explicit evidence. Explicit conclusion.',originalText:'Original text retained.',confirmed:false,...metadata};
 const raw={items:[{unitId:'u',passage:unit.text,evidence:'Explicit evidence.',reasoning:'',conclusion:'Explicit conclusion.',class:'other'}],morePossible:false};
 const request=vi.fn(async(_url:RequestInfo|URL,_init?:RequestInit)=>new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(raw)}]}]})));
 const {app,dispose}=createApp({OPENAI_API_KEY:'fixture-only',AI_AUDIT_ENABLED:'false'},request);
 const result=await new Promise<{status:number;body:any}>(resolve=>{
  const req=new IncomingMessage(new Socket());req.method='POST';req.url='/api/content/structure';const body=Buffer.from(JSON.stringify({language:'en',units:[unit]}));req.headers={host:'localhost','content-type':'application/json','content-length':String(body.length)};
  const res=new ServerResponse(req);res.end=((chunk:any)=>{resolve({status:res.statusCode,body:JSON.parse(String(chunk))});return res;}) as typeof res.end;app(req,res);req.push(body);req.push(null);
 });
 await dispose();expect(result.status).toBe(200);expect(result.body.items[0]).toMatchObject({evidence:'Explicit evidence.',reasoning:'',conclusion:'Explicit conclusion.',class:'other',unitId:'u'});expect(request).toHaveBeenCalledTimes(1);expect(String(request.mock.calls[0][0])).toBe('https://api.openai.com/v1/responses');
});
