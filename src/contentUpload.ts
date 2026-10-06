import {retainMedia} from './retainedMedia';
import {api,RequestError} from './api';
// Keep the original file in the report; only prepare the copy sent for analysis.
export async function analysisImage(file:Blob):Promise<Blob>{
 if(file.size<=3*1024*1024)return file;
 const bitmap=await createImageBitmap(file);try{const scale=Math.min(1,2560/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext('2d');if(!ctx)throw new RequestError('image_preparation_failed');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);for(const quality of [.92,.8,.65]){const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));if(blob&&blob.size<=3*1024*1024)return blob;}throw new RequestError('image_preparation_failed');}finally{bitmap.close();}
}
export async function postContentMedia(url:string,file:Blob,signal:AbortSignal):Promise<Response>{
 const reference=await retainMedia(file,{workflow:'content-or-training'});
 if(reference&&!file.type.startsWith('image/')){const target=new URL(url,location.origin),operation=target.pathname.includes('/visual/')?'visual':target.pathname.includes('speech-review')?'speech':target.pathname.split('/').pop();return fetch(`/api/content/media-retention/process/${operation}${target.search}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({handle:reference.handle}),signal});}
 if(file.type.startsWith('image/')){const prepared=await analysisImage(file);return fetch(url,{method:'POST',headers:{'Content-Type':prepared.type},body:prepared,signal});}
 if(file.size<=4*1024*1024||!import.meta.env.VITE_VERCEL_DEPLOYMENT)return fetch(url,{method:'POST',headers:{'Content-Type':file.type},body:file,signal});
 const grant=await api<{path:string;ticket:string}>('/api/content/uploads/prepare',{mime:file.type,size:file.size},signal);
 const {upload}=await import('@vercel/blob/client');await upload(grant.path,file,{access:'private',contentType:file.type.split(';')[0].trim(),handleUploadUrl:'/api/content/uploads/token',clientPayload:grant.ticket,multipart:true,abortSignal:signal});
 const target=new URL(url,location.origin),operation=target.pathname.includes('/visual/')?'visual':target.pathname.split('/').pop();
 return fetch(`/api/content/stored/${operation}${target.search}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket:grant.ticket}),signal});
}
