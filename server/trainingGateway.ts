import {trainingScope} from './trainingEnvironment.js';
import {randomUUID,createHmac,timingSafeEqual} from 'node:crypto';
import {ApiError} from './validation.js';
export function trainingGatewayKey(env:NodeJS.ProcessEnv){if(!env.TAVUS_API_KEY)throw new ApiError('avatar_not_configured',503);return createHmac('sha256',env.TAVUS_API_KEY).update('basira-training-gateway-v2:'+trainingScope(env)).digest('hex');}
export function trainingGatewayAuth(header:string|undefined,env:NodeJS.ProcessEnv){const wanted=Buffer.from(`Bearer ${trainingGatewayKey(env)}`),got=Buffer.from(header||'');if(got.length!==wanted.length||!timingSafeEqual(got,wanted))throw new ApiError('unauthorized',401);}
export function trainingContext(token:string,callId:string=randomUUID()){return `BASIRA_TRAINING_SESSION=${token} BASIRA_CALL=${callId}`;}
export function trainingToken(messages:unknown){if(!Array.isArray(messages))throw new ApiError('invalid_transcript');const tokens=new Set<string>();for(const m of messages)if(['system','developer'].includes(m?.role)&&typeof m.content==='string')for(const hit of m.content.matchAll(/BASIRA_TRAINING_SESSION=([a-f0-9]{64})/g))tokens.add(hit[1]);if(tokens.size!==1)throw new ApiError('training_session_missing',400);return [...tokens][0];}

export function trainingCallId(messages:any[]){return messages.filter(m=>["system","developer"].includes(m?.role)&&typeof m.content==="string").map(m=>m.content.match(/BASIRA_CALL=([a-f0-9-]{36})/)?.[1]).find(Boolean)||"legacy";}
