import {ArrowUpRight,BookOpen,Check,ChevronLeft,ChevronRight,RotateCcw,Sparkles} from 'lucide-react';
import type {Lang} from './content';
import {copy} from './content';
import {criteria,outcomes} from './domain';
import {experienceCopy,errorMessage} from './experienceCopy';
import type {useJourney} from './useJourney';

export function ReviewPanel({lang,journey:j}:{lang:Lang;journey:ReturnType<typeof useJourney>}){
  const t=copy[lang],x=experienceCopy[lang],source=j.recordSources[0],Arrow=lang==='ar'?ChevronLeft:ChevronRight;
  const current=j.attempt,practice=j.practice;
  const original=practice?.original.turns.find(t=>t.id===practice.finding.evidence.turnId);
  const second=current?.turns.find(t=>t.role==='user');
  const findings=current?.feedback?.findings||[];
  const hasAnswer=current?.turns.some(t=>t.role==='user');
  return <section className="review-layout" aria-busy={j.reviewBusy}>
    <div className="review-main">
      <div className="eyebrow"><Sparkles size={16}/>{practice?x.sameCriterion:t.review}</div>
      <h2>{practice?x.compareTitle:t.reviewTitle}</h2>
      <p className="muted">{practice?x.compareSubtitle:t.reviewSubtitle}</p>
      {current?.mode==='demo'&&<div className="preview-notice"><span className="tiny-dot"/><p>{practice?x.demoCompare:x.demoReview}</p></div>}
      {practice&&<><div className="practice-question"><span className="eyebrow">{x.question}</span><p dir="auto">{practice.question.text}</p><span className="criterion-pill">{criteria[practice.finding.criterion][lang]}</span></div><div className="answer-comparison">
        {[{label:x.original,answer:original,observation:j.comparison?.originalObservation},{label:x.second,answer:second,observation:j.comparison?.retryObservation}].map((item,index)=><section className="answer-attempt" key={index}><div className="eyebrow"><span>0{index+1}</span>{item.label}</div><blockquote dir="auto">{item.answer?.text||t.noEvidence}</blockquote>{item.observation&&<p className="comparison-observation" dir="auto">{item.observation}</p>}</section>)}
      </div></>}
      {j.reviewBusy&&<div className="review-loading" role="status"><span className="loading-spinner"/>{x.reviewLoading}</div>}
      {j.reviewError&&<div className={j.reviewError==='invalid_model_evidence'?'review-guidance':'review-error'} role={j.reviewError==='invalid_model_evidence'?'status':'alert'}><p>{errorMessage(j.reviewError,lang)}</p><button className="text-button" onClick={()=>void j.retryReview()}><RotateCcw size={15}/>{t.tryAgain}</button></div>}
      {j.comparison&&<div className="comparison-result"><span className="eyebrow">{outcomes[j.comparison.conclusion][lang]}</span><p dir="auto">{j.comparison.explanation}</p></div>}
      {!practice&&hasAnswer&&<>
        {current?.mode==='demo'&&<div className="evidence"><span className="eyebrow">{t.evidence}</span><blockquote dir="auto">{second?.text}</blockquote><p className="muted">{t.retryHint}</p></div>}
        {current?.feedback&&<p className={current.feedback.status==='insufficient_delivery'?'review-guidance':'feedback-summary'} role="status" dir="auto">{current.feedback.summary}</p>}
        {current?.feedback?.status==='wording_only'&&current.feedback.wording&&<section className="wording-reflection"><p className="scope-note">{lang==='ar'?'مراجعة لكلماتك المكتوبة. لم نقيّم فهم السؤال أو الإنصات لأن اكتمال تشغيله غير مؤكّد.':'A review of your recorded words. Understanding the question and listening were not assessed because its playback was unconfirmed.'}</p><div className="evidence"><span className="eyebrow">{x.findingEvidence}</span><blockquote dir="auto">{current.feedback.wording.quote}</blockquote></div><p className="finding-suggestion" dir="auto"><strong>{lang==='ar'?'خطوة مقترحة':'Suggested next step'}</strong>{current.feedback.wording.suggestion}</p></section>}
        {findings.length>0&&<fieldset className="findings"><legend>{x.select}</legend>{findings.map(f=>{
          const evidence=current!.turns.find(t=>t.id===f.evidence.turnId)!;
          return <label className={`finding ${j.selected===f.id?'selected':''}`} key={f.id}><div className="finding-heading"><input type="radio" name="finding" checked={j.selected===f.id} onChange={()=>j.setSelected(f.id)}/><span>{criteria[f.criterion][lang]}</span>{j.selected===f.id&&<Check size={16}/>}</div><h3 dir="auto">{f.observation}</h3><div className="evidence"><span className="eyebrow">{x.findingEvidence} · {new Date(evidence.at).toLocaleTimeString(lang,{hour:'2-digit',minute:'2-digit'})}</span><blockquote dir="auto">{f.evidence.quote}</blockquote></div><p className="finding-suggestion" dir="auto"><strong>{x.suggestion}</strong>{f.suggestion}</p><a href="#review-source" onClick={e=>e.stopPropagation()}>{source.title[lang]} <BookOpen size={13}/></a></label>;
        })}</fieldset>}
        {current?.mode==='ai'&&!j.reviewBusy&&!j.reviewError&&current.feedback&&!current.feedback.status&&!findings.length&&<p className="empty-note">{x.reviewEmpty}</p>}
      </>}
      {!hasAnswer&&<p className="empty-note">{t.noEvidence}</p>}
      {current&&<details className="review-transcript"><summary>{x.fullTranscript}</summary>{current.turns.map(turn=><div key={turn.id}><small>{turn.role==='user'?t.you:t.guide}</small><p dir="auto">{turn.text}</p>{turn.interrupted&&<small>{t.interrupted}</small>}</div>)}</details>}
      <div className="review-actions">
        {current?.feedback?.status==='insufficient_delivery'&&<button className="primary" disabled={j.reviewBusy} onClick={()=>void j.retryReview()}>{lang==='ar'?'راجع كلماتي المحفوظة':'Review my saved words'}</button>}
        {practice?<button className="primary" onClick={j.backToOriginal}><RotateCcw size={16}/>{x.originalReview}</button>:current?.mode==='ai'&&!j.reviewBusy&&!findings.length?<button className="primary" onClick={j.reset}><RotateCcw size={17}/>{lang==='ar'?'ابدأ محاولة جديدة':'Start a new attempt'}</button>:<button className="primary" disabled={!hasAnswer||j.reviewBusy||(current?.mode==='ai'&&!j.selected)} onClick={()=>void j.retry()}><RotateCcw size={17}/>{current?.mode==='demo'?t.retry:x.retryOne}</button>}
        <button className="text-button" onClick={j.reset}>{t.back}<Arrow size={16}/></button>
      </div><p className="retention-note">{x.sessionOnly}</p>
    </div>
    <aside className="source-panel" id="review-source"><BookOpen size={25}/><div className="eyebrow">{x.source}</div><p className="quran" lang="ar" dir="rtl">{source.original}</p><small>{t.excerpt}</small><a href={source.url} target="_blank" rel="noreferrer">{source.title[lang]}<ArrowUpRight size={15}/></a><p>{x.sourceScope}</p><div className="metrics"><div><span>{t.words}</span><strong>{current?.turns.filter(t=>t.role==='user').length||0}</strong></div><div><span>{x.textMetric}</span><strong>{current?.mode==='demo'?t.localMetric:j.latency===null?t.notMeasured:`${j.latency} ms`}</strong></div></div></aside>
  </section>;
}
