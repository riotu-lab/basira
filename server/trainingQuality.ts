import {QUALITY_CRITERIA,type TrainingQuality,type QualityCriterion} from '../src/trainingQuality.js';
import {resolveLearnerEvidence,type LearnerPassage} from './learnerEvidence.js';
import type {ReferenceTurn} from '../src/referencePracticeTypes.js';
import {ApiError} from './validation.js';
export const qualityRules=`Also assess these SEPARATE text-based coaching dimensions: relevance to the asked question; clarity; organization; concision without sacrificing substance; respectful engagement; responsiveness to actual questions; grammar; vocabulary/word choice. Return every supplied rubric ID once. Classify effective, needs_attention, insufficient_evidence, or possible_transcription_issue. Use insufficient_evidence for answers too short or context too limited to assess a dimension; do not fabricate praise or faults. Effective/needs_attention/possible_transcription_issue require selected learner passage IDs; insufficient_evidence requires none. Give a brief explanation and, for a concern, one actionable suggestion or explicitly suggested rephrasing, preserving meaning and attribution (never label a rewrite as the learner's words or original scripture). Keep grammar/style separate from reference correctness: eloquence cannot fix a content error, and imperfect grammar does not invalidate a correct idea. Respect Arabic dialects and legitimate English varieties; colloquial wording is not inherently incorrect. Do not demand formal Arabic, diacritics, native-like wording or needless length. Do not treat quoted source/scripture wording as a learner grammar error or rewrite scripture as a correction. For transcribed or unknown-origin text, possible spelling/grammar/word-recognition mistakes are possible_transcription_issue rather than confirmed learner errors. Do not infer pronunciation, pace, pauses, intonation, confidence, emotion, personality, beliefs or audiovisual performance from text. Spoken delivery is NOT assessed here. Findings describe this attempt, not the person's ability. Keep explanations and suggestions in the requested feedback language.`;
export function validateTrainingQuality(value:any,passages:LearnerPassage[],turns?:ReferenceTurn[],language:'ar'|'en'='en'):TrainingQuality{
 const ids=Object.keys(QUALITY_CRITERIA);
 if(!Array.isArray(value)||value.length!==ids.length||new Set(value.map((v:any)=>v.id)).size!==ids.length)throw new ApiError('invalid_model_evidence',502);
 const findings=value.map((v:any)=>{
  if(!ids.includes(v.id)||!['effective','needs_attention','insufficient_evidence','possible_transcription_issue'].includes(v.status)||typeof v.explanation!=='string'||!v.explanation.trim()||v.explanation.length>1000||typeof v.suggestion!=='string'||v.suggestion.length>1000)throw new ApiError('invalid_model_evidence',502);
  if(['needs_attention','possible_transcription_issue'].includes(v.status)&&!v.suggestion.trim())throw new ApiError('invalid_model_evidence',502);
  if(v.status==='possible_transcription_issue'&&!['grammar','vocabulary'].includes(v.id))throw new ApiError('invalid_model_evidence',502);
  const evidence=resolveLearnerEvidence(v.passageIds,v.status==='insufficient_evidence'?'missing':'covered',passages);
  let status=v.status;
  if(['grammar','vocabulary'].includes(v.id)&&status==='needs_attention'&&evidence.some(e=>!['typed','corrected_transcript'].includes(turns?.find(t=>t.id===e.turnId)?.inputKind||'unknown')))status='possible_transcription_issue';
  const explanation=status!==v.status?(language==='ar'?'قد تحتاج هذه الصياغة إلى مراجعة، لكن مصدر النص غير مؤكد. تحقّق من التفريغ قبل نسبة خطأ لغوي إلى المتحدث.':'This wording may need review, but its origin is uncertain. Check the transcript before attributing a language error to the speaker.'):v.explanation;
  return {id:v.id as QualityCriterion,status,explanation,suggestion:v.suggestion,evidence};
 });
 return {version:1,findings,spokenDelivery:'not_assessed'};
}
