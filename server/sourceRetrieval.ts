import {createHash} from 'node:crypto';
import {McpClient,RetrievalError,retrievalError,type RetrievalProvider,type McpTool} from './mcpClient.js';
import type {ArgumentReview,RetrievalStatus} from '../src/argumentReviewTypes.js';
import type {Reference} from '../src/contentReviewTypes.js';
import type {ModelProvider} from './model.js';
const ALLOWED={islamic_content:['search','fetch','get_quran_verses','get_hadith','get_library_item'],turath:['turath_find','turath_open']};
const OPENED=new Set(['fetch','get_quran_verses','get_hadith','turath_open']);
export type RetrievalPacket={id:string;tool:string;result:unknown};
/** Collect verbatim values, including JSON nested inside MCP text blocks. Never follow returned URLs. */
export function sourceStrings(value:unknown,depth=0):string[]{
 if(depth>12)return [];
 if(typeof value==='string'){let extra:string[]=[];if(value.startsWith('{')||value.startsWith('['))try{extra=sourceStrings(JSON.parse(value),depth+1);}catch{}return [value,...extra];}
 if(Array.isArray(value))return value.flatMap(v=>sourceStrings(v,depth+1));
 if(value&&typeof value==='object')return Object.values(value).flatMap(v=>sourceStrings(v,depth+1));return [];
}
function sourceUrls(strings:string[]){return new Set(strings.flatMap(s=>s.match(/https:\/\/[^\s<>"\\)\]]+/g)||[]));}
export function validatedSources(raw:any,packets:RetrievalPacket[],items:ArgumentReview[],provider:RetrievalProvider):{reference:Reference;argumentIds:string[]}[]{
 if(!Array.isArray(raw?.references)||raw.references.length>8)throw new RetrievalError('invalid_source_evidence');
 return raw.references.map((r:any)=>{
  const packet=packets.find(p=>p.id===r.packetId&&OPENED.has(p.tool));
  const strings=packet?sourceStrings(packet.result):[];
  if(!packet||typeof r.url!=='string'||!sourceUrls(strings).has(r.url)||typeof r.excerpt!=='string'||r.excerpt.trim().length<20||r.excerpt.length>3500||!strings.some(s=>s.includes(r.excerpt))||typeof r.title!=='string'||!r.title.trim()||!strings.some(s=>s.includes(r.title))||!Array.isArray(r.argumentIds)||!r.argumentIds.length||r.argumentIds.some((id:any)=>!items.some(i=>i.id===id)))throw new RetrievalError('invalid_source_evidence');
  const url=new URL(r.url);if(url.username||url.password)throw new RetrievalError('invalid_source_evidence');
  const id='mcp-'+createHash('sha256').update(provider+'\n'+r.url+'\n'+r.excerpt).digest('hex').slice(0,20);
  return {reference:{id,url:r.url,title:r.title,excerpt:r.excerpt,provider:provider==='turath'?'Turath AI':'Islamic Content',scope:'published_text',retrievedAt:new Date().toISOString()},argumentIds:r.argumentIds};
 });
}
export function validateToolPlan(plan:any,tools:McpTool[],packets:RetrievalPacket[]){
 if(plan?.done===true)return null;
 if(plan?.done!==false||typeof plan.name!=='string'||typeof plan.argumentsJSON!=='string'||plan.argumentsJSON.length>10000||!tools.some(t=>t.name===plan.name))throw new RetrievalError('invalid_tool_plan');
 let args:any;try{args=JSON.parse(plan.argumentsJSON);}catch{throw new RetrievalError('invalid_tool_plan');}
 if(!args||typeof args!=='object'||Array.isArray(args))throw new RetrievalError('invalid_tool_plan');
 const known=sourceUrls(packets.flatMap(p=>sourceStrings(p.result)));
 for(const s of sourceStrings(args))if(/^https?:\/\//.test(s)&&!known.has(s))throw new RetrievalError('unretrieved_resource_url');
 return {name:plan.name,args};
}
export class SourceRetrieval {
 constructor(private env:NodeJS.ProcessEnv,private model:ModelProvider,private request:typeof fetch=fetch){}
 get enabled(){return this.env.CONTENT_RETRIEVAL_ENABLED!=='false';}
 async enrich(items:ArgumentReview[],signal:AbortSignal):Promise<{items:ArgumentReview[];statuses:RetrievalStatus[]}>{
  if(!this.enabled||!items.length)return {items,statuses:[]};
  const statuses:RetrievalStatus[]=[];
  const providers=(['islamic_content','turath'] as const);
  const outcomes=await Promise.all(providers.map(async provider=>{
   // Batch argument chains per provider, but keep each session/research ID private to this review.
   const client=new McpClient(provider,this.env[provider==='turath'?'TURATH_MCP_TOKEN':'ISLAMIC_CONTENT_MCP_TOKEN']||'',this.request);
   const budget=AbortSignal.any([signal,AbortSignal.timeout(50000)]);const packets:RetrievalPacket[]=[];
   try{
    const discovery=await client.connect(budget);
    const tools=discovery.tools.filter(t=>ALLOWED[provider].includes(t.name));
    if(!tools.length)throw new RetrievalError('unsupported_tools');
    const plans:unknown[]=[];let finished=false;
    for(let call=0;call<4;call++){
     const plan=await this.model.planSourceRetrieval(provider,items,tools,discovery.instructions,plans,budget);
     const selected=validateToolPlan(plan,tools,packets);if(!selected){finished=true;break;}
     const result=await client.call(selected.name,selected.args,budget);
     // Oversized evidence is an explicit partial failure; don't truncate inside a quotation.
     if(JSON.stringify(result).length>60000||JSON.stringify(plans).length+JSON.stringify(result).length>90000)throw new RetrievalError('evidence_budget_exceeded');
     const packet={id:`${provider}-${call+1}`,tool:selected.name,result};packets.push(packet);plans.push({...packet,arguments:selected.args});
    }
    const opened=packets.filter(p=>OPENED.has(p.tool));
    const references=opened.length?validatedSources(await this.model.selectRetrievedSources(items,opened,budget),opened,items,provider):[];
    return {provider,references,status:references.length?(finished?'available':'limited'):'no_evidence'} as const;
   }catch(e){if(signal.aborted)throw e;return {provider,references:[],status:'failed',error:retrievalError(e)} as const;}
   finally{await client.close();}
  }));
  const enriched=items.map(item=>({...item,references:[...item.references]}));
  for(const outcome of outcomes){
   statuses.push({provider:outcome.provider,status:outcome.status,...('error' in outcome?{error:outcome.error}:{})});
   for(const {reference,argumentIds} of outcome.references)for(const item of enriched)if(argumentIds.includes(item.id)&&!item.references.some(r=>r.id===reference.id))item.references.push(reference);
  }
  return {items:enriched,statuses};
 }
}
