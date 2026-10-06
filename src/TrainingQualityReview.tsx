import type {Lang} from './content';
import type {TrainingQuality,QualityCriterion} from './trainingQuality';
import {QUALITY_CRITERIA,qualityStatuses} from './trainingQuality';
export function TrainingQualityReview({quality,original,lang,disabled,onRetry}:{quality?:TrainingQuality;original?:TrainingQuality;lang:Lang;disabled:boolean;onRetry:(id:QualityCriterion)=>void}){
 const ar=lang==='ar';
 return <section className="training-quality" aria-label={ar?'جودة الإجابة والتواصل واللغة':'Answer, communication and language quality'}>
 <h3>{ar?'جودة الإجابة وأسلوب التعبير':'Answer quality and expression'}</h3>
 <p className="scope-note">{ar?'نراجع المعنى والأسلوب كلًا على حدة. سلامة الأسلوب لا تثبت صحة المعلومة، والصياغة غير المتقنة لا تلغي الفكرة الصحيحة.':'Content and expression are reviewed separately. Polished wording does not prove factual accuracy; imperfect wording does not invalidate a correct idea.'}</p>
 {!quality?<p>{ar?'هذا التقرير القديم لا يتضمن تقييم الأسلوب واللغة. أعد التدريب للحصول على تقييم جديد.':'This older report has no communication or language assessment. Retry to receive a new assessment.'}</p>:<>
 {(['content','communication','language'] as const).map(group=><section key={group}><h4>{({content:ar?'صلة المحتوى بالسؤال':'Content relevance',communication:ar?'التواصل وأسلوب العرض':'Communication and presentation',language:ar?'الدقة اللغوية':'Language accuracy'})[group]}</h4>
 {quality.findings.filter(f=>QUALITY_CRITERIA[f.id].group===group).map(f=>{const before=original?.findings.find(p=>p.id===f.id);return <details className="quality-finding" data-status={f.status} key={f.id}><summary><span>{QUALITY_CRITERIA[f.id][lang]}</span><small>{qualityStatuses[lang][f.status]}</small></summary><p dir="auto">{f.explanation}</p>{f.evidence.map(e=><blockquote key={e.passageId} dir="auto">{e.quote}</blockquote>)}{f.suggestion&&<p dir="auto"><strong>{ar?'اقتراح للتدريب: ':'Practice suggestion: '}</strong>{f.suggestion}</p>}{before&&<p className="scope-note">{ar?'الأصلية':'Original'}: {qualityStatuses[lang][before.status]} → {ar?'الحالية':'Current'}: {qualityStatuses[lang][f.status]}. {ar?'تغير التصنيف ليس حكمًا عامًا على قدراتك.':'A classification change is not a judgment of your overall ability.'}</p>}{original&&!before&&<p>{ar?'لا توجد نتيجة أصلية لهذا المعيار للمقارنة.':'No original result for this criterion is available to compare.'}</p>}{f.status!=='insufficient_evidence'&&<button className="secondary" disabled={disabled} onClick={()=>onRetry(f.id)}>{ar?'أعد التدريب على هذا الجانب':'Retry with this focus'}</button>}</details>;})}</section>)}
 <p className="scope-note">{ar?'نراعي اللهجات. قد تكون ملاحظات النص المفرّغ ناتجة عن التفريغ، وليست أخطاء مؤكدة من المتحدث.':'Dialect variations are respected. Issues in transcribed text may come from transcription and are not confirmed speaker errors.'}</p>
 </>}
 <h4>{ar?'النطق والتنغيم':'Pronunciation and intonation'}</h4><p>{ar?'هذا القسم يراجع النص فقط. راجع ملاحظات الأداء الصوتي في قسم التسجيل عند توفرها؛ لا نستنتج النطق من النص.':'This section reviews text only. See audio-based coaching in the recording section when available; pronunciation is not inferred from text.'}</p>
 </section>;
}
