import type {Lang} from '../src/content.js';
import type {ContentFinding,ReviewUnit} from '../src/contentReviewTypes.js';
import type {ArgumentReport,ArgumentReview,RetrievalStatus} from '../src/argumentReviewTypes.js';
import {ApiError} from './validation.js';
export type ExtractedArgument={unitId:string;passage:string;evidenceKind:ArgumentReview['evidenceKind'];evidence:string;reasoning:string;conclusion:string};
export function prepareArguments(raw:unknown,units:ReviewUnit[],findings:ContentFinding[],lang:Lang):ArgumentReview[]{
 if(!Array.isArray(raw)||raw.length>12)throw new ApiError('invalid_content_evidence',502);
 return raw.map((item:ExtractedArgument,i)=>{
  const unit=units.find(u=>u.id===item?.unitId);
  if(!unit||typeof item.passage!=='string'||!item.passage.trim()||!unit.text.includes(item.passage)||!['revelation','poetry','scholarly','historical','other'].includes(item.evidenceKind))throw new ApiError('invalid_content_evidence',502);
  for(const part of ['evidence','reasoning','conclusion'] as const)if(typeof item[part]!=='string'||(item[part]&&!item.passage.includes(item[part])))throw new ApiError('invalid_content_evidence',502);
  // Only independently resolved local sources can enter the model's evidence packet.
  const linked=findings.filter(f=>f.unitId===unit.id&&['textual_match','textual_mismatch','unsupported_attribution'].includes(f.category)&&!!item.evidence&&f.quote&&item.evidence.includes(f.quote));
  const references=[...new Map(linked.flatMap(f=>f.reference?[f.reference]:[]).map(r=>[r.id,r])).values()];
  const absent=lang==='ar'?'لم يرد هذا الجزء صراحة في المقطع؛ لم نختلقه.':'This part is not explicit in the passage; it was not invented.';
  const missing=lang==='ar'?'لا تتوفر أدلة مسترجعة كافية للحكم. عدم الاسترجاع ليس دليلًا على الخطأ.':'Insufficient retrieved evidence for a verdict. Retrieval failure is not proof of error.';
  const part=(passage:string)=>({passage,status:'insufficient_evidence' as const,explanation:passage?missing:absent,referenceIds:[]});
  return {id:`argument-${i+1}`,unitId:unit.id,passage:item.passage,evidenceKind:item.evidenceKind,evidence:part(item.evidence),reasoning:part(item.reasoning),conclusion:part(item.conclusion),references,uncertain:unit.kind!=='text'&&!unit.confirmed,decision:'pending',reviewerNote:''};
 });
}
export function validateArgumentJudgments(raw:any,items:ArgumentReview[],lang:Lang,statuses:RetrievalStatus[]=[]):ArgumentReport{
 if(!Array.isArray(raw?.items)||raw.items.length!==items.length||new Set(raw.items.map((v:any)=>v.id)).size!==items.length)throw new ApiError('invalid_content_evidence',502);
 const result=items.map(item=>{
  const judgment=raw.items.find((v:any)=>v.id===item.id);if(!judgment)throw new ApiError('invalid_content_evidence',502);
  const next={...item};
  for(const key of ['evidence','reasoning','conclusion'] as const){
   const p=judgment[key];if(!p||!['supported','partially_supported','contradicted','insufficient_evidence','specialist_review'].includes(p.status)||typeof p.explanation!=='string'||!p.explanation.trim()||p.explanation.length>1800||!Array.isArray(p.referenceIds)||p.referenceIds.some((id:unknown)=>!item.references.some(r=>r.id===id)))throw new ApiError('invalid_content_evidence',502);
   if(!item[key].passage||!item.references.length)continue;
   if(['supported','partially_supported','contradicted'].includes(p.status)&&!p.referenceIds.length)throw new ApiError('invalid_content_evidence',502);
   // A Quran wording collection is not a tafsir or jurisprudence corpus.
   if(key!=='evidence'&&p.status!=='insufficient_evidence'&&!item.references.some(r=>r.scope==='published_text'&&p.referenceIds.includes(r.id)))next[key]={...item[key],status:'specialist_review',explanation:lang==='ar'?'المراجع المسترجعة نصوص قرآنية؛ لا تكفي وحدها لتوثيق هذا الاستدلال أو النتيجة.':'Retrieved references are Quran wording; they alone do not validate this reasoning or conclusion.',referenceIds:p.referenceIds};
   else next[key]={...item[key],...p};
  }
  return next;
 });
 const counts=result.reduce((n,item)=>{for(const p of [item.evidence,item.reasoning,item.conclusion])if(p.passage)n[p.status]=(n[p.status]||0)+1;return n;},{} as Record<string,number>);
 const summary=lang==='ar'?`رُوجعت ${result.length} سلسلة استدلال. أجزاء ذات أدلة غير كافية: ${counts.insufficient_evidence||0}؛ أجزاء تحتاج مختصًا: ${counts.specialist_review||0}. هذه خلاصة نطاق الفحص، وليست اعتمادًا للمحتوى.`:`Reviewed ${result.length} argument chains. Parts with insufficient evidence: ${counts.insufficient_evidence||0}; specialist review: ${counts.specialist_review||0}. This summarizes review coverage, not approval of the content.`;
 return {items:result,summary,retrieval:items.some(i=>i.references.some(r=>r.scope==='published_text'))?'local_and_mcp':'local_quran_only',retrievalStatuses:statuses,incomplete:true};
}
