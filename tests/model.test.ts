// @vitest-environment node
import {describe,it,expect,vi} from 'vitest';
import {ModelProvider} from '../server/model';
import {checkFeedback,checkComparison,checkWordingReview,contextTurns,transcript} from '../server/validation';
import type {Turn} from '../src/content';
const turns:Turn[]=[{id:'q1',role:'assistant',text:'What does faith mean to you?',at:1,delivery:'text'},{id:'a1',role:'user',text:'It helps me treat people kindly.',at:2}];
const feedback={summary:'Observation of wording.',findings:[{id:'f1',criterion:'respect',observation:'Your answer refers to kind treatment.',suggestion:'Ask what the other person is curious about.',evidence:{turnId:'a1',quote:'treat people kindly'},questionTurnId:'q1',sourceId:'quran-16-125'}]};
const output=(value:unknown)=>new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:typeof value==='string'?value:JSON.stringify(value)}]}]}),{status:200});
describe('Evidence boundaries',()=>{
  it('accepts an exact quote tied to the actual answer and prior question',()=>expect(checkFeedback(feedback,turns).findings).toHaveLength(1));
  it.each(['quote','turn','source','question'])('rejects invented %s references',field=>{
    const changed=structuredClone(feedback);
    if(field==='quote')changed.findings[0].evidence.quote='I am always right';
    if(field==='turn')changed.findings[0].evidence.turnId='not-real';
    if(field==='source')changed.findings[0].sourceId='invented-source';
    if(field==='question')changed.findings[0].questionTurnId='a1';
    expect(()=>checkFeedback(changed,turns)).toThrow();
  });
  it('accepts insufficient evidence without inventing a finding',()=>expect(checkFeedback({summary:'Not enough evidence.',findings:[]},turns).findings).toHaveLength(0));
  it('removes uncertain assistant content from model context',()=>{
    const context=contextTurns([{...turns[0],text:'UNHEARD SECRET CONTENT',interrupted:true,delivery:'uncertain'},turns[1]]);
    expect(JSON.stringify(context)).not.toContain('UNHEARD SECRET CONTENT');
    expect(context[0].content).toContain('Do not assume');
  });
  it('rejects feedback based on an unconfirmed question',()=>expect(()=>checkFeedback(feedback,[{...turns[0],delivery:'uncertain'},turns[1]])).toThrow());
  it('rejects duplicate IDs and unsupported languages in transcript shape',()=>expect(()=>transcript([turns[0],turns[0]])).toThrow());
  it('rejects a changed comparison criterion or invented retry quote',()=>{
    const c={criterion:'respect',originalQuote:'treat people kindly',retryQuote:'new words',originalObservation:'A',retryObservation:'B',conclusion:'similar',explanation:'No clear difference'};
    expect(()=>checkComparison(c,turns[1],{...turns[1],text:'Different answer'},'respect')).toThrow();
    expect(()=>checkComparison(c,turns[1],{...turns[1],text:'new words'},'understanding')).toThrow();
  });
});
describe('OpenAI REST integration with mocked transport',()=>{
  it('supplies the actual catalog to conversation and limits unsupported factual claims',async()=>{
    const request=vi.fn().mockResolvedValue(output('What would you like to understand?'));
    await new ModelProvider({OPENAI_API_KEY:'test-only'},request).converse('en',turns,new AbortController().signal);
    const body=JSON.parse(request.mock.calls[0][1].body);
    expect(body.instructions).toContain('https://quran.com/16/125');
    expect(body.instructions).toContain('وَجَادِلْهُم');
    expect(body.instructions).toContain('available sources do not establish it');
    expect(body.instructions).toContain('never label a translation as the original');
  });

  it('fails closed without credentials',async()=>{
    const request=vi.fn();const provider=new ModelProvider({},request as typeof fetch);
    await expect(provider.converse('ar',turns,new AbortController().signal)).rejects.toMatchObject({code:'model_not_configured'});
    expect(request).not.toHaveBeenCalled();
  });
  it('requests stateless structured feedback and validates its evidence',async()=>{
    const request=vi.fn().mockResolvedValue(output(feedback));const provider=new ModelProvider({OPENAI_API_KEY:'test-only'},request);
    const result=await provider.feedback('en',turns,new AbortController().signal);
    const body=JSON.parse(request.mock.calls[0][1].body);
    expect(body.store).toBe(false);expect(body.text.format.type).toBe('json_schema');expect(body.text.format.strict).toBe(true);
    expect(result.findings[0].evidence.quote).toBe('treat people kindly');
  });
  it('reports authentication failure without echoing provider bodies or keys',async()=>{
    const provider=new ModelProvider({OPENAI_API_KEY:'test-only'},vi.fn().mockResolvedValue(new Response('sensitive-provider-detail',{status:401})));
    await expect(provider.converse('en',turns,new AbortController().signal)).rejects.toMatchObject({message:'model_auth_failed'});
  });
  it('rejects refusal and truncated output',async()=>{
    for(const body of [{status:'incomplete',output:[]},{status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'No'}]}]}]){
      const provider=new ModelProvider({OPENAI_API_KEY:'test-only'},vi.fn().mockResolvedValue(new Response(JSON.stringify(body))));
      await expect(provider.converse('en',turns,new AbortController().signal)).rejects.toThrow();
    }
  });
  it('propagates cancellation without a scripted fallback',async()=>{
    const controller=new AbortController();controller.abort();
    const provider=new ModelProvider({OPENAI_API_KEY:'test-only'},vi.fn().mockRejectedValue(new Error('aborted')));
    await expect(provider.converse('en',turns,controller.signal)).rejects.toMatchObject({code:'request_cancelled'});
  });
});

