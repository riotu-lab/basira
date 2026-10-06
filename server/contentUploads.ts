import {MEDIA_MAX_MB} from '../src/mediaLimits.js';
import {randomUUID} from 'node:crypto';
import {get,del,list} from '@vercel/blob';
import {handleUpload} from '@vercel/blob/client';
import type {Request} from 'express';
import {sealAvatarToken,openAvatarToken} from './avatarHandle.js';
import {ApiError} from './validation.js';
export const UPLOAD_MAX=MEDIA_MAX_MB*1024*1024;
const types=['audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/wav','audio/x-wav','audio/ogg','audio/webm','video/mp4','video/webm','video/quicktime'];
export function uploadGrant(ticket:unknown,secret:string){
 try{const v=JSON.parse(openAvatarToken(String(ticket),secret));if(!/^content-review\/\d+-[a-f0-9-]+$/.test(v.path)||!types.includes(v.mime)||!Number.isInteger(v.size)||v.size<1||v.size>UPLOAD_MAX)throw Error();return v as {path:string;mime:string;size:number};}catch{throw new ApiError('invalid_upload',400);}
}
export class ContentUploads{
 constructor(private token:string|undefined){}
 get configured(){return !!this.token;}
 private key(){if(!this.token)throw new ApiError('large_upload_unavailable',503);return this.token;}
 prepare(mime:string,size:number){const secret=this.key();if(!types.includes(mime)||!Number.isInteger(size)||size<1||size>UPLOAD_MAX)throw new ApiError('media_size_limit',413);const path=`content-review/${Date.now()}-${randomUUID()}`;return {path,ticket:sealAvatarToken(JSON.stringify({path,mime,size}),secret)};}
 async authorize(req:Request){const token=this.key();return handleUpload({request:req,body:req.body,token,onBeforeGenerateToken:async(path,payload)=>{const v=uploadGrant(payload,token);if(v.path!==path)throw new ApiError('invalid_upload');return {allowedContentTypes:[v.mime],maximumSizeInBytes:v.size,addRandomSuffix:false,allowOverwrite:false,validUntil:Date.now()+10*60000};}});}
 async consume<T>(ticket:unknown,signal:AbortSignal,run:(bytes:Buffer,mime:string)=>Promise<T>){
  const token=this.key(),grant=uploadGrant(ticket,token);try{const r=await get(grant.path,{access:'private',token,useCache:false,abortSignal:signal});if(!r||r.statusCode!==200||r.blob.size!==grant.size)throw new ApiError('invalid_upload');const reader=r.stream.getReader(),chunks:Buffer[]=[];let size=0;try{for(;;){const item=await reader.read();if(item.done)break;size+=item.value.length;if(size>grant.size||size>UPLOAD_MAX)throw new ApiError('media_size_limit',413);chunks.push(Buffer.from(item.value));}}finally{await reader.cancel().catch(()=>{});}if(size!==grant.size)throw new ApiError('invalid_upload');return await run(Buffer.concat(chunks),grant.mime);}finally{await del(grant.path,{token}).catch(()=>{console.warn('content_upload_cleanup_pending');});}
 }
 async cleanup(){const token=this.key();const page=await list({prefix:'content-review/',limit:100,token});const expired=page.blobs.filter(b=>b.uploadedAt.getTime()<Date.now()-3600000);if(expired.length)await del(expired.map(b=>b.url),{token});return expired.length;}
}
