export class RequestError extends Error {
  constructor(public code:string,public retryAfterSeconds?:number){super(code);}
}
export async function api<T>(path:string,body?:unknown,signal?:AbortSignal,timeoutMs=60000):Promise<T>{
  let response:Response;
  try{response=await fetch(path,{method:body===undefined?'GET':'POST',headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(timeoutMs)]):AbortSignal.timeout(timeoutMs)});}
  catch(error){if(signal?.aborted)throw error;throw new RequestError('connection_failed');}
  if(!response.ok){const result=await response.json().catch(()=>({}));throw new RequestError(result.error||'connection_failed',Number(result.retryAfterSeconds||response.headers.get('Retry-After'))||undefined);}
  return response.json();
}
export async function speech(text:string,language:string,signal:AbortSignal,sessionId?:string){
  const response=await fetch('/api/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,language,sessionId}),signal:AbortSignal.any([signal,AbortSignal.timeout(60000)])});
  if(!response.ok)throw new RequestError((await response.json()).error||'voice_failed');
  return response.arrayBuffer();
}
