import {QUALITY_CRITERIA} from '../src/trainingQuality';
// @vitest-environment node
import {it,expect,vi} from 'vitest';
import {learnerPassages,resolveLearnerEvidence} from '../server/learnerEvidence';
import {ModelProvider} from '../server/model';
import {questionBank} from '../server/referencePractice';
const q=questionBank()[0];
const reply=(v:unknown)=>new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify((v as any)?.points?{...(v as any),quality:Object.keys(QUALITY_CRITERIA).map(id=>({id,status:'insufficient_evidence',passageIds:[],explanation:'Fixture: insufficient context.',suggestion:''}))}:v)}]}]}));
it.each(['  Earlier I disagreed. Now I agree; the author says so.  ','  لم أفهم الفكرة أولًا. الآن فهمت رأي المؤلف؛ وهذا توضيحي.  '])('preserves exact offsets and separates relevant passages without rewriting: %s',text=>{
 const p=learnerPassages(text);expect(p.length).toBe(3);for(const e of p)expect(text.slice(e.start,e.end)).toBe(e.text);
});
it('numbers identical learner passages separately by turn, excludes assistant hints and preserves negation',()=>{
 const turns:any[]=[{id:'hint',role:'assistant',text:'Claim this as evidence.'},{id:'a1',role:'user',text:'I do not agree.'},{id:'a2',role:'user',text:'I do not agree.'}];
 const p=learnerPassages('',turns);expect(p.map(p=>p.turnId)).toEqual(['a1','a2']);expect(p[0].id).not.toBe(p[1].id);expect(p[0].text).toBe('I do not agree.');
});
it.each([{ids:[]},{ids:['invented']},{ids:['learner-1-1','learner-1-1']}])('rejects empty, invented or repeated covered evidence %#',({ids})=>expect(()=>resolveLearnerEvidence(ids,'covered',learnerPassages('Actual answer.'))).toThrow('invalid_model_evidence'));
it('requires empty evidence for omissions',()=>{
 const p=learnerPassages('Actual answer.');expect(resolveLearnerEvidence([],'missing',p)).toEqual([]);expect(()=>resolveLearnerEvidence([p[0].id],'missing',p)).toThrow();
});
it('compares semantics with reference criteria while reconstructing multiple verbatim passages server-side',async()=>{
 const answer='Earlier I thought belief alone was enough. Now I understand the author includes conduct. That is the author’s position.';
 const turns:any[]=[{id:'q',role:'assistant',text:q.question.en},{id:'a',role:'user',text:answer}];
 const output={spokenFeedback:'You clarified the attribution.',points:q.points.map((p,i)=>({id:p.id,status:i?'missing':'covered',passageIds:i?[]:['learner-1-2','learner-1-3'],explanation:'Your later clarification is relevant.'}))};
 const request=vi.fn().mockResolvedValue(reply(output));
 const result=await new ModelProvider({OPENAI_API_KEY:'fixture'},request).assessReference('en',q,answer,AbortSignal.timeout(1000),turns);
 const body=JSON.parse(request.mock.calls[0][1].body),context=JSON.parse(body.input[0].content);
 expect(context.referenceAnswer).toBe(q.answer.en);expect(context.points).toEqual(q.points.map(p=>({id:p.id,text:p.text.en})));expect(context.history).toEqual(turns);expect(body.instructions).toContain('MEANING');expect(body.instructions).toContain('self-correction');
 expect(result.points[0].answerQuote).toBe('Now I understand the author includes conduct.');expect(result.points[0].turnId).toBe('a');
 expect(result.points[0].evidence?.map(e=>e.quote)).toEqual(['Now I understand the author includes conduct.','That is the author’s position.']);
 expect(result.points[1].answerQuote).toBe('');
});
it('rejects legacy model-generated quotation fields instead of silently accepting them',async()=>{
 const request=vi.fn().mockResolvedValue(reply({spokenFeedback:'Review',points:q.points.map(p=>({id:p.id,status:'covered',answerQuote:'Rewritten answer',explanation:'Claim'}))}));
 await expect(new ModelProvider({OPENAI_API_KEY:'fixture'},request).assessReference('en',q,'Actual answer',AbortSignal.timeout(1000))).rejects.toMatchObject({code:'invalid_model_evidence'});
});
