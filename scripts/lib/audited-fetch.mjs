import 'dotenv/config';
import {tsImport} from 'tsx/esm/api';
const {AiAudit}=await tsImport('../../server/aiAudit.ts',import.meta.url);
const {ApiError}=await tsImport('../../server/validation.ts',import.meta.url);
const audit=new AiAudit(process.env);
// Logs transport results; later semantic checks still live in each dataset job's checkpoints.
export async function auditedFetch(url,init){
 const provider=new URL(url).hostname;let response;
 try{return await audit.run('dataset.transport',{provider,validationScope:'transport_only'},async()=>{
  const started=performance.now();response=await fetch(url,init);
  await audit.capture(new URL(url).pathname,provider,init,response,Math.round(performance.now()-started));
  if(!response.ok)throw new ApiError('dataset_provider_http_error',502);
  return response;
 });}catch(error){
  // Preserve the caller's existing HTTP retry logic, but never swallow a persistence error.
  if(error?.code==='dataset_provider_http_error'&&response)return response;
  throw error;
 }
}
