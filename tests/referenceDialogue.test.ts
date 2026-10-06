import {QUALITY_CRITERIA} from '../src/trainingQuality';
// @vitest-environment node
import {it,expect,vi} from 'vitest';
import {questionBank,bookQuestion,referenceTurns,checkReferenceVersion,answerFromTurns} from '../server/referencePractice';
import {ModelProvider} from '../server/model';
import type {ReferenceTurn} from '../src/referencePracticeTypes';
const question=questionBank().find(q=>q.status==='draft_requires_human_review')!;
const history:ReferenceTurn[]=[{id:'q1',role:'assistant',text:question.question.en,pointIds:[question.points[0].id],delivery:'text'},{id:'a1',role:'user',text:'I think this argument needs an example.',pointIds:[question.points[0].id],delivery:'text'}];
const output=(value:unknown)=>new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify((value as any)?.points?{...(value as any),quality:Object.keys(QUALITY_CRITERIA).map(id=>({id,status:'insufficient_evidence',passageIds:[],explanation:'Fixture: insufficient context.',suggestion:''}))}:value)}]}]}));
it('loads all four exported collections without silently approving draft material',()=>{
 for(const [background,count] of [['hinduism',93],['christianity',94],['atheism',85],['judaism',70]] as const){
  const questions=questionBank().filter(q=>q.tradition===background&&q.status==='draft_requires_human_review');
  expect(questions).toHaveLength(count);expect(questions.every(q=>q.evidence?.length&&q.referenceVersion&&q.source.excerpt)).toBe(true);
 }
});
it('resolves canonical references and refuses changed versions',()=>{
 const snapshot=bookQuestion(question.id);snapshot.answer.en='client tampering';expect(bookQuestion(question.id).answer.en).not.toBe('client tampering');
 expect(()=>checkReferenceVersion(question,'stale')).toThrow('reference_changed');expect(()=>checkReferenceVersion(question,question.referenceVersion)).not.toThrow();
});
it('validates alternating complete pairs, actual opening question and criterion IDs',()=>{
 expect(referenceTurns(history,question)).toEqual(history);expect(answerFromTurns(history)).toBe(history[1].text);
 for(const invalid of [[history[1],history[0]],[{...history[0],text:'different question'},history[1]],[history[0],{...history[1],id:'q1'}],[history[0],{...history[1],pointIds:['fabricated']}],[...history,history[0]]])expect(()=>referenceTurns(invalid,question)).toThrow();
});
it('supplies actual history, reference answers and evidence to the follow-up model (mocked transport)',async()=>{
 const request=vi.fn().mockResolvedValueOnce(output({text:'Can you give a concrete example?',pointIds:[question.points[0].id],readyForReview:false})).mockResolvedValueOnce(output({supported:true,reason:'Within the selected criterion.',bindings:[{pointId:question.points[0].id,answerPassageId:'answer-1',evidenceId:'evidence-1'}]}));
 const result=await new ModelProvider({OPENAI_API_KEY:'fixture'},request).referenceFollowup('en',question,history,AbortSignal.timeout(1000),question.points[0].id);
 const body=JSON.parse(request.mock.calls[0][1].body),context=JSON.parse(body.input[0].content);
 expect(context.focusPointId).toBe(question.points[0].id);expect(context.referenceAnswer).toBe(question.answer.en);expect(context.history).toEqual(history);expect(context.evidence).toEqual(question.evidence);expect(body.instructions).toContain('Do not repeat');expect(result.questionId).toBe(question.id);
});
it.each([{text:'Invented',pointIds:['absent'],readyForReview:false},{text:'',pointIds:[],readyForReview:false},{text:'A question?',pointIds:[],readyForReview:true}])('rejects ungrounded or contradictory follow-up metadata',async value=>{
 const provider=new ModelProvider({OPENAI_API_KEY:'fixture'},vi.fn().mockResolvedValue(output(value)));
 await expect(provider.referenceFollowup('ar',question,history,AbortSignal.timeout(1000))).rejects.toMatchObject({code:'invalid_model_evidence'});
});
it('binds review quotes to learner turns, never assistant text or cross-turn joins',async()=>{
 const turns:ReferenceTurn[]=[...history,{id:'q2',role:'assistant',text:'An assistant hint.',pointIds:[question.points[0].id]},{id:'a2',role:'user',text:'Here is my revised explanation.',pointIds:[question.points[0].id]}];
 const assessment=(passageId:string)=>({spokenFeedback:'Reference comparison.',points:question.points.map((p,i)=>({id:p.id,status:i?'missing':'covered',passageIds:i?[]:[passageId],explanation:'Check the reference.'}))});
 const request=vi.fn().mockResolvedValue(output(assessment('learner-2-1')));
 const model=new ModelProvider({OPENAI_API_KEY:'fixture'},request);
 const result=await model.assessReference('en',question,answerFromTurns(turns),AbortSignal.timeout(1000),turns);
 expect(result.points[0].turnId).toBe('a2');
 for(const quote of ['assistant-q2','invented-passage']){
  request.mockResolvedValueOnce(output(assessment(quote)));
  await expect(model.assessReference('en',question,answerFromTurns(turns),AbortSignal.timeout(1000),turns)).rejects.toThrow();
 }
});
