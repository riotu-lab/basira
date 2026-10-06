// @vitest-environment node
import {afterEach,describe,it,expect,vi} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {TrainingStore} from '../server/trainingStore';
import {TrainingEngine} from '../server/trainingSession';
import {currentTrainingRecord} from '../src/trainingSession';
import {trainingGatewayAuth,trainingGatewayKey,trainingToken,trainingContext} from '../server/trainingGateway';
const cleanups:(()=>void)[]=[];
afterEach(()=>cleanups.splice(0).forEach(fn=>fn()));
function fixture(){const dir=mkdtempSync(join(tmpdir(),'basira-training-'));const store=new TrainingStore({TRAINING_SQLITE_PATH:join(dir,'test.sqlite')});cleanups.push(()=>{store.close();rmSync(dir,{recursive:true,force:true});});const model={referenceFollowup:vi.fn(async(..._args:any[])=>({readyForReview:true,text:'',pointIds:[] as string[]})),assessReference:vi.fn(async(..._args:any[])=>({verdict:'partial' as const,spokenFeedback:'Test assessment',points:[]}))};return {store,model,engine:new TrainingEngine(store,model)};}
const signal=()=>new AbortController().signal;
describe('Unified source-guided training — mocked model, real persistent store',()=>{
 it('uses canonical references, preserves input, assesses before advancing and never repeats a question',async()=>{const {engine,store,model}=fixture();const {token,session}=await engine.create('ar','hinduism');const original=currentTrainingRecord(session);const first=await engine.act(token,{id:'u1',action:'answer',text:'جواب المتدرّب كما كتبه'},signal());expect(model.referenceFollowup.mock.calls[0][1]).toEqual(original.question);expect(model.assessReference.mock.calls[0][2]).toBe('جواب المتدرّب كما كتبه');expect(first.session.records).toHaveLength(2);expect(currentTrainingRecord(first.session).question.id).not.toBe(original.question.id);expect(first.session.records[0].attempts[0].turns?.[1].text).toBe('جواب المتدرّب كما كتبه');const duplicate=await engine.act(token,{id:'u1',action:'answer',text:'changed'},signal());expect(duplicate.session.records).toHaveLength(2);expect(model.assessReference).toHaveBeenCalledTimes(1);expect((await store.get(token)).id).toBe(session.id);});
 it('preserves answers after assessment failure and recovers without duplicating them',async()=>{const {engine,store,model}=fixture();const {token}=await engine.create('en','judaism');model.assessReference.mockRejectedValueOnce(Error('outage'));await expect(engine.act(token,{id:'a',action:'answer',text:'My actual answer'},signal())).rejects.toThrow();const s=await store.get(token);expect(s.records).toHaveLength(1);expect(currentTrainingRecord(s).turns?.at(-1)?.text).toBe('My actual answer');expect(s.error).toBeTruthy();const recovered=await engine.act(token,{id:'b',action:'recover'},signal());expect(recovered.session.records[0].attempts[0].answer).toBe('My actual answer');expect(recovered.session.error).toBeUndefined();});
 it('stops on explicit finish, retries original criteria and preserves original assessment',async()=>{const {engine}=fixture();const {token,session}=await engine.create('en','christianity');const original=currentTrainingRecord(session);await engine.act(token,{id:'a',action:'answer',text:'Original answer'},signal());await engine.act(token,{id:'end',action:'finish'},signal());await engine.act(token,{id:'retry',action:'retry',recordId:original.id,focusPointId:original.question.points[0].id},signal());const result=await engine.act(token,{id:'b',action:'answer',text:'Retry answer'},signal());const r=result.session.records.find(r=>r.id===original.id)!;expect(result.session.ended).toBe(true);expect(r.question).toEqual(original.question);expect(r.attempts.map(a=>a.answer)).toEqual(['Original answer','Retry answer']);expect(r.attempts[1].focusPointId).toBe(original.question.points[0].id);expect(result.session.records).toHaveLength(2);await engine.act(token,{id:'end-retry',action:'finish'},signal());});
 it('does not assess an unanswered question and rejects a fabricated focus',async()=>{const {engine,model}=fixture();const {token}=await engine.create('ar','atheism');const r=await engine.act(token,{id:'finish',action:'finish'},signal());expect(r.session.ended).toBe(true);expect(model.assessReference).not.toHaveBeenCalled();await expect(engine.act(token,{id:'retry',action:'retry',recordId:r.session.currentId,focusPointId:'invented'},signal())).rejects.toThrow();});
 it('keeps follow-ups bound to the current reference and permits deletion',async()=>{const {engine,store,model}=fixture();const {token,session}=await engine.create('en','hinduism');model.referenceFollowup.mockResolvedValueOnce({readyForReview:false,text:'Can you clarify that point?',pointIds:currentTrainingRecord(session).question.points.map(p=>p.id)});const r=await engine.act(token,{id:'a',action:'answer',text:'An answer'},signal());expect(r.session.records).toHaveLength(1);expect(currentTrainingRecord(r.session).turns).toHaveLength(3);expect(model.assessReference).not.toHaveBeenCalled();await store.remove(token);await expect(store.get(token)).rejects.toMatchObject({code:'training_session_missing'});});
 it('serializes mutations, forbids mode changes while a paid call is active, and rejects fake capabilities',async()=>{const {engine,store}=fixture();const {token,session}=await engine.create('en','atheism');await store.put(token,{...session,live:{handle:'sealed',callId:'call1',expires:Date.now()+60000}});await expect(engine.act(token,{id:'a',action:'finish'},signal())).rejects.toMatchObject({code:'training_end_first'});let release!:()=>void;const held=store.exclusive(token,()=>new Promise<void>(r=>release=r));await new Promise(r=>setTimeout(r,20));await expect(store.exclusive(token,async()=>{})).rejects.toMatchObject({code:'training_busy'});release();await held;await expect(store.get('bad')).rejects.toThrow();});
 it('ignores system/perception messages, deduplicates callbacks and scopes identical answers to each call',async()=>{const {engine,store}=fixture();const {token,session}=await engine.create('en','hinduism');await store.put(token,{...session,live:{handle:'test',callId:'call1',expires:Date.now()+60000}});const messages=[{role:'system',content:'perception not learner evidence'},{role:'user',content:'My view'}];await engine.completion(token,messages,signal(),'call1');await engine.completion(token,messages,signal(),'call1');expect((await store.get(token)).records).toHaveLength(2);const s=await store.get(token);await store.put(token,{...s,live:{handle:'test',callId:'call2',expires:Date.now()+60000}});await expect(engine.completion(token,messages,signal(),'call1')).rejects.toMatchObject({code:'training_call_ended'});await engine.completion(token,messages,signal(),'call2');expect((await store.get(token)).records).toHaveLength(3);});
});
describe('Tavus training gateway authentication',()=>{
 it('requires its derived credential and a context token in a system message',()=>{const env={TAVUS_API_KEY:'fixture-only'};expect(()=>trainingGatewayAuth('Bearer '+trainingGatewayKey(env),env)).not.toThrow();expect(()=>trainingGatewayAuth('Bearer fixture-only',env)).toThrow();const token='a'.repeat(64),context=trainingContext(token);expect(trainingToken([{role:'system',content:context}])).toBe(token);expect(()=>trainingToken([{role:'user',content:context}])).toThrow();expect(()=>trainingToken([{role:'system',content:context+' BASIRA_TRAINING_SESSION='+'b'.repeat(64)}])).toThrow();});
});

