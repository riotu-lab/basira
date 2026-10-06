// Production retrieval is separate from the local Chroma process.
export function productionRetrievalValues(local){
 if(local.UPSTASH_VECTOR_REST_URL||local.UPSTASH_VECTOR_REST_TOKEN){
  let parsed;try{parsed=new URL(local.UPSTASH_VECTOR_REST_URL);}catch{throw Error('Configure the Upstash Vector HTTPS endpoint and token.');}
  if(parsed.protocol!=='https:'||!parsed.hostname.endsWith('.upstash.io')||parsed.username||parsed.password||parsed.pathname!=='/'||parsed.search||parsed.hash||!local.UPSTASH_VECTOR_REST_TOKEN)throw Error('Configure the Upstash Vector HTTPS endpoint and token.');
  return {UPSTASH_VECTOR_REST_URL:parsed.origin,UPSTASH_VECTOR_REST_TOKEN:local.UPSTASH_VECTOR_REST_TOKEN,UPSTASH_VECTOR_NAMESPACE:local.UPSTASH_VECTOR_NAMESPACE||'basira-content-v1'};
 }
 const url=local.CONTENT_RAG_URL_PROD;
 const token=local.CONTENT_RAG_TOKEN_PROD;
 if(!url&&!token)return {};
 if(!url||!token||token.length<32)throw Error('Production retrieval requires CONTENT_RAG_URL_PROD and a token of at least 32 characters.');
 let parsed;try{parsed=new URL(url);}catch{throw Error('Production retrieval URL must be a public HTTPS origin.');}
 if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.pathname!=='/'||parsed.search||parsed.hash||['localhost','127.0.0.1','[::1]'].includes(parsed.hostname)||parsed.hostname.endsWith('.localhost'))throw Error('Production retrieval URL must be a public HTTPS origin.');
 return {CONTENT_RAG_URL:parsed.origin,CONTENT_RAG_TOKEN:token};
}
