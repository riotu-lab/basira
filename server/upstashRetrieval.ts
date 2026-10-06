import {ApiError} from './validation.js';
export function upstashConfiguration(env:NodeJS.ProcessEnv){
 if(!env.UPSTASH_VECTOR_REST_URL&&!env.UPSTASH_VECTOR_REST_TOKEN)return null;
 try{
  const url=new URL(env.UPSTASH_VECTOR_REST_URL||'');
  if(url.protocol!=='https:'||!url.hostname.endsWith('.upstash.io')||url.username||url.password||url.pathname!=='/'||url.search||url.hash||!env.UPSTASH_VECTOR_REST_TOKEN)throw Error();
  return {url,token:env.UPSTASH_VECTOR_REST_TOKEN,namespace:env.UPSTASH_VECTOR_NAMESPACE||'basira-content-v1'};
 }catch{throw new ApiError('content_retrieval_not_configured',503);}
}
export async function queryUpstash(config:NonNullable<ReturnType<typeof upstashConfiguration>>,embeddings:number[][],sources:(string|null)[],signal:AbortSignal,request:typeof fetch){
 if(embeddings.length!==sources.length||embeddings.some(v=>!Array.isArray(v)||v.length!==3072||v.some(n=>!Number.isFinite(n))))throw new ApiError('invalid_retrieval_response',502);
 // Bound parallel requests and preserve input order; the overall deadline includes queue time.
 const deadline=AbortSignal.any([signal,AbortSignal.timeout(30000)]);
 const results:any[][]=new Array(embeddings.length);let next=0;
 await Promise.all(Array.from({length:Math.min(4,embeddings.length)},async()=>{
  while(next<embeddings.length){const i=next++;
   let response:Response;
   try{response=await request(new URL(`/query/${encodeURIComponent(config.namespace)}`,config.url),{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${config.token}`,'Content-Type':'application/json'},body:JSON.stringify({vector:embeddings[i],topK:3,includeMetadata:true,includeData:true,...(sources[i]?{filter:`source = '${sources[i]}'`}:{})}),signal:deadline});}catch{throw new ApiError('content_retrieval_unavailable',502);}
   if(!response.ok)throw new ApiError('content_retrieval_unavailable',502);
   let data:any;try{data=await response.json();}catch{throw new ApiError('invalid_retrieval_response',502);}
   if(!Array.isArray(data.result)||data.result.length>3)throw new ApiError('invalid_retrieval_response',502);
   results[i]=data.result.map((r:any)=>{
    if(typeof r.data!=='string'||!Number.isFinite(r.score)||r.score<0||r.score>1||!r.metadata||r.metadata.basira_corpus!=='islamthon-v1'||(sources[i]&&r.metadata.source!==sources[i]))throw new ApiError('invalid_retrieval_response',502);
    // Upstash normalizes cosine similarity to [0,1]; Chroma distance is 1-cosine.
    return {id:r.id,text:r.data.slice(0,6000),truncated:r.data.length>6000,metadata:r.metadata,distance:2*(1-r.score)};
   });
  }
 }));return {results};
}
