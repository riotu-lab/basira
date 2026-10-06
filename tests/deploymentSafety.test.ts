// @vitest-environment node
import {it,expect} from 'vitest';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const script=resolve('scripts/security/check-deployment.mjs');
function run(files:Record<string,string>,env:Record<string,string>={}){const cwd=mkdtempSync(join(tmpdir(),'basira-deploy-test-'));try{mkdirSync(join(cwd,'dist'));for(const [name,content] of Object.entries(files))writeFileSync(join(cwd,name),content);return spawnSync(process.execPath,[script],{cwd,env:{PATH:process.env.PATH,...env},encoding:'utf8'});}finally{rmSync(cwd,{recursive:true,force:true});}}
it('permits normal frontend assets',()=>expect(run({'dist/index.html':'<h1>Basira</h1>'}).status).toBe(0));
it('blocks an actual configured credential without printing its value',()=>{const key='private-fixture-value-for-deployment';const r=run({'dist/app.js':`const key="${key}"`,'.env':`TAVUS_API_KEY=${key}`});expect(r.status).toBe(1);expect(r.stderr).toContain('TAVUS_API_KEY');expect(r.stderr+r.stdout).not.toContain(key);});
it('blocks encoded secrets and client-prefixed credentials',()=>{const key='private/fixture?value=12345';expect(run({'dist/app.js':encodeURIComponent(key)}, {OPENAI_API_KEY:key}).status).toBe(1);expect(run({'dist/index.html':'safe'},{VITE_API_KEY:'sensitive-value'}).status).toBe(1);});
it('blocks private files and source maps even without recognizable credentials',()=>{expect(run({'dist/.env':'X=hidden'}).status).toBe(1);expect(run({'dist/bundle.js.map':'{}'}).status).toBe(1);expect(run({'dist/notes.md':'Private notes'}).status).toBe(1);});
it('does not claim function verification without its build artifact',()=>{const r=run({'dist/index.html':'safe'});expect(JSON.parse(r.stdout).functionFiles).toBeNull();});

it('scans environment-specific retrieval credentials without revealing their values',()=>{const key='production-retrieval-private-fixture';const r=run({'dist/app.js':key},{CONTENT_RAG_TOKEN_PROD:key});expect(r.status).toBe(1);expect(r.stderr).toContain('CONTENT_RAG_TOKEN_PROD');expect(r.stderr).not.toContain(key);});

it('accepts known Vercel public metadata but rejects similarly named credentials',()=>{
 expect(run({'dist/index.html':'safe'},{VITE_VERCEL_ENV:'production',VITE_VERCEL_URL:'basira.example',VITE_VERCEL_GIT_COMMIT_SHA:'abc123',VITE_VERCEL_OBSERVABILITY_CLIENT_CONFIG:'{}'}).status).toBe(0);
 expect(run({'dist/index.html':'safe'},{VITE_VERCEL_API_KEY:'private-fixture-value'}).status).toBe(1);
});
it('still scans allowed deployment metadata for configured credentials',()=>{
 const key='private-key-in-metadata-fixture';
 const result=run({'dist/app.js':key},{OPENAI_API_KEY:key,VITE_VERCEL_GIT_COMMIT_MESSAGE:key});
 expect(result.status).toBe(1);expect(result.stderr).toContain('OPENAI_API_KEY');expect(result.stderr).not.toContain(key);
});
