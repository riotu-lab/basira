import {lookup} from 'node:dns/promises';
import {readlinkSync} from 'node:fs';

export function runtimeIdentity(){
  const namespace=(name:string)=>{try{return readlinkSync(`/proc/self/ns/${name}`);}catch{return 'unavailable';}};
  return {pid:process.pid,ppid:process.ppid,executable:process.execPath,cwd:process.cwd(),networkNamespace:namespace('net'),processNamespace:namespace('pid')};
}
// Fixed public destinations; no credentials, provider bodies, or environment dumps.
export async function connectivity(){
  return Promise.all(['api.liveavatar.com','api.openai.com'].map(async host=>{
    let dns:object;
    try{const addresses=await Promise.race([lookup(host,{all:true}),new Promise<never>((_,reject)=>setTimeout(()=>reject(Object.assign(new Error(),{code:'DNS_TIMEOUT'})),5000).unref())]);dns={ok:true,addresses:addresses.map(a=>a.address)};}
    catch(e){dns={ok:false,code:(e as NodeJS.ErrnoException).code||'DNS_FAILED'};}
    let https:object;
    try{const response=await fetch(`https://${host}/`,{signal:AbortSignal.timeout(8000),redirect:'error'});https={reachable:true,httpStatus:response.status};await response.body?.cancel();}
    catch(e){const error=e as Error&{cause?:{code?:string}};https={reachable:false,code:error.cause?.code||error.name};}
    return {host,dns,https};
  }));
}
