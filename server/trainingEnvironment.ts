import {randomUUID} from 'node:crypto';
import {ApiError} from './validation.js';
export type TrainingEnvironment='development'|'production'|'preview';
// Local NODE_ENV=production is a build mode, not permission to use production sessions.
export function trainingEnvironment(env:NodeJS.ProcessEnv):TrainingEnvironment {
  if(env.VERCEL)return env.VERCEL_ENV==='preview'?'preview':'production';
  const value=env.BASIRA_ENV||'development';
  if(!['development','production','preview'].includes(value))throw new ApiError('training_environment_invalid',503);
  return value as TrainingEnvironment;
}
export function trainingScope(env:NodeJS.ProcessEnv){
  const environment=trainingEnvironment(env);
  const name=environment==='development'?(env.BASIRA_DEV_INSTANCE||'local'):environment==='preview'?(env.BASIRA_PREVIEW_INSTANCE||'preview'):'';
  if(name&&!/^[a-z0-9_-]{1,40}$/.test(name))throw new ApiError('training_environment_invalid',503);
  return name?`${environment}-${name}`:environment;
}
export function trainingRouting(env:NodeJS.ProcessEnv){
  const environment=trainingEnvironment(env),suffix=environment==='development'?'DEV':environment==='production'?'PROD':'PREVIEW';
  // Legacy names are accepted only in production; local development never falls back to them.
  const publicUrl=env[`BASIRA_PUBLIC_URL_${suffix}`]||(environment==='production'?env.BASIRA_PUBLIC_URL:undefined);
  const palId=env[`TAVUS_TRAINING_PAL_ID_${suffix}`]||(environment==='production'?env.TAVUS_TRAINING_PAL_ID:undefined);
  if(publicUrl){let url:URL;try{url=new URL(publicUrl);}catch{throw new ApiError('training_environment_invalid',503);}
    if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new ApiError('training_environment_invalid',503);
    if(environment==='development'&&env.BASIRA_PUBLIC_URL_PROD&&url.origin===new URL(env.BASIRA_PUBLIC_URL_PROD).origin)throw new ApiError('training_environment_mismatch',503);
  }
  if(environment==='development'&&palId&&(palId===env.TAVUS_TRAINING_PAL_ID_PROD||palId===env.TAVUS_TRAINING_PAL_ID))throw new ApiError('training_environment_mismatch',503);
  return {environment,scope:trainingScope(env),publicUrl:publicUrl?new URL(publicUrl).origin:undefined,palId};
}
// Identifies the actual running local backend; prevents a tunnel pointing at another process.
export const trainingRuntimeInstance=randomUUID();
