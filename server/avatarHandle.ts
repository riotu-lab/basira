import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import {ApiError} from './validation.js';
// Authenticated encryption keeps the provider token private while allowing any
// serverless instance to stop the session. Key rotation invalidates old handles.
function key(secret:string){return createHash('sha256').update('basira-avatar-stop-v1:').update(secret).digest();}
export function sealAvatarToken(token:string,secret:string){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(secret),iv);
 const encrypted=Buffer.concat([cipher.update(JSON.stringify({token,expires:Date.now()+10*60*1000})),cipher.final()]);
 return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64url');
}
export function openAvatarToken(handle:string,secret:string){
 try{
  const data=Buffer.from(handle,'base64url'),decipher=createDecipheriv('aes-256-gcm',key(secret),data.subarray(0,12));
  decipher.setAuthTag(data.subarray(12,28));
  const value=JSON.parse(Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]).toString());
  if(typeof value.token!=='string'||!Number.isFinite(value.expires)||value.expires<Date.now())throw Error();
  return value.token as string;
 }catch{throw new ApiError('invalid_avatar_handle',400);}
}