describe('Training recovery boundaries',()=>{
 it('rejects callbacks after the connection is cleared, and preserves later interrupted contributions',async()=>{
  const {engine,store,model}=fixture();const {token,session}=await engine.create('en','hinduism');
  await store.put(token,{...session,live:{handle:'synthetic',callId:'call1',expires:Date.now()+60000}});
  model.referenceFollowup.mockRejectedValueOnce(Error('cancelled transport'));
  await expect(engine.completion(token,[{role:'user',content:'My first thought'}],signal(),'call1')).rejects.toThrow();
  await engine.completion(token,[{role:'user',content:'My first thought'},{role:'user',content:'Let me clarify that thought'}],signal(),'call1');
  const stored=await store.get(token);expect(stored.records[0].attempts[0].turns?.filter(t=>t.role==='user').map(t=>t.text)).toEqual(['My first thought','Let me clarify that thought']);
  delete stored.live;await store.put(token,stored);
  await expect(engine.completion(token,[{role:'user',content:'Late callback'}],signal(),'call1')).rejects.toMatchObject({code:'training_call_ended'});
 });
 it('recognizes delayed replays, not only the immediately previous request',async()=>{
  const {engine}=fixture();const {token}=await engine.create('en','judaism');
  const a=await engine.act(token,{id:'a',action:'answer',text:'First'},signal());await engine.act(token,{id:'b',action:'answer',text:'Second'},signal());
  const replay=await engine.act(token,{id:'a',action:'answer',text:'First'},signal());expect(replay.text).toBe(a.text);expect(replay.session.records).toHaveLength(3);
 });
});

