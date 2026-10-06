import React from 'react';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {ReferencePractice} from '../src/ReferencePractice';
import bank from '../data/training/questions.json';
import type {Config} from '../src/useJourney';
const question=bank.questions[0];
const config:Config={ai:{configured:true,missing:[]},voice:{configured:false,languages:['ar','en']},avatar:{configured:false,missing:[]},languages:['ar','en']};
beforeEach(()=>{localStorage.clear();vi.stubGlobal('fetch',vi.fn(async(path:string,init?:RequestInit)=>{
 if(path.endsWith('/questions'))return new Response(JSON.stringify({questions:bank.questions}));
 const body=JSON.parse(String(init?.body));return new Response(JSON.stringify({verdict:'partial',spokenFeedback:'Fixture assessment based on the submitted answer.',points:question.points.map((p,i)=>({id:p.id,status:i?'missing':'covered',answerQuote:i?'':body.answer,explanation:'Fixture reference comparison.'}))}));
}));});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
for(const lang of ['ar','en'] as const)it(`${lang}: reference reveal, actual answers, retry, reload and deletion (mocked model)`,async()=>{
 const ar=lang==='ar';render(<ReferencePractice lang={lang} config={config} onBack={vi.fn()}/>);
 await screen.findByRole('heading',{name:question.question[lang]});
 fireEvent.click(screen.getByRole('button',{name:ar?'عرض الجواب المرجعي':'Show reference answer'}));
 expect(screen.getByText(question.answer[lang])).toBeVisible();
 fireEvent.change(screen.getByRole('textbox',{name:ar?'إجابتك':'Your answer'}),{target:{value:'My original answer'}});
 fireEvent.click(screen.getByRole('button',{name:ar?'قيّم إجابتي بالمرجع':'Compare my answer with the reference'}));
 await screen.findByText('Fixture assessment based on the submitted answer.');
 fireEvent.click(screen.getByRole('button',{name:ar?'أعد الإجابة عن السؤال نفسه':'Retry the same question'}));
 fireEvent.change(screen.getByRole('textbox',{name:ar?'إجابتك':'Your answer'}),{target:{value:'My second answer'}});
 fireEvent.click(screen.getByRole('button',{name:ar?'قيّم إجابتي بالمرجع':'Compare my answer with the reference'}));
 await screen.findByRole('heading',{name:ar?'المحاولات بنفس المعايير':'Attempts against the same criteria'});
 const saved=JSON.parse(localStorage.getItem('basira.reference-practice.v1')!);
 expect(saved[0].attempts.map((a:any)=>a.answer)).toEqual(['My original answer','My second answer']);
 expect(saved[0].question.source.url).toBe(question.source.url);
 cleanup();render(<ReferencePractice lang={lang} config={config} onBack={vi.fn()}/>);
 fireEvent.click(await screen.findByRole('button',{name:ar?'فتح':'Open'}));
 expect(screen.getAllByText('My original answer').length).toBeGreaterThan(0);
 fireEvent.click(screen.getByRole('button',{name:ar?'حذف':'Delete'}));
 await waitFor(()=>expect(JSON.parse(localStorage.getItem('basira.reference-practice.v1')!)).toEqual([]));
});
it('shows an unavailable context without silently substituting another question',async()=>{
 render(<ReferencePractice lang="en" config={config} onBack={vi.fn()}/>);
 await screen.findByRole('heading',{name:question.question.en});
 fireEvent.change(screen.getByLabelText('Dialogue context'),{target:{value:'christianity'}});
 expect(screen.getByText(/No source-checked questions/)).toBeVisible();
 expect(screen.queryByRole('button',{name:'Compare my answer with the reference'})).not.toBeInTheDocument();
});
for(const lang of ['ar','en'] as const)it(`${lang}: follow-up failure preserves answer, recovery uses history, review and retry preserve original (mocked model)`,async()=>{
 const ar=lang==='ar';let calls=0;const assessed:any[]=[];
 vi.stubGlobal('fetch',vi.fn(async(path:string,init?:RequestInit)=>{
  if(path.endsWith('/questions'))return new Response(JSON.stringify({questions:bank.questions}));
  const body=JSON.parse(String(init?.body));
  if(path.endsWith('/followup')){
   calls++;if(calls===1)return new Response(JSON.stringify({error:'model_connection_failed'}),{status:502});
   expect(body.turns[1].text).toBe('My first answer');
   return new Response(JSON.stringify({text:'Can you explain your reasoning?',pointIds:[question.points[0].id],readyForReview:false}));
  }
  assessed.push(body);return new Response(JSON.stringify({verdict:'partial',spokenFeedback:'Discussion assessed.',points:question.points.map((p,i)=>({id:p.id,status:i?'missing':'covered',answerQuote:i?'':body.turns.at(-1).text,turnId:body.turns.at(-1).id,explanation:'Reference comparison.'}))}));
 }));
 render(<ReferencePractice lang={lang} config={config} onBack={vi.fn()}/>);
 await screen.findByRole('heading',{name:question.question[lang]});
 const input=screen.getByRole('textbox',{name:ar?'إجابتك':'Your answer'});
 fireEvent.change(input,{target:{value:'My first answer'}});
 const next=screen.getByRole('button',{name:ar?'تابع المناقشة':'Continue discussion'});
 fireEvent.click(next);await screen.findByRole('alert');
 expect(JSON.parse(localStorage.getItem('basira.reference-practice.v1')!)[0].turns[1].text).toBe('My first answer');
 fireEvent.click(next);await screen.findByText('Can you explain your reasoning?');
 fireEvent.change(input,{target:{value:'My elaboration'}});
 fireEvent.click(screen.getByRole('button',{name:ar?'قيّم إجابتي بالمرجع':'Compare my answer with the reference'}));
 await screen.findByText('Discussion assessed.');
 expect(assessed[0].turns).toHaveLength(4);
 const original=JSON.parse(localStorage.getItem('basira.reference-practice.v1')!)[0].attempts[0];
 expect(original.turns[3].text).toBe('My elaboration');
 fireEvent.click(screen.getByRole('button',{name:ar?'أعد الإجابة عن السؤال نفسه':'Retry the same question'}));
 fireEvent.change(input,{target:{value:'Independent retry'}});
 fireEvent.click(screen.getByRole('button',{name:ar?'قيّم إجابتي بالمرجع':'Compare my answer with the reference'}));
 await screen.findByRole('heading',{name:ar?'المحاولات بنفس المعايير':'Attempts against the same criteria'});
 const attempts=JSON.parse(localStorage.getItem('basira.reference-practice.v1')!)[0].attempts;
 expect(attempts[0]).toEqual(original);expect(attempts[1].turns).toHaveLength(2);
});
it('selects a finding, shows reference evidence and preserves targeted retry metadata',async()=>{
 render(<ReferencePractice lang="en" config={config} onBack={vi.fn()}/>);
 await screen.findByRole('heading',{name:question.question.en});
 fireEvent.change(screen.getByRole('textbox',{name:'Your answer'}),{target:{value:'First answer'}});
 fireEvent.click(screen.getByRole('button',{name:'Compare my answer with the reference'}));
 await screen.findByText('Fixture assessment based on the submitted answer.');
 const finding=screen.getByRole('button',{name:new RegExp(question.points[1].text.en.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))});
 fireEvent.click(finding);expect(finding).toHaveAttribute('aria-pressed','true');
 fireEvent.click(screen.getByText('Reference answer and evidence'));
 expect(screen.getByText(question.answer.en)).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Practise this point'}));
 expect(screen.getByRole('status')).toHaveTextContent(question.points[1].text.en);
 fireEvent.change(screen.getByRole('textbox',{name:'Your answer'}),{target:{value:'Focused retry'}});
 fireEvent.click(screen.getByRole('button',{name:'Compare my answer with the reference'}));
 await screen.findByRole('heading',{name:'Attempts against the same criteria'});
 const saved=JSON.parse(localStorage.getItem('basira.reference-practice.v1')!)[0];
 expect(saved.attempts[1].focusPointId).toBe(question.points[1].id);
 expect(saved.attempts[0].answer).toBe('First answer');
});
it('preserves an unanswered final follow-up without submitting it as learner evidence',async()=>{
 let submitted:any;
 vi.stubGlobal('fetch',vi.fn(async(path:string,init?:RequestInit)=>{
  if(path.endsWith('/questions'))return new Response(JSON.stringify({questions:bank.questions}));
  if(path.endsWith('/followup'))return new Response(JSON.stringify({text:'Unanswered follow-up?',pointIds:[question.points[0].id],readyForReview:false}));
  submitted=JSON.parse(String(init?.body));return new Response(JSON.stringify({verdict:'partial',spokenFeedback:'Reviewed answered turns.',points:question.points.map(p=>({id:p.id,status:'missing',answerQuote:'',explanation:'No evidence.'}))}));
 }));
 render(<ReferencePractice lang="en" config={config} onBack={vi.fn()}/>);
 await screen.findByRole('heading',{name:question.question.en});
 fireEvent.change(screen.getByRole('textbox',{name:'Your answer'}),{target:{value:'My answer'}});
 fireEvent.click(screen.getByRole('button',{name:'Continue discussion'}));
 await screen.findByText('Unanswered follow-up?');
 fireEvent.click(screen.getByRole('button',{name:'Compare my answer with the reference'}));
 await screen.findByText('Reviewed answered turns.');
 expect(submitted.turns).toHaveLength(2);
 const original=JSON.parse(localStorage.getItem('basira.reference-practice.v1')!)[0].attempts[0];
 expect(original.turns).toHaveLength(3);expect(original.turns[2].text).toBe('Unanswered follow-up?');
});

