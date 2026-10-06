import {WITHHELD_TRAINING_QUESTIONS} from '../src/trainingEligibility.js';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import type {BookQuestion,ReferenceAssessment,ReferenceTurn} from '../src/referencePracticeTypes.js';
import {ApiError} from './validation.js';
let cachedBank:BookQuestion[]|undefined;
function canonicalBank():BookQuestion[]{
 if(cachedBank)return cachedBank;
 const legacy=JSON.parse(readFileSync(new URL('../data/training/questions.json',import.meta.url),'utf8'));
 const questions:BookQuestion[]=legacy.questions.filter((q:BookQuestion)=>['source_checked','reviewed'].includes(q.status));
 for(const background of ['hinduism','christianity','atheism','judaism'] as const){
  const dataset=JSON.parse(readFileSync(new URL(`../data/training/qa/${background}.json`,import.meta.url),'utf8'));
  if(dataset.version!==1||!Array.isArray(dataset.questions))throw new ApiError('source_collection_unavailable',503);
  for(const q of dataset.questions){
   if(q.tradition!==background||!q.modelReview?.faithful||!q.personaReview?.reviewed||!q.evidence?.length||(q.personaReview?.version>=3&&!['direction','selfContained','sourceFaithful','criteriaPreserved','bilingual'].every(key=>q.roleVerification?.[key]===true)))throw new ApiError('source_collection_unavailable',503);
   questions.push({id:q.id,tradition:q.tradition,question:q.question,answer:q.answer,points:q.points,status:q.status,evidence:q.evidence,evidenceMethod:q.evidenceMethod,source:{...q.source,pages:q.evidence.map((e:any)=>e.locator).join(' · '),excerpt:q.evidence.map((e:any)=>e.quote).join('\n\n')}});
  }
 }
 cachedBank=questions.filter(q=>!WITHHELD_TRAINING_QUESTIONS.has(q.id)).map(q=>({...q,referenceVersion:createHash('sha256').update(JSON.stringify(q)).digest('hex')}));
 return cachedBank;
}
export function questionBank():BookQuestion[]{return structuredClone(canonicalBank());}
export function checkReferenceVersion(question:BookQuestion,version:unknown){
 if(version!==undefined&&version!==question.referenceVersion)throw new ApiError('reference_changed',409);
}
// The server resolves reference answers itself, never from a submitted client snapshot.
export function referenceTurns(value:unknown,question:BookQuestion):ReferenceTurn[]{
 if(!Array.isArray(value)||value.length<2||value.length>24||value.length%2!==0)throw new ApiError('invalid_transcript');
 const ids=new Set<string>();
 const turns=value.map((t:any,i)=>{
  if(!t||typeof t.id!=='string'||!t.id||t.id.length>100||ids.has(t.id)||t.role!==(i%2?'user':'assistant')||typeof t.text!=='string'||!t.text.trim()||t.text.length>(i%2?2400:1200)||!Array.isArray(t.pointIds)||t.pointIds.some((id:unknown)=>!question.points.some(p=>p.id===id)))throw new ApiError('invalid_transcript');
  ids.add(t.id);
  return {...(t.role==='user'&&t.inputKind?{inputKind:['typed','transcribed','corrected_transcript'].includes(t.inputKind)?t.inputKind:'unknown'}:{}),id:t.id,role:t.role,text:t.text,pointIds:[...new Set<string>(t.pointIds)],delivery:t.delivery==='complete'?'complete':t.delivery==='uncertain'?'uncertain':'text'} as ReferenceTurn;
 });
 if(!Object.values(question.question).includes(turns[0].text))throw new ApiError('invalid_transcript');
 return turns;
}
export function answerFromTurns(turns:ReferenceTurn[]){return turns.filter(t=>t.role==='user').map(t=>t.text).join('\n\n');}
export function bookQuestion(id:unknown){const q=canonicalBank().find(q=>q.id===id);if(!q)throw new ApiError('question_not_available',404);return structuredClone(q);}
export function validateReferenceAssessment(value:any,question:BookQuestion,answer:string):ReferenceAssessment{
 if(typeof value?.spokenFeedback!=='string'||!value.spokenFeedback.trim()||value.spokenFeedback.length>1800||!Array.isArray(value.points)||value.points.length!==question.points.length||new Set(value.points.map((p:any)=>p.id)).size!==question.points.length)throw new ApiError('invalid_model_evidence',502);
 for(const p of value.points){
  if(!question.points.some(v=>v.id===p.id)||!['covered','missing','contradicted'].includes(p.status)||typeof p.explanation!=='string'||!p.explanation.trim()||p.explanation.length>1200||typeof p.answerQuote!=='string')throw new ApiError('invalid_model_evidence',502);
  if(p.status==='missing'?p.answerQuote!=='':!p.answerQuote.trim()||!answer.includes(p.answerQuote))throw new ApiError('invalid_model_evidence',502);
 }
 const verdict=value.points.some((p:any)=>p.status==='contradicted')?'inconsistent':value.points.every((p:any)=>p.status==='covered')?'consistent':'partial';
 return {verdict,spokenFeedback:value.spokenFeedback,points:value.points};
}