it('excludes provider audio annotations from follow-ups and assessment, including empty annotation-only callbacks',async()=>{
 const {engine,store,model}=fixture();const {token,session}=await engine.create('ar','atheism');
 await store.put(token,{...session,live:{handle:'synthetic',callId:'call1',expires:Date.now()+60000}});
 await engine.completion(token,[{role:'user',content:'<user_audio_analysis>Sounds angry.</user_audio_analysis>'}],signal(),'call1');
 expect(model.referenceFollowup).not.toHaveBeenCalled();expect((await store.get(token)).records[0].turns).toHaveLength(1);
 const messages=[{role:'user',content:'<user_audio_analysis>Measured tone.</user_audio_analysis> تمام، من البيئة الخارجية.'}];
 await engine.completion(token,messages,signal(),'call1');await engine.completion(token,messages,signal(),'call1');
 expect(model.assessReference).toHaveBeenCalledTimes(1);expect(model.assessReference.mock.calls[0][2]).toBe('تمام، من البيئة الخارجية.');
 expect(JSON.stringify(model.referenceFollowup.mock.calls)).not.toContain('Measured tone');
 expect((await store.get(token)).records[0].attempts[0].answer).toBe('تمام، من البيئة الخارجية.');
});
it('revokes a stopped call while processing holds the record lock and cannot resurrect its lease',async()=>{
 const {engine,store}=fixture();const {token,session}=await engine.create('en','hinduism');const stale={...session,live:{handle:'test',callId:'old',expires:Date.now()+60000}};await store.put(token,stale);
 await store.exclusive(token,async()=>{await store.revokeCall(token,'old');expect((await store.get(token)).live).toBeUndefined();await store.put(token,stale);});
 expect((await store.get(token)).live).toBeUndefined();await expect(engine.completion(token,[{role:'user',content:'late'}],signal(),'old')).rejects.toMatchObject({code:'training_call_ended'});
 await store.put(token,{...session,live:{handle:'new',callId:'new',expires:Date.now()+60000}});expect((await store.get(token)).live?.callId).toBe('new');
});
it('retries rejected model evidence once without duplicating the saved answer',async()=>{
 const {ApiError}=await import('../server/validation');const {engine,store,model}=fixture();const {token}=await engine.create('en','hinduism');
 model.referenceFollowup.mockRejectedValueOnce(new ApiError('invalid_model_evidence',502));
 await engine.act(token,{id:'answer',action:'answer',text:'My explanation'},signal());
 expect(model.referenceFollowup).toHaveBeenCalledTimes(2);expect((await store.get(token)).records[0].turns?.filter(t=>t.role==='user')).toHaveLength(1);
});
it('keeps an acknowledgment on the same question without assessing the greeting',async()=>{
 const {engine,model}=fixture();const {token,session}=await engine.create('en','christianity');
 model.referenceFollowup.mockResolvedValueOnce({readyForReview:false,text:'Hello, go ahead. I’m listening.',pointIds:[]});
 const result=await engine.act(token,{id:'greeting',action:'answer',text:'Hello my friend'},signal());
 expect(result.session.currentId).toBe(session.currentId);expect(result.session.records).toHaveLength(1);expect(model.assessReference).not.toHaveBeenCalled();
});
it('varies opening questions across sessions instead of always selecting the first',async()=>{
 const {engine}=fixture();const ids=new Set<string>();for(let i=0;i<16;i++)ids.add(currentTrainingRecord((await engine.create('en','christianity')).session).question.id);expect(ids.size).toBeGreaterThan(1);
});
it('preserves silent fragments, deduplicates callbacks, then reviews the joined learner contributions',async()=>{
 const {engine,store,model}=fixture();const {token,session}=await engine.create('ar','hinduism');
 await store.put(token,{...session,live:{handle:'fixture',callId:'call',expires:Date.now()+60000}});
 model.referenceFollowup.mockResolvedValueOnce({readyForReview:false,text:'',pointIds:[]});
 const first=await engine.completion(token,[{role:'user',content:'أرى أن العلاقة—'}],signal(),'call');
 expect(first.text).toBe('');expect(first.session.records[0].turns).toHaveLength(2);expect(model.assessReference).not.toHaveBeenCalled();
 await engine.completion(token,[{role:'user',content:'أرى أن العلاقة—'}],signal(),'call');expect(model.referenceFollowup).toHaveBeenCalledTimes(1);
 await engine.completion(token,[{role:'user',content:'أرى أن العلاقة—'},{role:'user',content:'هي علاقة توافق مع الميل الفطري.'}],signal(),'call');
 const assessed=model.assessReference.mock.calls[0][2];expect(assessed).toContain('أرى أن العلاقة—');expect(assessed).toContain('هي علاقة توافق');
});
it('allows text continuation after a processed silent audio fragment',async()=>{
 const {engine,model}=fixture();const {token}=await engine.create('ar','hinduism');
 model.referenceFollowup.mockResolvedValueOnce({readyForReview:false,text:'',pointIds:[]});
 await engine.act(token,{id:'part1',action:'answer',text:'أرى أن العلاقة—',inputKind:'transcribed'},signal());
 await engine.act(token,{id:'part2',action:'answer',text:'هي علاقة توافق.',inputKind:'typed'},signal());
 expect(model.assessReference.mock.calls[0][2]).toContain('هي علاقة توافق.');
});