for(const lang of ['ar','en'] as const)it(`${lang}: automatically advances within context, saves each reference, survives reload, exhausts without repeats and retries only the selected question`,async()=>{
 const ar=lang==='ar';const q2={...question,id:'second-question',question:{ar:'السؤال الثاني؟',en:'Second question?'}};
 const other={...question,id:'other-background',tradition:'judaism'};
 const assessed:string[]=[];
 vi.stubGlobal('fetch',vi.fn(async(path:string,init?:RequestInit)=>{
  if(path.endsWith('/questions'))return new Response(JSON.stringify({questions:[question,other,q2]}));
  const body=JSON.parse(String(init?.body));
  if(path.endsWith('/followup'))return new Response(JSON.stringify({text:'',pointIds:[],readyForReview:true}));
  assessed.push(body.questionId);
  return new Response(JSON.stringify({verdict:'partial',spokenFeedback:'Saved review '+body.questionId,points:question.points.map(p=>({id:p.id,status:'missing',answerQuote:'',explanation:'Fixture.'}))}));
 }));
 const mount=()=>render(<ReferencePractice lang={lang} config={config} onBack={vi.fn()}/>);
 const input=()=>screen.getByRole('textbox',{name:ar?'إجابتك':'Your answer'});
 const advance=()=>fireEvent.click(screen.getByRole('button',{name:ar?'تابع المناقشة':'Continue discussion'}));
 mount();await screen.findByRole('heading',{name:question.question[lang]});
 fireEvent.change(input(),{target:{value:'First answer'}});advance();
 await screen.findByRole('heading',{name:q2.question[lang]});
 let stored=JSON.parse(localStorage.getItem('basira.reference-practice.v1')!);
 expect(stored).toHaveLength(2);expect(stored[0].sessionId).toBe(stored[1].sessionId);
 const original=stored[1].attempts[0];expect(original.answer).toBe('First answer');expect(stored[1].question.source).toEqual(question.source);
 fireEvent.change(input(),{target:{value:'Second answer'}});
 cleanup();mount();await screen.findByRole('heading',{name:question.question[lang]});
 fireEvent.click(screen.getAllByRole('button',{name:ar?'فتح':'Open'})[0]);
 expect(input()).toHaveValue('Second answer');advance();
 await screen.findByText(ar?/أكملت جميع الأسئلة/:/completed all available questions/);
 expect(assessed).toEqual([question.id,q2.id]);
 fireEvent.click(screen.getByRole('button',{name:ar?'أعد الإجابة عن السؤال نفسه':'Retry the same question'}));
 fireEvent.change(input(),{target:{value:'Targeted retry'}});advance();
 await screen.findByRole('heading',{name:ar?'المحاولات بنفس المعايير':'Attempts against the same criteria'});
 stored=JSON.parse(localStorage.getItem('basira.reference-practice.v1')!);
 expect(stored).toHaveLength(2);expect(stored.find((r:any)=>r.question.id===question.id).attempts[0]).toEqual(original);
 expect(stored.find((r:any)=>r.question.id===q2.id).attempts).toHaveLength(2);
});

