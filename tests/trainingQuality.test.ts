// @vitest-environment node
import {it,expect} from 'vitest';
import {validateTrainingQuality,qualityRules} from '../server/trainingQuality';
import {QUALITY_CRITERIA} from '../src/trainingQuality';
import {learnerPassages} from '../server/learnerEvidence';
const turns:any[]=[{id:'u',role:'user',text:'I is explaining the author’s argument.',inputKind:'typed'}];
const passages=learnerPassages(turns[0].text,turns);
const fixture=()=>Object.keys(QUALITY_CRITERIA).map(id=>({id,status:'insufficient_evidence',passageIds:[] as string[],explanation:'Too little context.',suggestion:''}));
it('keeps fixed independent quality criteria and cannot claim audio delivery',()=>{
 const q=validateTrainingQuality(fixture(),passages,turns);expect(q.findings).toHaveLength(8);expect(q.spokenDelivery).toBe('not_assessed');expect(qualityRules).toContain('imperfect grammar does not invalidate');expect(qualityRules).toContain('Arabic dialects');
});
it('resolves typed language evidence exactly and keeps suggestions distinct',()=>{
 const f=fixture();Object.assign(f.find(x=>x.id==='grammar')!,{status:'needs_attention',passageIds:[passages[0].id],suggestion:'Consider “I am explaining…”.'});
 const result=validateTrainingQuality(f,passages,turns).findings.find(f=>f.id==='grammar')!;expect(result.status).toBe('needs_attention');expect(result.evidence[0].quote).toBe(turns[0].text);
});
it.each(['transcribed','unknown',undefined])('does not confirm speaker language errors from %s text',inputKind=>{
 const f=fixture();Object.assign(f.find(x=>x.id==='grammar')!,{status:'needs_attention',passageIds:[passages[0].id],suggestion:'Check the transcript first.'});
 expect(validateTrainingQuality(f,passages,[{...turns[0],inputKind}]).findings.find(f=>f.id==='grammar')?.status).toBe('possible_transcription_issue');
});
it('rejects unsupported praise, invented evidence, duplicated rubric and concerns without advice',()=>{
 for(const change of [(f:any[])=>{f[0].status='effective';},(f:any[])=>{Object.assign(f[0],{status:'effective',passageIds:['invented']});},(f:any[])=>{f[1]=f[0];},(f:any[])=>{Object.assign(f[0],{status:'needs_attention',passageIds:[passages[0].id]});}]){const f=fixture();change(f);expect(()=>validateTrainingQuality(f,passages,turns)).toThrow('invalid_model_evidence');}
});
it('keeps good expression separate from reference contradictions',async()=>{
 const {ModelProvider}=await import('../server/model');const {questionBank}=await import('../server/referencePractice');
 const q=questionBank()[0],quality=fixture();Object.assign(quality.find(f=>f.id==='clarity')!,{status:'effective',passageIds:[passages[0].id]});
 const raw={quality,spokenFeedback:'The wording is clear but differs from the reference.',points:q.points.map(p=>({id:p.id,status:'contradicted',passageIds:[passages[0].id],explanation:'Contradicts this criterion in this fixture.'}))};
 const response=new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(raw)}]}]}));
 const result=await new ModelProvider({OPENAI_API_KEY:'fixture'},async()=>response).assessReference('en',q,turns[0].text,AbortSignal.timeout(1000),turns);
 expect(result.verdict).toBe('inconsistent');expect(result.quality?.findings.find(f=>f.id==='clarity')?.status).toBe('effective');
});