describe('Review of interrupted conversations',()=>{
 it.each(['ar','en'] as const)('reviews real user wording without assuming unheard context (%s)',async language=>{
  const request=vi.fn().mockResolvedValue(output({summary:'You described kind treatment.',turnId:'a1',quote:'treat people kindly',suggestion:'Consider adding one concrete example.'}));
  const result=await new ModelProvider({OPENAI_API_KEY:'test'},request).feedback(language,[{...turns[0],text:'UNHEARD QUESTION',interrupted:true,delivery:'uncertain'},turns[1]],new AbortController().signal);
  expect(result.findings).toEqual([]);expect(result).toHaveProperty('status','wording_only');
  expect(result).toHaveProperty('wording.quote','treat people kindly');
  const sent=JSON.parse(request.mock.calls[0][1].body);
  expect(sent.input[0].content).not.toContain('UNHEARD QUESTION');expect(sent.input[0].content).toContain(turns[1].text);
  expect(sent.instructions).toContain('Never assume what they heard');
 });
 it('rejects invented quotes and assistant-only evidence in a wording review',()=>{
  for(const item of [{turnId:'a1',quote:'invented words'},{turnId:'q1',quote:turns[0].text}])expect(()=>checkWordingReview({...item,summary:'Summary',suggestion:'Suggestion'},turns)).toThrow();
 });
 it('sends only confirmed question-answer pairs for assessment',async()=>{
  const request=vi.fn().mockResolvedValue(output(feedback));
  await new ModelProvider({OPENAI_API_KEY:'test'},request).feedback('en',[{id:'unheard',role:'assistant',text:'UNHEARD',at:0,delivery:'uncertain'},{id:'excluded',role:'user',text:'EXCLUDED',at:0},...turns],new AbortController().signal);
  const sent=JSON.parse(request.mock.calls[0][1].body).input[0].content;
  expect(sent).not.toContain('UNHEARD');expect(sent).not.toContain('EXCLUDED');expect(sent).toContain('treat people kindly');
 });
});