it('does not advance or lose the answer when automatic assessment fails; retries safely',async()=>{
 let fail=true;
 const q2={...question,id:'next',question:{ar:'التالي',en:'Next question'}};
 vi.stubGlobal('fetch',vi.fn(async(path:string,init?:RequestInit)=>{
  if(path.endsWith('/questions'))return new Response(JSON.stringify({questions:[question,q2]}));
  if(path.endsWith('/followup'))return new Response(JSON.stringify({text:'',pointIds:[],readyForReview:true}));
  if(fail)return new Response(JSON.stringify({error:'model_connection_failed'}),{status:502});
  return new Response(JSON.stringify({verdict:'partial',spokenFeedback:'Reviewed.',points:question.points.map(p=>({id:p.id,status:'missing',answerQuote:'',explanation:'Fixture.'}))}));
 }));
 render(<ReferencePractice lang="en" config={config} onBack={vi.fn()}/>);
 await screen.findByRole('heading',{name:question.question.en});
 fireEvent.change(screen.getByRole('textbox',{name:'Your answer'}),{target:{value:'Keep this answer'}});
 fireEvent.click(screen.getByRole('button',{name:'Continue discussion'}));await screen.findByRole('alert');
 let stored=JSON.parse(localStorage.getItem('basira.reference-practice.v1')!);expect(stored).toHaveLength(1);expect(stored[0].turns[1].text).toBe('Keep this answer');
 fail=false;fireEvent.click(screen.getByRole('button',{name:'Continue discussion'}));
 await screen.findByRole('heading',{name:'Next question'});
 stored=JSON.parse(localStorage.getItem('basira.reference-practice.v1')!);expect(stored).toHaveLength(2);expect(stored[1].attempts).toHaveLength(1);
});
it('displays every server-resolved evidence passage without joining them into an invented quotation',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(path:string,init?:RequestInit)=>{
  if(path.endsWith('/questions'))return new Response(JSON.stringify({questions:bank.questions}));
  return new Response(JSON.stringify({verdict:'partial',spokenFeedback:'Multiple passages assessed.',points:question.points.map((p,i)=>({id:p.id,status:i?'missing':'covered',answerQuote:i?'':'First exact passage.',explanation:'Supported.',evidence:i?[]:[{passageId:'learner-1-1',quote:'First exact passage.',start:0,end:20},{passageId:'learner-1-2',quote:'Second exact passage.',start:21,end:42}]}))}));
 }));
 render(<ReferencePractice lang="en" config={config} onBack={vi.fn()}/>);
 await screen.findByRole('heading',{name:question.question.en});
 fireEvent.change(screen.getByRole('textbox',{name:'Your answer'}),{target:{value:'First exact passage. Second exact passage.'}});
 fireEvent.click(screen.getByRole('button',{name:'Compare my answer with the reference'}));
 await screen.findByText('Multiple passages assessed.');
 fireEvent.click(screen.getByRole('button',{name:new RegExp(question.points[0].text.en.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))}));
 expect(screen.getByText('First exact passage.').tagName).toBe('BLOCKQUOTE');
 expect(screen.getByText('Second exact passage.').tagName).toBe('BLOCKQUOTE');
});
