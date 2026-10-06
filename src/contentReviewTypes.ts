import {assessmentParts,assessmentLabels} from './contentAssessment';
import {argumentLabels,retrievalStatusText,type ArgumentReport} from './argumentReviewTypes';
import type {Lang} from './content';
import {TANZIL_NOTICE} from './tanzilNotice';
export type Category='textual_match'|'textual_mismatch'|'unsupported_attribution'|'insufficient_evidence'|'specialist_review'|'out_of_scope';
export type ReviewUnit={id:string;text:string;originalText:string;kind:'text'|'audio'|'frame';start?:number;end?:number;confirmed:boolean;frameId?:string};
export type Reference={id:string;title:string;url:string;excerpt:string;provider:string;scope?:'published_text';retrievedAt?:string};
export type ContentFinding={id:string;unitId:string;start:number;end:number;passage:string;quote:string;category:Category;explanation:string;reference:Reference|null;relatedReference?:Reference;correction:string|null;uncertain:boolean;decision:'pending'|'accepted'|'rejected'|'edited';reviewerNote:string;editedCorrection:string;practiceEligible:boolean};
export type VideoFrame={id:string;at:number;image:string;text:string};
export type ContentReport={version:1;extractionErrors?:Partial<Record<'audio'|'frames',string>>;extractionStages?:{audio?:'complete'|'absent';frames?:'complete'};visualReview?:import('./visualEditorial').VisualEditorial;visualError?:boolean;visualContext?:{audience:string;purpose:string};quotationCheckIncomplete?:boolean;assessment?:import('./contentAssessment').ContentAssessment;retrieval?:import('./contentRetrieval').ContentRetrieval;structure?:import('./contentStructure').ContentStructure;arguments?:ArgumentReport;example?:boolean;id:string;title:string;language:Lang;kind:'text'|'audio'|'video'|'image';createdAt:number;originalText:string;units:ReviewUnit[];findings:ContentFinding[];frames:VideoFrame[];coverage:string;analysisStatus:'draft'|'complete'|'incomplete';media?:{name:string;type:string;size:number;duration:number};videoStatus?:string;extractionNote?:string};
export type ExtractedClaim={unitId:string;passage:string;quote:string;citation:string;kind:'quran_quote'|'hadith_attribution'|'religious_claim'|'interpretation'|'translation'};
export const categoryLabels:Record<Category,{ar:string;en:string}>={
 out_of_scope:{ar:'تعليق خارج نطاق فحص الاقتباسات',en:'Commentary outside quotation-checking scope'},
 textual_match:{ar:'تطابق نصي ضمن نطاق الفحص',en:'Text matches within checked scope'},
 textual_mismatch:{ar:'اختلاف نصي',en:'Textual difference'},
 unsupported_attribution:{ar:'نسبة لا يدعمها المرجع المذكور',en:'Attribution conflicts with cited source'},
 insufficient_evidence:{ar:'أدلة غير كافية',en:'Insufficient evidence'},
 specialist_review:{ar:'تحتاج إلى مراجعة مختص',en:'Specialist review needed'},
};
export function reportText(report:ContentReport):string{
 const ar=report.language==='ar';
 return [report.example?(ar?'مثال توضيحي — بيانات معدّة مسبقًا، ليست تحليلًا لملف مرفوع.':'ILLUSTRATIVE EXAMPLE — prepared sample data, not analysis of uploaded media.'):'',report.title,`${ar?'تقرير بصيرة — ليس موافقة دينية أو إذن نشر':'Basira review — not religious approval or publication clearance'}`,
 `${ar?'حالة التحليل':'Analysis status'}: ${({draft:ar?'مسودة — لم تكتمل المراجعة':'Draft — review not completed',complete:ar?'اكتملت المراجعة':'Review completed',incomplete:ar?'مراجعة جزئية':'Partial review'})[report.analysisStatus]}`,report.coverage,report.videoStatus||'',report.extractionNote||'',
 ar?'المحتوى الأصلي':'Original content',report.originalText,
 ...report.units.filter(u=>u.kind!=='text').map(u=>`${u.kind} ${u.start?.toFixed(1)}s\n${ar?'النص المستخرج الأصلي':'Original extraction'}: ${u.originalText}\n${ar?'النص المستخدم في التحليل':'Analyzed text'}: ${u.text}\n${ar?'تأكيد المراجع':'Reviewer confirmed'}: ${u.confirmed}`),
 ...report.findings.map((f,i)=>f.category==='out_of_scope'?[categoryLabels[f.category][report.language],`${ar?'المقطع':'Passage'}: ${f.passage}`,f.explanation].join('\n'):[`${i+1}. ${categoryLabels[f.category][report.language]}`,`${ar?'المقطع':'Passage'}: ${f.passage}`,f.explanation,f.uncertain?(ar?'قد يكون خطأ تفريغ أو استخراج؛ ليس اختلافًا مؤكدًا في التسجيل.':'Possible transcription/OCR error; not a confirmed difference in the recording.'):'',f.reference?`${f.reference.title}\n${f.reference.excerpt}\n${f.reference.url}`:(ar?'لا يوجد مرجع مسترجع يدعم الحكم.':'No retrieved reference supports a verdict.'),f.relatedReference?`${f.relatedReference.title}\n${f.relatedReference.excerpt}\n${f.relatedReference.url}`:'',`${ar?'اقتراح':'Suggestion'}: ${f.correction||'—'}`,`${ar?'قرار المراجع':'Human decision'}: ${f.decision}`,`${ar?'تعديل المراجع':'Human edit'}: ${f.editedCorrection}`,`${ar?'ملاحظة المراجع':'Reviewer note'}: ${f.reviewerNote}`].join('\n')),
 ...(report.structure?[report.assessment?(ar?'استخراج خضع لمراجعة محدودة بالأدلة المعروضة.':'Extraction assessed within the displayed evidence scope.'):report.retrieval?(ar?'استخراج مع مقاطع مرشحة — لم تُراجع الصحة بعد.':'Extraction with candidate passages — no correctness judgment yet.'):(ar?'استخراج فقط — لم تُسترجع مصادر ولم تُراجع الصحة.':'Extraction only — no source retrieval or verification.'),...report.structure.items.map(i=>JSON.stringify({evidence:i.evidence,reasoning:i.reasoning,conclusion:i.conclusion,class:i.class,unitId:i.unitId,passage:i.passage}))]:[]),
 ...(report.retrieval?[ar?'مقاطع الاسترجاع — تُعرض الهوية الموثقة عند توفرها؛ لا تعني اعتماد الحكم.':'Retrieved candidates — source identity is shown where available; this is not approval of a judgment.',...report.retrieval.items.flatMap(i=>i.candidates.map(c=>`${c.source} · ${c.locator}\n${c.text}\n${c.reference?`${c.reference.title} · ${c.reference.provider}\n${c.reference.url}\n${c.licenseUrl}`:"Source identity unverified"}`))]:[]),
 ...(report.assessment?.summary?[report.assessment.summary.overview,report.assessment.summary.nextStep]:[]),
 ...(report.assessment?[`${ar?'المقاطع المراجعة':'Assessed passages'}: ${report.assessment.items.length}/${report.assessment.total}`, ...report.assessment.items.map(i=>[i.item.passage,...assessmentParts.map(k=>[assessmentLabels[report.language][k],i.item[k],assessmentLabels[report.language][i.parts[k].status],i.parts[k].explanation,i.parts[k].suggestion,...i.parts[k].citations.map(c=>`${c.source} · ${c.locator}\n${c.quote}\n${c.reference?`${c.reference.title} · ${c.reference.provider}\n${c.reference.url}\n${c.licenseUrl}`:"Source identity unverified"}`)].join('\n')),`${ar?'قرار المراجع':'Reviewer decision'}: ${i.decision}`,i.reviewerNote,i.editedCorrection].join('\n\n'))]:[]),
 ...(report.arguments?[report.arguments.summary,...(report.arguments.retrievalStatuses||[]).map(s=>retrievalStatusText(s,report.language)),...report.arguments.items.map(item=>[item.passage,...(['evidence','reasoning','conclusion'] as const).map(key=>`${argumentLabels[report.language][key]}: ${item[key].passage}\n${argumentLabels[report.language][item[key].status]} — ${item[key].explanation}`),...item.references.map(r=>`${r.title}\n${r.excerpt}\n${r.url}`),`${item.decision}: ${item.reviewerNote}`].join('\n\n'))]:[]),
 ...(report.visualReview?[ar?'المراجعة البصرية التحريرية — دون استرجاع مصادر؛ ليست تحققًا دينيًا أو واقعيًا.':'Visual editorial review — no source retrieval; not religious or factual verification.',report.visualReview.summary,JSON.stringify(report.visualContext||{}),...(report.visualReview.descriptions.map(d=>`${d.frameId} · ${report.visualReview!.frames.find(f=>f.id===d.frameId)?.at}s: ${d.description}`)),...report.visualReview.findings.map(f=>`${f.aspect} · ${f.status} · ${f.frameIds.join(', ')}
${f.observation}
${f.reasoning}
${f.suggestion}
${f.decision}
${f.editedSuggestion}
${f.reviewerNote}`),report.visualReview.kind==='video'?(ar?'الفيديو: عينات فقط؛ لا يشمل كل إطار أو الصوت.':'Video: sampled frames only; not every frame or audio.'):'']:[]),
 ...(report.findings.some(f=>f.reference?.provider==='Tanzil'||f.relatedReference?.provider==='Tanzil')||report.retrieval?.items.some(i=>i.candidates.some(c=>c.reference?.provider==='Tanzil'))?[TANZIL_NOTICE,'https://tanzil.net']:[])
 ].filter(Boolean).join('\n\n');
}
