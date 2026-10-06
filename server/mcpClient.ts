/** Bounded Streamable HTTP client for the two explicitly approved read-only services. */
export const MCP_ENDPOINTS={islamic_content:'https://mcp.islamiccontent.org/mcp',turath:'https://api.turath.ai/mcp'} as const;
export type RetrievalProvider=keyof typeof MCP_ENDPOINTS;
export type McpTool={name:string;description?:string;inputSchema:Record<string,unknown>};
export class RetrievalError extends Error {constructor(public code:string){super(code);}}
export function retrievalError(error:unknown):string{
 if(error instanceof RetrievalError)return error.code;
 const e=error as {name?:string;cause?:{code?:string}};
 if(['EAI_AGAIN','ENOTFOUND'].includes(e?.cause?.code||''))return 'network_dns';
 if(e?.name==='AbortError'||e?.name==='TimeoutError')return 'timeout_or_cancelled';
 return 'network_or_response';
}
const LIMIT=1024*1024;
export class McpClient {
 private sequence=0;private session?:string;private protocol='2025-06-18';
 constructor(readonly provider:RetrievalProvider,private token='',private request:typeof fetch=fetch){}
 private headers(){return {'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':this.protocol,...(this.token?{Authorization:`Bearer ${this.token}`} :{}),...(this.session?{'Mcp-Session-Id':this.session}:{})};}
 private async send(message:unknown,signal:AbortSignal){
  let response:Response;
  try{response=await this.request(MCP_ENDPOINTS[this.provider],{method:'POST',redirect:'error',headers:this.headers(),body:JSON.stringify(message),signal:AbortSignal.any([signal,AbortSignal.timeout(15000)])});}
  catch(e){throw new RetrievalError(retrievalError(e));}
  if(!response.ok){await response.body?.cancel();throw new RetrievalError([401,403].includes(response.status)?'authentication_or_access':response.status===429?'rate_limited':response.status===404&&this.session?'session_expired':`http_${response.status}`);}
  const session=response.headers.get('mcp-session-id');if(session){if(!/^[\x21-\x7e]{1,256}$/.test(session))throw new RetrievalError('invalid_session');this.session=session;}
  return response;
 }
 private async rpc(method:string,params:unknown,signal:AbortSignal){
  const id=++this.sequence;
  try{
   const response=await this.send({jsonrpc:'2.0',id,method,params},signal);
   if(!response.body)throw new RetrievalError('invalid_response');
   const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',bytes=0;
   const sse=response.headers.get('content-type')?.includes('text/event-stream');
   const accept=(message:any)=>{
    if(message?.jsonrpc!=='2.0'||message.id!==id||message.method)throw new RetrievalError('invalid_response');
    if(message.error)throw new RetrievalError('rpc_error');
    if(!('result' in message))throw new RetrievalError('invalid_response');return message.result;
   };
   try{
    while(true){
     const {done,value}=await reader.read();if(value){bytes+=value.byteLength;if(bytes>LIMIT)throw new RetrievalError('response_too_large');buffer+=decoder.decode(value,{stream:true});}
     if(done)buffer+=decoder.decode();
     if(sse){
      buffer=buffer.replace(/\r\n/g,'\n');let boundary;
      while((boundary=buffer.indexOf('\n\n'))>=0){
       const event=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);
       const data=event.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(!data)continue;
       const message=JSON.parse(data);if(message.id===id)return accept(message);
       if(message.id!==undefined&&message.method)throw new RetrievalError('unsupported_server_request');
      }
     }
     if(done){if(sse)throw new RetrievalError('incomplete_response');return accept(JSON.parse(buffer));}
    }
   }finally{await reader.cancel().catch(()=>{});}
  }catch(e){if(signal.aborted)await this.notify('notifications/cancelled',{requestId:id,reason:'Review cancelled'},AbortSignal.timeout(1000)).catch(()=>{});throw e instanceof RetrievalError?e:new RetrievalError(retrievalError(e));}
 }
 private async notify(method:string,params:unknown,signal:AbortSignal){const response=await this.send({jsonrpc:'2.0',method,params},signal);await response.body?.cancel();}
 async connect(signal:AbortSignal):Promise<{tools:McpTool[];instructions:string}>{
  const initial=await this.rpc('initialize',{protocolVersion:this.protocol,capabilities:{},clientInfo:{name:'basira',version:'1.0'}},signal);
  if(!['2025-03-26','2025-06-18'].includes(initial?.protocolVersion))throw new RetrievalError('unsupported_protocol');
  this.protocol=initial.protocolVersion;
  await this.notify('notifications/initialized',{},signal);
  const tools:McpTool[]=[],seen=new Set<string>();let cursor:string|undefined;
  for(let page=0;page<5;page++){
   const result=await this.rpc('tools/list',cursor?{cursor}:{},signal);
   if(!Array.isArray(result?.tools)||result.tools.some((t:any)=>typeof t?.name!=='string'||!t.inputSchema||typeof t.inputSchema!=='object'))throw new RetrievalError('invalid_tool_schema');
   tools.push(...result.tools);if(tools.length>100)throw new RetrievalError('too_many_tools');
   if(!result.nextCursor)return {tools,instructions:typeof initial.instructions==='string'?initial.instructions.slice(0,8000):''};
   if(typeof result.nextCursor!=='string'||seen.has(result.nextCursor))throw new RetrievalError('invalid_tool_cursor');cursor=result.nextCursor;seen.add(result.nextCursor);
  }
  throw new RetrievalError('tool_pagination_limit');
 }
 async call(name:string,args:Record<string,unknown>,signal:AbortSignal){
  const result=await this.rpc('tools/call',{name,arguments:args},signal);
  if(!result||result.isError)throw new RetrievalError('tool_failed');
  return result;
 }
 async close(){
  if(!this.session)return;
  try{const response=await this.request(MCP_ENDPOINTS[this.provider],{method:'DELETE',redirect:'error',headers:this.headers(),signal:AbortSignal.timeout(2000)});await response.body?.cancel();}catch{/* Best-effort release; never replace the review with a cleanup error. */}finally{this.session=undefined;}
 }
}
