import {describe,it,expect} from 'vitest';
// @ts-expect-error Local container launcher is a standalone JavaScript module.
import {localEnvironment} from '../docker/app_entry.mjs';
describe('local Docker isolation',()=>{
 it('never forwards production storage, callback or frontend settings',()=>{
  const env=localEnvironment({OPENAI_API_KEY:'own-key',VERCEL:'1',UPSTASH_VECTOR_REST_TOKEN:'private',TAVUS_TRAINING_PAL_ID_PROD:'production',TAVUS_TRAINING_PAL_ID_DEV:'host-dev',CONTENT_RAG_URL:'https://production',VITE_SECRET:'private'},'x'.repeat(32),false);
  expect(env.OPENAI_API_KEY).toBe('own-key');expect(env.BASIRA_ENV).toBe('development');
  expect(env.CONTENT_RAG_URL).toBe('http://retrieval:8000');expect(env.TRAINING_STORE).toBe('sqlite');
  for(const key of ['VERCEL','UPSTASH_VECTOR_REST_TOKEN','TAVUS_TRAINING_PAL_ID_PROD','TAVUS_TRAINING_PAL_ID_DEV','VITE_SECRET'])expect(env).not.toHaveProperty(key);
 });
 it('requires avatar credentials without exposing their values',()=>{
  expect(()=>localEnvironment({OPENAI_API_KEY:'never-print-this'},'x'.repeat(32))).toThrow('TAVUS_API_KEY');
  try{localEnvironment({OPENAI_API_KEY:'never-print-this'},'x'.repeat(32));}catch(e){expect(String(e)).not.toContain('never-print-this');}
 });
 it('supports text-only startup and rejects missing local authentication',()=>{
  expect(localEnvironment({},'x'.repeat(32),false).PORT).toBe('3000');
  expect(()=>localEnvironment({},'',false)).toThrow('setup has not completed');
 });
});
