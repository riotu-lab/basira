// @vitest-environment node
import {it,expect,vi} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {AiAudit,SqliteAuditStore,RedisAuditStore,sanitizeAudit,aiRequestContext,type AuditRecord,type AuditStore} from '../server/aiAudit';
import {ModelProvider} from '../server/model';
import {questionBank} from '../server/referencePractice';
class Memory implements AuditStore{
 records=new Map<string,AuditRecord>();
 async save(r:AuditRecord){this.records.set(r.id,structuredClone(r));}
 async list(){return [...this.records.values()];}
 async remove(id:string){this.records.delete(id);}
}
const env={AI_AUDIT_ENABLED:'true',OPENAI_API_KEY:'secret-provider-key'};
const reply=(text:string)=>new Response(JSON.stringify({status:'completed',usage:{input_tokens:10,output_tokens:5},output:[{type:'message',content:[{type:'output_text',text}]}]}));
it('stores raw responses, model, prompt, usage, final output and request context without credentials',async()=>{
 const store=new Memory(),model=new ModelProvider(env,vi.fn().mockResolvedValue(reply('A response')),new AiAudit(env,store));
 const result=await aiRequestContext.run({requestId:'r1',sessionId:'s1'},()=>model.converse('en',[],new AbortController().signal));
 expect(result).toBe('A response');const [record]=await store.list();expect(record.status).toBe('completed');expect(record.output).toBe('A response');expect(record.context).toEqual({requestId:'r1',sessionId:'s1'});
 const call=record.calls[0] as any;expect(call.request.model).toBe('gpt-4.1-mini');expect(call.request.instructions).toContain('Basira');expect(call.response.usage.input_tokens).toBe(10);expect(JSON.stringify(record)).not.toContain(env.OPENAI_API_KEY);expect(record.reviewStatus).toBe('pending');
});
it('retains rejected model evidence and records validation failure, not just HTTP success',async()=>{
 const store=new Memory(),q=questionBank()[0];
 const raw={spokenFeedback:'Feedback',points:q.points.map(p=>({id:p.id,status:'covered',answerQuote:'fabricated',explanation:'Wrong'}))};
 const model=new ModelProvider(env,vi.fn().mockResolvedValue(reply(JSON.stringify(raw))),new AiAudit(env,store));
 await expect(model.assessReference('en',q,'Actual words',new AbortController().signal)).rejects.toMatchObject({code:'invalid_model_evidence'});
 const [record]=await store.list();expect(record.error).toBe('invalid_model_evidence');expect(record.status).toBe('failed');expect(JSON.stringify(record.calls)).toContain('fabricated');
});
it('keeps concurrent request contexts isolated',async()=>{
 const store=new Memory(),audit=new AiAudit(env,store);
 await Promise.all(['one','two'].map(id=>aiRequestContext.run({sessionId:id},()=>audit.run('converse',{id},async()=>{await new Promise(r=>setTimeout(r,id==='one'?10:1));return id;}))));
 for(const r of await store.list())expect(r.context).toEqual({sessionId:r.output});
});
it('does not make a billable request if the audit store is unavailable',async()=>{
 const store=new Memory();store.save=async()=>{throw Error('private-storage-error');};const request=vi.fn();
 await expect(new ModelProvider(env,request,new AiAudit(env,store)).converse('en',[],new AbortController().signal)).rejects.toMatchObject({code:'ai_audit_unavailable'});expect(request).not.toHaveBeenCalled();
});
it('marks unfinished records when final persistence fails and does not claim success',async()=>{
 const store=new Memory(),save=store.save.bind(store);let n=0;store.save=async r=>{if(n++)throw Error();await save(r);};
 await expect(new AiAudit(env,store).run('op',{},async()=>'response')).rejects.toMatchObject({code:'ai_audit_unavailable'});
 expect((await store.list())[0].status).toBe('started');
});
it('persists across SQLite reopen and supports deletion',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'basira-audit-')),path=join(dir,'audit.sqlite');let store=new SqliteAuditStore(path);
 try{await new AiAudit(env,store).run('fixture',{},async()=>'persisted');store.close();store=new SqliteAuditStore(path);const [r]=await store.list();expect(r.output).toBe('persisted');await store.remove(r.id);expect(await store.list()).toEqual([]);}finally{store.close();await rm(dir,{recursive:true,force:true});}
});
it('redacts known secrets, credentials and media, preserving ordinary answer text',()=>{
 const result=sanitizeAudit({text:'learner text secret-provider-key',Authorization:'Bearer sensitive',apiKey:'anything',image:'data:image/png;base64,AAABBB==',audio:Buffer.from('recording')},env) as any;
 expect(result.text).toBe('learner text [redacted]');expect(result.apiKey).toBe('[redacted]');expect(result.image).toBe('[media omitted]');expect(result.audio.omitted).toBe('binary');
});
it('uses atomic Redis storage and rejects per-command failures (mocked transport)',async()=>{
 const request=vi.fn().mockResolvedValue(new Response(JSON.stringify([{result:'OK'},{error:'storage-error'}])));
 const store=new RedisAuditStore('https://example.invalid','private-token',request);
 await expect(new AiAudit(env,store).run('fixture',{},async()=>'never')).rejects.toMatchObject({code:'ai_audit_unavailable'});
 expect(request.mock.calls[0][0]).toBe('https://example.invalid/multi-exec');const cmds=JSON.parse(request.mock.calls[0][1].body);expect(cmds[0][0]).toBe('EVAL');expect(cmds[0][1]).toContain('ZADD');expect(JSON.stringify(cmds)).not.toContain('private-token');
});
it('transcription text is retained while uploaded recordings are not',async()=>{
 const store=new Memory(),model=new ModelProvider(env,vi.fn().mockResolvedValue(new Response(JSON.stringify({text:'Hello'}))),new AiAudit(env,store));
 expect(await model.transcribe('en',Buffer.from('AUDIO BYTES'),'audio/wav',new AbortController().signal)).toBe('Hello');
 const [record]=await store.list();expect(record.output).toBe('Hello');expect(JSON.stringify(record)).not.toContain('AUDIO BYTES');expect((record.calls[0] as any).request.file.omitted).toBe('uploaded_file');
});
it('audits audio coaching without retaining encoded recording bytes',async()=>{
 const {pcmWav}=await import('../server/audioAssessment');const store=new Memory();
 const result={findings:['pronunciation','fluency','intonation'].map(criterion=>({criterion,status:'insufficient_evidence',observation:'Silent sample.',suggestion:'',segmentIds:[]}))};
 const response=new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(result)}}]}));
 const model=new ModelProvider(env,vi.fn().mockResolvedValue(response),new AiAudit(env,store));
 const wav=pcmWav(Buffer.alloc(32000*4));await model.assessSpeech('en',wav,'audio/wav',AbortSignal.timeout(10000));
 const records=await store.list();expect(records).toHaveLength(1);expect(records[0].status).toBe('completed');expect(records[0].operation).toBe('assessSpeech');const saved=JSON.stringify(records);expect(saved).not.toContain(wav.toString('base64'));expect(saved).toContain('sha256');expect(records[0].output).toMatchObject({version:1,language:'en'});
});
it('prunes audit age, count and byte bounds while preserving newest records',async()=>{const dir=await mkdtemp(join(tmpdir(),'basira-retention-'));const store=new SqliteAuditStore(join(dir,'audit.sqlite'),{days:7,maxRecords:2,maxBytes:4000});const record=(id:string,createdAt:number):AuditRecord=>({version:1,id,createdAt,updatedAt:createdAt,operation:'test',status:'completed',reviewStatus:'pending',input:{},context:{},calls:[]});try{await store.save(record('expired',Date.now()-8*86400000));expect(await store.list()).toEqual([]);for(let i=0;i<3;i++)await store.save(record(String(i),Date.now()+i));expect((await store.list()).map((r:AuditRecord)=>r.id)).toEqual(['2','1']);await store.remove('2');expect((await store.list()).map((r:AuditRecord)=>r.id)).toEqual(['1']);}finally{store.close();await rm(dir,{recursive:true,force:true});}});
