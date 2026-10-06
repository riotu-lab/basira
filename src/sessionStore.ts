import type {Lang,Turn} from './content';
import {SOURCES,type Attempt,type Practice,type Comparison} from './domain';

const KEY='basira.sessions.v1';
export type SavedSession={
  id:string;updatedAt:number;language:Lang;mode:'ai'|'demo';finished:boolean;
  turns:Turn[];attempt:Attempt|null;practice:Practice|null;comparison:Comparison|null;
  selected:string|null;sources:typeof SOURCES;
};
// Explicit allowlist: only learning records are serialized. No credentials, audio,
// LiveAvatar handles/tokens, or service configuration belong in browser storage.
function cleanTurns(turns:Turn[]):Turn[]{
  if(!Array.isArray(turns)||turns.length>100)throw Error('invalid_record');
  return turns.map(t=>{
    if(!t||typeof t.id!=='string'||!['user','assistant'].includes(t.role)||typeof t.text!=='string'||t.text.length>10000||!Number.isFinite(t.at))throw Error('invalid_record');
    return {id:t.id,role:t.role,text:t.text,at:t.at,delivery:t.delivery==='pending'?'uncertain':t.delivery,interrupted:t.interrupted||t.delivery==='pending'};
  });
}
function cleanAttempt(a:Attempt|null):Attempt|null{
  if(!a)return null;
  if(!['ar','en'].includes(a.language)||!['ai','demo'].includes(a.mode)||typeof a.id!=='string')throw Error('invalid_record');
  const turns=cleanTurns(a.turns);
  const feedback=a.feedback;
  if(feedback&&(!Array.isArray(feedback.findings)||typeof feedback.summary!=='string'||feedback.findings.some(f=>!f||!['understanding','respect'].includes(f.criterion)||f.sourceId!=='quran-16-125'||!turns.some(t=>t.id===f.evidence?.turnId&&t.role==='user'&&t.text.includes(f.evidence.quote))||!turns.some(t=>t.id===f.questionTurnId&&t.role==='assistant'))))throw Error('invalid_record');
  const wording=feedback?.status==='wording_only'?feedback.wording:undefined;
  if(feedback?.status==='wording_only'&&(!wording||typeof wording.quote!=='string'||!wording.quote||typeof wording.suggestion!=='string'||!turns.some(t=>t.role==='user'&&t.id===wording.turnId&&t.text.includes(wording.quote))))throw Error('invalid_record');
  return {id:a.id,language:a.language,mode:a.mode,turns,...(feedback?{feedback:{summary:feedback.summary,...(feedback.status==='insufficient_delivery'?{status:'insufficient_delivery' as const}:wording?{status:'wording_only' as const,wording:{turnId:wording.turnId,quote:wording.quote,suggestion:wording.suggestion}}:{}),findings:feedback.findings.map(f=>({id:f.id,criterion:f.criterion,observation:f.observation,suggestion:f.suggestion,evidence:{turnId:f.evidence.turnId,quote:f.evidence.quote},questionTurnId:f.questionTurnId,sourceId:f.sourceId}))}}:{})};
}
function clean(s:SavedSession):SavedSession{
  if(!s||typeof s.id!=='string'||!Number.isFinite(s.updatedAt)||!['ar','en'].includes(s.language)||!['ai','demo'].includes(s.mode)||typeof s.finished!=='boolean')throw Error('invalid_record');
  const attempt=cleanAttempt(s.attempt),original=cleanAttempt(s.practice?.original||null);
  let practice:Practice|null=null;
  if(s.practice){
    const question=original?.turns.find(t=>t.id===s.practice!.question.id&&t.role==='assistant');
    const finding=original?.feedback?.findings.find(f=>f.id===s.practice!.finding.id)|| (s.mode==='demo'?s.practice.finding:undefined);
    if(!original||!question||!finding)throw Error('invalid_record');
    practice={original,question,finding};
  }
  let comparison:Comparison|null=null;
  if(s.comparison){
    const c=s.comparison;
    if(!practice||c.criterion!==practice.finding.criterion||!['clearer','similar','less_clear','insufficient_evidence'].includes(c.conclusion)||!['originalQuote','retryQuote','originalObservation','retryObservation','explanation'].every(k=>typeof c[k as keyof Comparison]==='string'))throw Error('invalid_record');
    comparison={criterion:c.criterion,originalQuote:c.originalQuote,retryQuote:c.retryQuote,originalObservation:c.originalObservation,retryObservation:c.retryObservation,conclusion:c.conclusion,explanation:c.explanation};
  }
  // This catalog version has one immutable source; reject injected links/text.
  if(JSON.stringify(s.sources)!==JSON.stringify(SOURCES))throw Error('unsupported_catalog_version');
  return {id:s.id,updatedAt:s.updatedAt,language:s.language,mode:s.mode,finished:s.finished,turns:cleanTurns(s.turns),attempt,practice,comparison,selected:typeof s.selected==='string'?s.selected:null,sources:structuredClone(s.sources)};
}
export function loadSessions():SavedSession[]{
  const raw=localStorage.getItem(KEY);if(!raw)return [];
  const data=JSON.parse(raw);
  if(data.version!==1||!Array.isArray(data.sessions))throw Error('invalid_archive');
  return data.sessions.map(clean).sort((a:SavedSession,b:SavedSession)=>b.updatedAt-a.updatedAt);
}
export function saveSession(session:SavedSession){
  const entry=clean(session),sessions=loadSessions().filter(s=>s.id!==entry.id);
  sessions.unshift(entry);localStorage.setItem(KEY,JSON.stringify({version:1,sessions}));return sessions;
}
export function deleteSession(id:string){
  const existing=loadSessions(),target=existing.find(s=>s.id===id);
  const originalId=target&&!target.practice?target.attempt?.id:undefined;
  const sessions=existing.filter(s=>s.id!==id&&(!originalId||s.practice?.original.id!==originalId));
  if(sessions.length)localStorage.setItem(KEY,JSON.stringify({version:1,sessions}));else localStorage.removeItem(KEY);
  return sessions;
}
export function deleteAllSessions(){localStorage.removeItem(KEY);}
