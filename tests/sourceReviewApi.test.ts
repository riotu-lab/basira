// @vitest-environment node
// Full Express review route with mocked model + MCP responses; no live network.
import {IncomingMessage,ServerResponse} from 'node:http';
import {Socket} from 'node:net';
import {afterEach,it,expect,vi} from 'vitest';
import {createApp} from '../server/app';
import {ModelProvider} from '../server/model';
const passage='A scholarly quotation supports this explanation.';
const reference={title:'Fixture commentary',url:'https://example.org/commentary/3',text:'This is a synthetic supporting passage used only by the test.'};
const unit={id:'text-1',kind:'text',text:passage,originalText:passage,confirmed:true};
function modelFixtures(){
 vi.spyOn(ModelProvider.prototype,'extractContent').mockResolvedValue({claims:[],morePossible:false});
 vi.spyOn(ModelProvider.prototype,'extractArguments').mockResolvedValue({items:[{unitId:unit.id,passage,evidenceKind:'scholarly',evidence:'A scholarly quotation',reasoning:'supports this explanation',conclusion:''}]});
 vi.spyOn(ModelProvider.prototype,'planSourceRetrieval').mockImplementation(async(provider,_items,_tools,_instructions,history)=>({done:history.length===2,name:provider==='turath'?(history.length?'turath_open':'turath_find'):(history.length?'fetch':'search'),argumentsJSON:history.length?'{"id":"source-3"}':'{"query":"quotation"}'}));
 vi.spyOn(ModelProvider.prototype,'selectRetrievedSources').mockImplementation(async(_items,packets:any[])=>({references:[{packetId:packets[0].id,title:reference.title,url:reference.url,excerpt:reference.text,argumentIds:['argument-1']}]}));
 vi.spyOn(ModelProvider.prototype,'judgeArguments').mockImplementation(async(_language,items:any[])=>({items:items.map(item=>{const part={status:'supported',explanation:'Fixture source supports the stated position.',referenceIds:item.references.map((r:any)=>r.id)};return {id:item.id,evidence:part,reasoning:part,conclusion:part};})}));
}
async function invoke(request:typeof fetch){
 const {app,dispose}=createApp({OPENAI_API_KEY:'fixture-only'},request);
 return new Promise<any>(resolve=>{
  const req=new IncomingMessage(new Socket());req.method='POST';req.url='/api/content/review';
  const body=Buffer.from(JSON.stringify({language:'en',units:[unit],includeArguments:true}));
  req.headers={host:'localhost:3000','content-type':'application/json','content-length':String(body.length)};
  const res=new ServerResponse(req);res.end=((chunk:any)=>{void dispose();resolve({status:res.statusCode,body:JSON.parse(String(chunk))});return res;}) as typeof res.end;
  app(req,res);req.push(body);req.push(null);
 });
}
afterEach(()=>vi.restoreAllMocks());
it('content → extraction → both MCP services → evidence comparison returns source-backed argument report',async()=>{
 modelFixtures();
 const request=vi.fn(async(url:any,init:any)=>{
  if(init.method==='DELETE')return new Response(null,{status:204});
  const message=JSON.parse(init.body),turath=String(url).includes('turath.ai');
  if(message.method==='notifications/initialized')return new Response(null,{status:202});
  const result=message.method==='initialize'?{protocolVersion:'2025-06-18'}:message.method==='tools/list'?{tools:(turath?['turath_find','turath_open']:['search','fetch']).map(name=>({name,inputSchema:{type:'object'}}))}:{structuredContent:reference};
  return new Response(JSON.stringify({jsonrpc:'2.0',id:message.id,result}),{headers:{'content-type':'application/json','mcp-session-id':turath?'turath-test':'islamic-test'}});
 });
 const response=await invoke(request);expect(response.status).toBe(200);
 const report=response.body.arguments;expect(report.retrieval).toBe('local_and_mcp');expect(report.items[0].passage).toBe(passage);
 expect(report.items[0].references).toHaveLength(2);expect(report.items[0].references[0].excerpt).toBe(reference.text);
 expect(report.items[0].reasoning.status).toBe('supported');expect(report.items[0].conclusion.status).toBe('insufficient_evidence');
 expect(request.mock.calls.filter(c=>c[1].method==='DELETE')).toHaveLength(2);
});
it('MCP outage yields explicit retrieval failure and insufficient evidence, not a fabricated review',async()=>{
 modelFixtures();const response=await invoke(vi.fn(async()=>{throw new TypeError('fetch failed',{cause:{code:'EAI_AGAIN'}});}));
 expect(response.status).toBe(200);expect(response.body.arguments.retrievalStatuses.every((s:any)=>s.error==='network_dns')).toBe(true);
 expect(response.body.arguments.items[0].references).toEqual([]);expect(response.body.arguments.items[0].evidence.status).toBe('insufficient_evidence');
 expect(ModelProvider.prototype.judgeArguments).not.toHaveBeenCalled();
});
