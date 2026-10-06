// @vitest-environment node
import {describe,it,expect,vi} from 'vitest';
import {McpClient,MCP_ENDPOINTS,RetrievalError} from '../server/mcpClient';
import {SourceRetrieval,validatedSources,validateToolPlan,sourceStrings} from '../server/sourceRetrieval';
import {prepareArguments,validateArgumentJudgments} from '../server/argumentReview';
import type {ModelProvider} from '../server/model';
const signal=()=>new AbortController().signal;
const json=(id:number,result:unknown,headers={})=>new Response(JSON.stringify({jsonrpc:'2.0',id,result}),{headers:{'Content-Type':'application/json',...headers}});
const tools=[{name:'search',inputSchema:{type:'object'}},{name:'fetch',inputSchema:{type:'object'}}];
function fixtureRequest(){return vi.fn(async(_url:any,init:any)=>{
 if(init.method==='DELETE')return new Response(null,{status:204});
 const b=JSON.parse(init.body);if(b.method==='initialize')return json(b.id,{protocolVersion:'2025-06-18',instructions:'Open sources before citing.'},{'mcp-session-id':'fixture-session'});
 if(b.method==='notifications/initialized')return new Response(null,{status:202});
 if(b.method==='tools/list')return json(b.id,{tools});
 return json(b.id,{content:[{type:'text',text:'Fixture opened content'}]});
});}
describe('MCP HTTP protocol fixtures — no external services',()=>{
 it('initializes, discovers tools, carries session/version, and deletes the session',async()=>{
  const request=fixtureRequest(),client=new McpClient('islamic_content','private-test-token',request);
  expect((await client.connect(signal())).tools).toEqual(tools);await client.call('search',{query:'test'},signal());await client.close();
  const last=request.mock.calls.at(-1)!;expect(last[1].method).toBe('DELETE');expect(last[1].headers['Mcp-Session-Id']).toBe('fixture-session');
  expect(request.mock.calls[2][1].headers['MCP-Protocol-Version']).toBe('2025-06-18');expect(request.mock.calls[0][1].redirect).toBe('error');
 });
 it('reads fragmented SSE, ignores notifications, and cancels the response stream after the result',async()=>{
  const request=fixtureRequest();let cancelled=false;
  request.mockImplementationOnce(async()=>{
   const text='data: '+JSON.stringify({jsonrpc:'2.0',method:'notifications/progress',params:{}})+'\n\n'+'data: '+JSON.stringify({jsonrpc:'2.0',id:1,result:{protocolVersion:'2025-06-18'}})+'\n\n';
   return new Response(new ReadableStream({start(c){for(const piece of [text.slice(0,19),text.slice(19)])c.enqueue(new TextEncoder().encode(piece));},cancel(){cancelled=true;}}),{headers:{'Content-Type':'text/event-stream'}});
  });
  const client=new McpClient('turath','',request);expect((await client.connect(signal())).tools).toHaveLength(2);expect(cancelled).toBe(true);
 });
 it.each([401,403,429])('categorizes HTTP %s and does not expose error bodies',async status=>{
  const client=new McpClient('turath','',vi.fn(async()=>new Response('sensitive diagnostic',{status})));
  await expect(client.connect(signal())).rejects.toThrow(status===429?'rate_limited':'authentication_or_access');
 });
 it('classifies DNS errors',async()=>{
  const client=new McpClient('turath','',vi.fn(async()=>{throw new TypeError('fetch failed',{cause:{code:'EAI_AGAIN'}});}));
  await expect(client.connect(signal())).rejects.toThrow('network_dns');
 });
 it('rejects repeated pagination cursors',async()=>{
  const request=fixtureRequest();request.mockImplementation(async(_url,init)=>{const b=JSON.parse(init.body);if(b.method==='initialize')return json(b.id,{protocolVersion:'2025-06-18'});if(b.method==='notifications/initialized')return new Response(null,{status:202});return json(b.id,{tools,nextCursor:'repeat'});});
  await expect(new McpClient('turath','',request).connect(signal())).rejects.toThrow('invalid_tool_cursor');
 });
 it('rejects oversized and mismatched protocol messages',async()=>{
  await expect(new McpClient('turath','',vi.fn(async()=>new Response('x'.repeat(1024*1024+1)))).connect(signal())).rejects.toThrow('response_too_large');
  await expect(new McpClient('turath','',vi.fn(async()=>json(99,{}))).connect(signal())).rejects.toThrow('invalid_response');
 });
});
const passage='A supplied quotation followed by its stated interpretation.';
const items=()=>prepareArguments([{unitId:'u1',passage,evidenceKind:'scholarly',evidence:'A supplied quotation',reasoning:'its stated interpretation',conclusion:''}],[{id:'u1',kind:'text',text:passage,originalText:passage,confirmed:true}],[],'en');
const source={title:'Source fixture',url:'https://example.org/book/page/4',text:'This exact supporting passage is synthetic test evidence.'};
const packets=[{id:'p1',tool:'fetch',result:{structuredContent:source}}];
const selected=()=>({references:[{packetId:'p1',title:source.title,url:source.url,excerpt:source.text,argumentIds:['argument-1']}]});
describe('Retrieved source provenance',()=>{
 it('accepts only exact opened text, title and URL and assigns server-owned citation IDs',()=>{
  const refs=validatedSources(selected(),packets,items(),'turath');expect(refs[0].reference.id).toMatch(/^mcp-/);expect(refs[0].reference.excerpt).toBe(source.text);
 });
 it.each(['excerpt','url','title','packetId'])('rejects invented %s',field=>{
  const raw=selected();(raw.references[0] as any)[field]='invented';expect(()=>validatedSources(raw,packets,items(),'turath')).toThrow('invalid_source_evidence');
 });
 it('does not cite search snippets as opened sources or attach references to unknown arguments',()=>{
  expect(()=>validatedSources(selected(),[{...packets[0],tool:'search'}],items(),'turath')).toThrow();
  expect(()=>validatedSources(selected(),[{...packets[0],tool:'get_library_item'}],items(),'islamic_content')).toThrow();
  const raw=selected();raw.references[0].argumentIds=['other'];expect(()=>validatedSources(raw,packets,items(),'turath')).toThrow();
 });
 it('rejects unadvertised tools and arbitrary model-generated fetch URLs',()=>{
  expect(()=>validateToolPlan({done:false,name:'write',argumentsJSON:'{}'},tools,[])).toThrow();
  expect(()=>validateToolPlan({done:false,name:'fetch',argumentsJSON:'{"url":"https://example.org/unseen"}'},tools,packets)).toThrow();
  expect(validateToolPlan({done:false,name:'fetch',argumentsJSON:JSON.stringify({url:source.url})},tools,packets)?.name).toBe('fetch');
 });
 it('preserves structured JSON nested in MCP text without inventing normalized quotations',()=>{expect(sourceStrings({content:[{type:'text',text:JSON.stringify(source)}]})).toContain(source.text);});
});
describe('Two-provider orchestration with mocked transport/model',()=>{
 it('fetches sources with isolated provider sessions and attaches them to actual argument IDs',async()=>{
  const histories:string[][]=[];const request=fixtureRequest();
  request.mockImplementation(async(url,init)=>{
   if(init.method==='DELETE')return new Response(null,{status:204});const b=JSON.parse(init.body);const turath=url===MCP_ENDPOINTS.turath;
   if(b.method==='initialize')return json(b.id,{protocolVersion:'2025-06-18'},{'mcp-session-id':turath?'session-t':'session-i'});
   if(b.method==='notifications/initialized')return new Response(null,{status:202});
   if(b.method==='tools/list')return json(b.id,{tools:turath?[{name:'turath_find',inputSchema:{}},{name:'turath_open',inputSchema:{}}]:tools});
   return json(b.id,{structuredContent:source});
  });
  const model={planSourceRetrieval:vi.fn(async(provider,_items,_tools,_instructions,history)=>{
   histories.push(history.map((h:any)=>h.id));const names=provider==='turath'?['turath_find','turath_open']:['search','fetch'];
   return {done:history.length===2,name:names[history.length]||'',argumentsJSON:history.length===0?'{"query":"quotation"}':JSON.stringify({url:source.url})};
  }),selectRetrievedSources:vi.fn(async(_items,opened)=>({references:[{...selected().references[0],packetId:opened[0].id}]}))} as unknown as ModelProvider;
  const result=await new SourceRetrieval({},model,request).enrich(items(),signal());
  expect(result.items[0].references).toHaveLength(2);expect(result.statuses.map(s=>s.status)).toEqual(['available','available']);
  expect(request.mock.calls.filter(c=>c[1].method==='DELETE')).toHaveLength(2);
  expect(histories.every(h=>h.every(id=>id.startsWith('turath-'))||h.every(id=>id.startsWith('islamic_content-')))).toBe(true);
 });
 it('preserves local findings when both services fail; no scripted citations',async()=>{
  const before=items();before[0].references=[{id:'local',title:'Existing source',url:'https://tanzil.net/#1:1',excerpt:'Existing text',provider:'Tanzil'}];
  const request=vi.fn(async()=>{throw new TypeError('fetch failed',{cause:{code:'EAI_AGAIN'}});});
  const result=await new SourceRetrieval({},{} as ModelProvider,request).enrich(before,signal());
  expect(result.items).toEqual(before);expect(result.statuses.every(s=>s.error==='network_dns')).toBe(true);
 });
 it('allows attributed comparison from external text, but keeps absent conclusions absent',()=>{
  const enriched=items();enriched[0].references=[validatedSources(selected(),packets,enriched,'turath')[0].reference];
  const part={status:'supported',explanation:'Within the source author’s position.',referenceIds:[enriched[0].references[0].id]};
  const report=validateArgumentJudgments({items:[{id:'argument-1',evidence:part,reasoning:part,conclusion:part}]},enriched,'en');
  expect(report.retrieval).toBe('local_and_mcp');expect(report.items[0].reasoning.status).toBe('supported');expect(report.items[0].conclusion.status).toBe('insufficient_evidence');
 });
 it('can disable external requests explicitly',async()=>{
  const request=vi.fn();expect((await new SourceRetrieval({CONTENT_RETRIEVAL_ENABLED:'false'},{} as ModelProvider,request).enrich(items(),signal())).statuses).toEqual([]);expect(request).not.toHaveBeenCalled();
 });
});
