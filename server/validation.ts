import { CRITERIA, type Comparison, type Feedback, type Finding } from '../src/domain.js';
import type { Lang, Turn } from '../src/content.js';

export class ApiError extends Error {
  constructor(public code: string, public status = 400, public retryAfterSeconds?:number) { super(code); }
}
export function language(value: unknown): Lang {
  if (value !== 'ar' && value !== 'en') throw new ApiError('invalid_language');
  return value;
}
export function text(value: unknown, max = 2400): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new ApiError('invalid_text');
  return value;
}
export function transcript(value: unknown, maxTurns=30): Turn[] {
  if (!Array.isArray(value) || value.length > maxTurns) throw new ApiError('invalid_transcript');
  const ids = new Set<string>();
  return value.map(v => {
    if (!v || (v.role !== 'user' && v.role !== 'assistant') || typeof v.at !== 'number' || !Number.isFinite(v.at)) throw new ApiError('invalid_transcript');
    const id = text(v.id, 100);
    if (ids.has(id)) throw new ApiError('duplicate_turn');
    ids.add(id);
    if (v.delivery && !['text','pending','complete','uncertain'].includes(v.delivery)) throw new ApiError('invalid_delivery');
    return {id, role:v.role, text:text(v.text), at:v.at, interrupted:!!v.interrupted, delivery:v.delivery};
  });
}
export function contextTurns(turns: Turn[]) {
  return turns.map(t => ({ role:t.role, content: t.role === 'assistant' && (t.interrupted || t.delivery === 'pending' || t.delivery === 'uncertain')
    ? '[This assistant response was interrupted or not confirmed as delivered. Its contents are unavailable. Do not assume the user heard any of it.]' : t.text }));
}
export function checkFeedback(value: unknown, turns: Turn[]): Feedback {
  const v = value as Feedback;
  if (!v || !Array.isArray(v.findings) || v.findings.length > 3) throw new ApiError('invalid_model_evidence',502);
  text(v.summary, 1500);
  const ids = new Set<string>();
  const findings = v.findings.map((f:Finding) => {
    if (!f || !CRITERIA.includes(f.criterion) || f.sourceId !== 'quran-16-125' || !f.evidence) throw new ApiError('invalid_model_evidence',502);
    const id=text(f.id,100);
    if(ids.has(id))throw new ApiError('invalid_model_evidence',502);
    ids.add(id);
    const answerIndex=turns.findIndex(t=>t.id===f.evidence.turnId && t.role==='user');
    const questionIndex=turns.findIndex(t=>t.id===f.questionTurnId && t.role==='assistant');
    const quote=text(f.evidence.quote);
    if(answerIndex<0 || questionIndex<0 || questionIndex>=answerIndex || turns[questionIndex].interrupted || ['pending','uncertain'].includes(turns[questionIndex].delivery||'') || !turns[answerIndex].text.includes(quote)) throw new ApiError('invalid_model_evidence',502);
    return {id,criterion:f.criterion,observation:text(f.observation,1500),suggestion:text(f.suggestion,1000),evidence:{turnId:turns[answerIndex].id,quote},questionTurnId:turns[questionIndex].id,sourceId:'quran-16-125' as const};
  });
  return {findings,summary:v.summary};
}
export function checkComparison(value: unknown, original: Turn, retry: Turn, criterion: string): Comparison {
  const v=value as Comparison;
  if (!v || v.criterion!==criterion || !CRITERIA.includes(v.criterion) || !['clearer','similar','less_clear','insufficient_evidence'].includes(v.conclusion) || !original.text.includes(text(v.originalQuote)) || !retry.text.includes(text(v.retryQuote))) throw new ApiError('invalid_model_evidence',502);
  return {criterion:v.criterion,originalQuote:v.originalQuote,retryQuote:v.retryQuote,originalObservation:text(v.originalObservation,1500),retryObservation:text(v.retryObservation,1500),conclusion:v.conclusion,explanation:text(v.explanation,1500)};
}

/** Limited wording reflection: never turns uncertain playback into confirmed evidence. */
export function checkWordingReview(value:unknown,answers:Turn[]):Feedback {
 const v=value as {summary:string;turnId:string;quote:string;suggestion:string};
 if(!v)throw new ApiError('invalid_model_evidence',502);
 const quote=text(v.quote),turnId=text(v.turnId,100);
 const answer=answers.find(t=>t.role==='user'&&t.id===turnId);
 if(!answer||!answer.text.includes(quote))throw new ApiError('invalid_model_evidence',502);
 return {findings:[],status:'wording_only',summary:text(v.summary,1500),wording:{turnId,quote,suggestion:text(v.suggestion,1000)}};
}
