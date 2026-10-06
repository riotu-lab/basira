// DOM + mocked HTTP tests. No browser rendering or live provider calls.
import React from 'react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {App} from '../src/main';
const configured=(ai=false)=>({ai:{configured:ai,missing:ai?[]:['OPENAI_API_KEY']},voice:{configured:ai,languages:['ar','en']},avatar:{configured:false,missing:['LIVEAVATAR_API_KEY']},languages:['ar','en']});
const result=(value:unknown,ok=true)=>({ok,json:async()=>value});
beforeEach(()=>{
  localStorage.clear();
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(result(configured())));
  vi.stubGlobal('matchMedia',vi.fn().mockReturnValue({matches:true}));
  Element.prototype.scrollTo=vi.fn();
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
async function liveText(){
 vi.stubGlobal('fetch',vi.fn(async(path:string)=>result(path==='/api/config'?configured(true):path==='/api/feedback'?{summary:'Mocked review',findings:[]}:{text:'ماذا يعني لك الإيمان؟',latencyMs:1})));
 render(<App/>);fireEvent.click(screen.getByRole('button',{name:'نص'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'ابدأ المناقشة'})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:'ابدأ المناقشة'}));
 await waitFor(()=>expect(document.querySelector('.turn p')).toHaveTextContent('ماذا يعني لك الإيمان؟'));
 return screen.findByRole('textbox');
}
describe('Live-only public setup',()=>{
 for(const language of ['ar','en'] as const)it(`${language}: removes scripted entry without disabling real text input`,async()=>{
  render(<App initialLang={language}/>);
  await waitFor(()=>expect(screen.getByRole('combobox')).toHaveValue('ar'));
  expect(screen.queryByRole('button',{name:language==='ar'?'معاينة مكتوبة':'Scripted preview'})).not.toBeInTheDocument();
  expect(screen.getByRole('button',{name:language==='ar'?'نص':'Text'})).toBeVisible();
 });
 it('does not start a scripted fallback when credentials are missing',async()=>{
  render(<App/>);expect(await screen.findByText('غير متصل')).toBeVisible();
  expect(screen.getByRole('button',{name:'ابدأ المناقشة'})).toBeDisabled();
  expect(document.querySelector('.engine-switch')).not.toBeInTheDocument();
 });
 it('keeps interface and session languages independent and transcript hideable',async()=>{
  await liveText();fireEvent.click(screen.getByRole('button',{name:'لغة الواجهة'}));
  expect(document.querySelector('.turn p')).toHaveAttribute('dir','rtl');
  fireEvent.click(screen.getByRole('button',{name:'Hide transcript'}));
  await waitFor(()=>expect(screen.queryByRole('log')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button',{name:'Show transcript'}));expect(screen.getByRole('log')).toBeInTheDocument();
 });
});

describe('Real engine wiring with mocked provider responses',()=>{
  for(const language of ['ar','en'])it(`${language}: finding selection, exact question retry, same criterion comparison`,async()=>{
    const question=language==='ar'?'ماذا يعني الإيمان في حياتك اليومية؟':'What does faith mean in your daily life?';
    const original=language==='ar'?'يعني أن أحسن معاملة الناس.':'It means treating people with care.';
    const second=language==='ar'?'ما الجانب الذي تريد فهمه؟':'Which part would you like to understand?';
    const requests:{path:string;body:any}[]=[];
    vi.stubGlobal('fetch',vi.fn(async(path:string,init?:RequestInit)=>{
      const body=init?.body?JSON.parse(String(init.body)):{};requests.push({path,body});
      if(path==='/api/config')return result(configured(true));
      if(path==='/api/conversation')return result({text:body.turns.length?'Tell me a little more.':question,latencyMs:42});
      if(path==='/api/feedback'){
        const answer=body.turns.find((t:any)=>t.role==='user');
        return result({summary:'Mocked feedback; not live AI.',findings:[{id:'f1',criterion:'respect',observation:'The answer describes your own practice.',suggestion:'Leave room for the other perspective.',evidence:{turnId:answer.id,quote:answer.text},questionTurnId:body.turns[0].id,sourceId:'quran-16-125'}]});
      }
      if(path==='/api/compare')return result({criterion:body.criterion,originalQuote:original,retryQuote:second,originalObservation:'First wording.',retryObservation:'Second wording.',conclusion:'insufficient_evidence',explanation:'No improvement is assumed.'});
      throw Error('Unexpected request');
    }));
    render(<App/>);if(language==='en')fireEvent.click(screen.getByRole('button',{name:'لغة الواجهة'}));
    fireEvent.click(screen.getByRole('button',{name:language==='ar'?'نص':'Text'}));
    await waitFor(()=>expect(screen.getByRole('button',{name:language==='ar'?'ابدأ المناقشة':'Begin practice'})).toBeEnabled());
    fireEvent.change(screen.getByRole('combobox'),{target:{value:language}});
    fireEvent.click(screen.getByRole('button',{name:language==='ar'?'ابدأ المناقشة':'Begin practice'}));
    fireEvent.change(await screen.findByRole('textbox'),{target:{value:original}});
    await waitFor(()=>expect(document.querySelector('.turn p')).toHaveTextContent(question));
    fireEvent.click(screen.getByRole('button',{name:language==='ar'?'إرسال':'Send'}));
    await waitFor(()=>expect(document.querySelectorAll('.turn')).toHaveLength(3));
    fireEvent.click(screen.getByRole('button',{name:language==='ar'?'إنهاء ومراجعة':'Finish & reflect'}));
    const selection=await screen.findByRole('radio');fireEvent.click(selection);
    fireEvent.click(screen.getByRole('button',{name:language==='ar'?'تدرّب على الملاحظة المختارة':'Practise the selected finding'}));
    await screen.findByRole('textbox');expect(document.querySelector('.turn p')).toHaveTextContent(question);
    fireEvent.change(screen.getByRole('textbox'),{target:{value:second}});
    fireEvent.click(screen.getByRole('button',{name:language==='ar'?'إرسال':'Send'}));
    await screen.findByText('No improvement is assumed.');

    // Simulate a page reload: unmount all state, then reopen the saved retry.
    cleanup();render(<App/>);
    if(language==='en')fireEvent.click(screen.getByRole('button',{name:'لغة الواجهة'}));
    const archive=document.querySelector('.saved-sessions')!;fireEvent.click(archive.querySelector('summary')!);
    await waitFor(()=>expect(archive.querySelectorAll('li')).toHaveLength(2));
    fireEvent.click(archive.querySelector('li button')!);
    await screen.findByText('No improvement is assumed.');
    expect(document.querySelectorAll('.answer-attempt')[0]).toHaveTextContent(original);
    expect(document.querySelectorAll('.answer-attempt')[1]).toHaveTextContent(second);
    const comparison=requests.find(r=>r.path==='/api/compare')!;
    expect(comparison.body.criterion).toBe('respect');
    expect(comparison.body.original[1].text).toBe(original);
    expect(comparison.body.retry[0].text).toBe(question);
    expect(document.querySelectorAll('.answer-attempt')[0]).toHaveTextContent(original);
    fireEvent.click(screen.getByRole('button',{name:language==='ar'?'العودة إلى المراجعة الأولى':'Back to the first review'}));
    await waitFor(()=>expect(document.querySelector('.finding blockquote')).toHaveTextContent(original));
    fireEvent.click(screen.getByRole('button',{name:language==='ar'?'حذف جميع الجلسات المحلية':'Delete all local sessions'}));
    await waitFor(()=>expect(localStorage.getItem('basira.sessions.v1')).toBeNull());
    cleanup();render(<App/>);expect(document.querySelector('.saved-sessions')).not.toBeInTheDocument();
  });
  it('shows a model error without substituting scripted content',async()=>{
    vi.stubGlobal('fetch',vi.fn(async(path:string)=>path==='/api/config'?result(configured(true)):result({error:'model_auth_failed'},false)));
    render(<App/>);fireEvent.click(screen.getByRole('button',{name:'نص'}));await waitFor(()=>expect(screen.getByRole('button',{name:'ابدأ المناقشة'})).toBeEnabled());
    fireEvent.click(screen.getByRole('button',{name:'ابدأ المناقشة'}));
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(document.querySelectorAll('.turn')).toHaveLength(0);
    expect(screen.getByRole('button',{name:'أعد طلب الرد'})).toBeVisible();
  });
  it('retains the answer when connection is interrupted',async()=>{
    fireEvent.change(await liveText(),{target:{value:'كيف يمكن أن أفهمك؟'}});
    fireEvent.click(screen.getByRole('button',{name:'إرسال'}));
    fireEvent(window,new Event('offline'));
    expect(await screen.findByRole('alert')).toHaveTextContent('انقطع الاتصال');
    fireEvent.click(screen.getByRole('button',{name:'إنهاء ومراجعة'}));
    await waitFor(()=>expect(document.querySelector('.review-transcript')).toHaveTextContent('كيف يمكن أن أفهمك؟'));
  });
});
