// @vitest-environment node
import {it,expect,vi} from 'vitest';
import {ModelProvider} from '../server/model';
import {questionBank} from '../server/referencePractice';
import {AiAudit,type AuditRecord} from '../server/aiAudit';
const q=questionBank()[0];
const evidence=q.evidence?.[0].quote||q.source.excerpt;
const turns:any[]=[{id:'q',role:'assistant',text:q.question.en,pointIds:[q.points[0].id]},{id:'a',role:'user',text:'My explanation',pointIds:[q.points[0].id]}];
const candidate={text:'How does that relate to the first point?',pointIds:[q.points[0].id],readyForReview:false};
const binding={pointId:q.points[0].id,answerPassageId:'answer-1',evidenceId:'evidence-1'};
const supported={supported:true,reason:'Answerable from the given reference.',bindings:[binding]};
const reply=(value:unknown)=>new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]}));
const invoke=(check:unknown)=>{const request=vi.fn().mockResolvedValueOnce(reply(candidate)).mockResolvedValueOnce(reply(check));return {request,result:new ModelProvider({OPENAI_API_KEY:'fixture'},request).referenceFollowup('en',q,turns,AbortSignal.timeout(5000))};};
it('checks the candidate independently with selected criteria, evidence and history before returning it',async()=>{
 const {result,request}=invoke(supported);expect(await result).toMatchObject({...candidate,grounding:'model_checked'});expect(request).toHaveBeenCalledTimes(2);
 const verifier=JSON.parse(request.mock.calls[1][1].body);const context=JSON.parse(verifier.input[0].content);
 expect(context.candidate.text).toBe(candidate.text);expect(context.history).toEqual(turns);expect(context.selectedCriteria).toHaveLength(1);expect(context.evidence[0].quote).toBe(evidence);expect(q.answer.en).toContain(context.answerPassages[0].quote);expect(verifier.instructions).toContain('UNTRUSTED DATA');
});
it('rejects unsupported scope without exposing its wording, without advancing or grading the current question',async()=>{
 const {result}=invoke({supported:false,reason:'Requires an unrelated source.',bindings:[]});expect(await result).toMatchObject({text:'',pointIds:[],readyForReview:false,grounding:'unsupported'});
});
it.each([
 {...supported,bindings:[]},
 {...supported,bindings:[binding,binding]},
 {...supported,bindings:[{...binding,answerPassageId:'invented answer passage'}]},
 {...supported,bindings:[{...binding,evidenceId:'invented source passage'}]},
 {...supported,bindings:[{...binding,pointId:'unknown'}]},
 {...supported,bindings:[{...binding,evidenceId:'unknown'}]},
 {...supported,bindings:[{...binding,answerPassageId:' '}]},
 {...supported,reason:''},
 {supported:false,reason:'Unsupported.',bindings:[binding]},
])('fails closed on invalid verifier evidence %#',async check=>{
 await expect(invoke(check).result).rejects.toMatchObject({code:'invalid_model_evidence'});
});
it('does not call the checker when no follow-up was proposed',async()=>{
 const request=vi.fn().mockResolvedValue(reply({text:'',pointIds:[],readyForReview:true}));
 expect(await new ModelProvider({OPENAI_API_KEY:'fixture'},request).referenceFollowup('en',q,turns,AbortSignal.timeout(5000))).toMatchObject({readyForReview:true,grounding:'not_needed'});expect(request).toHaveBeenCalledTimes(1);
});
it('keeps verification outages as errors rather than returning unchecked wording or false completion',async()=>{
 const request=vi.fn().mockResolvedValueOnce(reply(candidate)).mockRejectedValueOnce(new TypeError('network'));
 await expect(new ModelProvider({OPENAI_API_KEY:'fixture'},request).referenceFollowup('en',q,turns,AbortSignal.timeout(5000))).rejects.toMatchObject({code:'model_connection_failed'});
});
it('audits both calls, rejection explanation, source passages, candidate and final filtered output together',async()=>{
 const stored=new Map<string,AuditRecord>();
 const store={save:async(r:AuditRecord)=>{stored.set(r.id,structuredClone(r));},list:async()=>[...stored.values()],remove:async(id:string)=>{stored.delete(id);}};
 const env={OPENAI_API_KEY:'fixture',AI_AUDIT_ENABLED:'true'};
 const request=vi.fn().mockResolvedValueOnce(reply(candidate)).mockResolvedValueOnce(reply({supported:false,reason:'Unrelated facts required.',bindings:[]}));
 await new ModelProvider(env,request,new AiAudit(env,store)).referenceFollowup('en',q,turns,AbortSignal.timeout(5000));
 const [record]=await store.list();expect(record.status).toBe('completed');expect(record.calls).toHaveLength(2);expect(record.output).toMatchObject({text:'',grounding:'unsupported'});expect(JSON.stringify(record.calls)).toContain('Unrelated facts required.');expect(JSON.stringify(record.calls)).toContain(candidate.text);
});
it('accepts multiple distinct evidence bindings for one criterion without relaxing source IDs',async()=>{
 const question={...q,evidence:[{locator:'a',quote:evidence},{locator:'b',quote:evidence}]};
 const request=vi.fn().mockResolvedValueOnce(reply(candidate)).mockResolvedValueOnce(reply({...supported,bindings:[binding,{...binding,evidenceId:'evidence-2'}]}));
 await expect(new ModelProvider({OPENAI_API_KEY:'fixture'},request).referenceFollowup('en',question,turns,AbortSignal.timeout(5000))).resolves.toMatchObject({grounding:'model_checked'});
});
it.each([
 ['ar','أهلًا بك، تفضل، أنا أستمع.'],
 ['ar','خذ وقتك، أكمل فكرتك.'],
 ['en','I appreciate your honesty. We can leave this point for now; would you prefer another question?'],
] as const)('keeps %s social turns open without inventing criterion evidence',async(language,text)=>{
 const request=vi.fn().mockResolvedValue(reply({text,pointIds:[],readyForReview:false}));
 expect(await new ModelProvider({OPENAI_API_KEY:'fixture'},request).referenceFollowup(language,q,turns,AbortSignal.timeout(5000))).toMatchObject({grounding:'social_only',readyForReview:false});expect(request).toHaveBeenCalledTimes(1);
});
it('never permits arbitrary ungrounded text through the social-response exception',async()=>{
 const request=vi.fn().mockResolvedValue(reply({text:'Invented religious assertion',pointIds:[],readyForReview:false}));
 await expect(new ModelProvider({OPENAI_API_KEY:'fixture'},request).referenceFollowup('en',q,turns,AbortSignal.timeout(5000))).rejects.toMatchObject({code:'invalid_model_evidence'});
});
it('silently holds a clearly truncated spoken Arabic answer without a generated challenge',async()=>{
 const request=vi.fn();const input=[...turns.slice(0,1),{id:'fragment',role:'user' as const,text:'أرى أن العلاقة بين صفات الجنة—',pointIds:[],inputKind:'transcribed' as const}];
 const result=await new ModelProvider({OPENAI_API_KEY:'fixture'},request).referenceFollowup('ar',q,input,AbortSignal.timeout(5000));
 expect(result).toMatchObject({text:'',readyForReview:false,pointIds:[],grounding:'social_only'});expect(request).not.toHaveBeenCalled();
});
it('accepts model-detected incomplete spoken thoughts without assessing or asking a question',async()=>{
 const request=vi.fn().mockResolvedValue(reply({complete:false}));
 const input=[...turns.slice(0,1),{id:'fragment',role:'user' as const,text:'The relationship between those',pointIds:[],inputKind:'transcribed' as const}];
 expect(await new ModelProvider({OPENAI_API_KEY:'fixture'},request).referenceFollowup('en',q,input,AbortSignal.timeout(5000))).toMatchObject({text:'',readyForReview:false,grounding:'social_only'});
 expect(request).toHaveBeenCalledTimes(1);
});
it('checks a complete spoken contribution before generating and grounding its follow-up',async()=>{
 const request=vi.fn().mockResolvedValueOnce(reply({complete:true})).mockResolvedValueOnce(reply(candidate)).mockResolvedValueOnce(reply(supported));
 const input=turns.map(t=>t.role==='user'?{...t,inputKind:'transcribed'}:t);
 expect(await new ModelProvider({OPENAI_API_KEY:'fixture'},request).referenceFollowup('en',q,input,AbortSignal.timeout(5000))).toMatchObject({grounding:'model_checked'});
 expect(request).toHaveBeenCalledTimes(3);
});