describe('DeepSeek adapter — mocked HTTPS, not live model verification',()=>{
 const env={AI_PROVIDER:'deepseek',DEEPSEEK_API_KEY:'test-deepseek',OPENAI_API_KEY:'test-openai'};
 const completion=(value:unknown,finish_reason='stop')=>new Response(JSON.stringify({choices:[{finish_reason,message:{content:typeof value==='string'?value:JSON.stringify(value)}}]}));
 it.each(['ar','en'] as const)('routes %s text with persona, sources and unavailable-turn handling',async lang=>{
  const request=vi.fn().mockResolvedValue(completion('Reply'));
  await new ModelProvider(env,request).converse(lang,[{...turns[0],text:'UNHEARD',delivery:'uncertain'},turns[1]],new AbortController().signal);
  const [url,init]=request.mock.calls[0];const body=JSON.parse(init.body);
  expect(url).toBe('https://api.deepseek.com/chat/completions');expect(init.headers.Authorization).toBe('Bearer test-deepseek');
  expect(body.messages[0].content).toContain('You are Basira');expect(body.messages[0].content).toContain('https://quran.com/16/125');
  expect(body.messages[1].content).not.toContain('UNHEARD');expect(body.thinking.type).toBe('disabled');
 });
 it('validates structured feedback and rejects fabricated evidence',async()=>{
  const request=vi.fn().mockResolvedValueOnce(completion(feedback)).mockResolvedValueOnce(completion({...feedback,findings:[{...feedback.findings[0],sourceId:'invented'}]}));
  const p=new ModelProvider(env,request),signal=new AbortController().signal;
  expect((await p.feedback('en',turns,signal)).findings).toHaveLength(1);
  expect(JSON.parse(request.mock.calls[0][1].body).response_format.type).toBe('json_object');
  await expect(p.feedback('en',turns,signal)).rejects.toMatchObject({code:'invalid_model_evidence'});
 });
 it('preserves exact-quote validation even when JSON matches the schema',async()=>{
  const value=structuredClone(feedback);value.findings[0].evidence.quote='fabricated';
  await expect(new ModelProvider(env,vi.fn().mockResolvedValue(completion(value))).feedback('ar',turns,new AbortController().signal)).rejects.toThrow();
 });
 it.each([['{}','stop'],['not JSON','stop'],['','stop'],[JSON.stringify(feedback),'length']])('rejects malformed, incomplete or empty feedback',async(content,finish)=>{
  await expect(new ModelProvider(env,vi.fn().mockResolvedValue(completion(content,finish))).feedback('en',turns,new AbortController().signal)).rejects.toThrow();
 });
 it('does not fall back to OpenAI when DeepSeek credentials are missing',async()=>{
  const request=vi.fn(),p=new ModelProvider({AI_PROVIDER:'deepseek',OPENAI_API_KEY:'test'},request);
  expect(p.ready).toBe(false);expect(p.missing).toEqual(['DEEPSEEK_API_KEY']);expect(p.speechReady).toBe(true);
  await expect(p.converse('en',[],new AbortController().signal)).rejects.toMatchObject({code:'model_not_configured'});expect(request).not.toHaveBeenCalled();
 });
 it('supports DeepSeek-only text but does not misroute speech credentials',async()=>{
  const request=vi.fn(),p=new ModelProvider({AI_PROVIDER:'deepseek',DEEPSEEK_API_KEY:'test'},request);
  expect(p.ready).toBe(true);expect(p.speechReady).toBe(false);
  await expect(p.speech('ar','مرحبا',new AbortController().signal)).rejects.toMatchObject({code:'model_not_configured'});expect(request).not.toHaveBeenCalled();
 });
 it('keeps speech and frame OCR on OpenAI with separate credentials',async()=>{
  const request=vi.fn().mockResolvedValueOnce(new Response(new Uint8Array([0,0]))).mockResolvedValueOnce(output({frames:[]}));
  const p=new ModelProvider(env,request),signal=new AbortController().signal;
  await p.speech('en','Hello',signal);await p.readFrames([],signal);
  expect(request.mock.calls.every(([url,init])=>url.startsWith('https://api.openai.com/')&&init.headers.Authorization==='Bearer test-openai')).toBe(true);
 });
 it('compares attempts using the same validated criterion',async()=>{
  const value={criterion:'respect',originalQuote:'treat people kindly',retryQuote:'your experience',originalObservation:'A',retryObservation:'B',conclusion:'similar',explanation:'No established improvement'};
  const p=new ModelProvider(env,vi.fn().mockResolvedValue(completion(value)));
  const comparison=await p.compare('en','respect',turns[0],turns[1],{...turns[1],text:'Tell me about your experience.'},new AbortController().signal);
  expect(comparison.conclusion).toBe('similar');
 });
 it.each([401,402,429,500])('sanitizes HTTP %s errors without provider fallback',async status=>{
  const request=vi.fn().mockResolvedValue(new Response('private-provider-details',{status}));
  await expect(new ModelProvider(env,request).converse('en',[],new AbortController().signal)).rejects.not.toThrow('private-provider-details');expect(request).toHaveBeenCalledTimes(1);
 });
 it('rejects an unknown provider instead of silently using OpenAI',async()=>{
  const request=vi.fn(),p=new ModelProvider({AI_PROVIDER:'typo',OPENAI_API_KEY:'test'},request);expect(p.ready).toBe(false);
  await expect(p.converse('en',[],new AbortController().signal)).rejects.toThrow();expect(request).not.toHaveBeenCalled();
 });
});