it('keeps an exhausted question bank open until the user finishes, without reassessing or repeating questions',async()=>{
 const {engine,model,store}=fixture();const {token,session}=await engine.create('en','hinduism');
 // Deterministically emulate having no unused questions left.
 vi.spyOn(engine as any,'pick').mockReturnValue(undefined);
 const result=await engine.act(token,{id:'last-answer',action:'answer',text:'My final answer'},signal());
 expect(result.session.ended).toBe(false);expect(result.session.records).toHaveLength(1);expect(currentTrainingRecord(result.session).exhausted).toBe(true);
 await engine.act(token,{id:'extra',action:'answer',text:'Thank you'},signal());
 expect(model.assessReference).toHaveBeenCalledTimes(1);expect((await store.get(token)).ended).toBe(false);
 const ended=await engine.act(token,{id:'finish',action:'finish'},signal());expect(ended.session.ended).toBe(true);expect(model.assessReference).toHaveBeenCalledTimes(1);
});

it('submits a final typed draft atomically without generating another question',async()=>{
 const {engine,model}=fixture();const {token}=await engine.create('en','hinduism');
 const result=await engine.act(token,{id:'finish-draft',action:'finish',text:'My final answer',inputKind:'typed'},signal());
 expect(result.session.ended).toBe(true);expect(result.session.records).toHaveLength(1);expect(currentTrainingRecord(result.session).attempts[0].answer).toBe('My final answer');expect(model.referenceFollowup).not.toHaveBeenCalled();
});
it('allows one clarification in a retry, waits for fragments, then returns to comparison',async()=>{
 const {engine,model}=fixture();const {token,session}=await engine.create('en','hinduism');const original=session.currentId;
 await engine.act(token,{id:'original',action:'finish',text:'Original answer'},signal());await engine.act(token,{id:'retry',action:'retry',recordId:original},signal());
 model.referenceFollowup.mockResolvedValueOnce({readyForReview:false,text:'Please clarify this point.',pointIds:[]});
 expect((await engine.act(token,{id:'r1',action:'answer',text:'Retry answer'},signal())).session.ended).toBe(false);
 model.referenceFollowup.mockResolvedValueOnce({readyForReview:false,text:'',pointIds:[]});
 expect((await engine.act(token,{id:'fragment',action:'answer',text:'I think—',inputKind:'transcribed'},signal())).session.ended).toBe(false);
 model.referenceFollowup.mockResolvedValueOnce({readyForReview:false,text:'Another question?',pointIds:[]});
 const result=await engine.act(token,{id:'complete',action:'answer',text:'Here is my completed explanation.'},signal());
 expect(result.session.ended).toBe(true);expect(result.session.records).toHaveLength(1);expect(result.session.currentId).toBe(original);expect(currentTrainingRecord(result.session).attempts).toHaveLength(2);expect(result.text).toBe('');
});
it('keeps content practice on its signed reference, finishes and compares a retry without starting a bank topic',async()=>{const {engine}=fixture();const seed=await engine.create('en','atheism');const q={...seed.session.records[0].question,context:'content_review' as const};const origin={passage:'Original publication',explanation:'Editorial comparison',citations:[]};const {token,session}=await engine.create('en','atheism',{question:q,origin});const first=await engine.act(token,{id:'a',action:'answer',text:'First attempt'},signal());expect(first.session.ended).toBe(true);expect(first.session.records).toHaveLength(1);expect(first.session.contentOrigin).toEqual(origin);await engine.act(token,{id:'r',action:'retry',recordId:session.currentId},signal());const second=await engine.act(token,{id:'b',action:'answer',text:'Second attempt'},signal());expect(second.session.records[0].attempts.map(a=>a.answer)).toEqual(['First attempt','Second attempt']);expect(second.session.records[0].question).toEqual(q);});
it('preserves an audio retry focus without changing factual criteria or the original answer',async()=>{const {engine}=fixture();const {token,session}=await engine.create('en','hinduism');const id=session.currentId;const first=await engine.act(token,{id:'first',action:'finish',text:'Original words'},signal());const original=structuredClone(first.session.records[0].attempts[0]);await expect(engine.act(token,{id:'bad-focus',action:'retry',recordId:id,focusAudioCriterion:'emotion'},signal())).rejects.toThrow();await engine.act(token,{id:'retry',action:'retry',recordId:id,focusAudioCriterion:'intonation'},signal());const next=await engine.act(token,{id:'done',action:'finish',text:'Second answer'},signal());expect(next.session.records[0].attempts[0]).toEqual(original);expect(next.session.records[0].attempts[1].focusAudioCriterion).toBe('intonation');expect(next.session.records[0].question).toEqual(first.session.records[0].question);});

it('persists a background greeting once while preserving the canonical question and plain later questions',async()=>{
 const {engine,store}=fixture();const {token,session}=await engine.create('ar','judaism');const first=currentTrainingRecord(session);
 expect(first.turns![0].text).toContain('أنا يهودي');expect(first.turns![0].text.endsWith(first.question.question.ar)).toBe(true);
 expect((await store.get(token)).records[0].turns![0].text).toBe(first.turns![0].text);
 const next=await engine.act(token,{id:'greeting-answer',action:'answer',text:'إجابتي'},signal());const record=currentTrainingRecord(next.session);
 expect(record.turns![0].text).toBe(record.question.question.ar);
 await engine.act(token,{id:'greeting-finish',action:'finish'},signal());
 const retry=await engine.act(token,{id:'greeting-retry',action:'retry',recordId:first.id},signal());
 expect(retry.text).toBe(first.question.question.ar);
});
