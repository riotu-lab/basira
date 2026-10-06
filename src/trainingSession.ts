import type {Lang} from './content';
import type {ReferenceRecord,Tradition} from './referencePracticeTypes';
export type TrainingSession={contentOrigin?:{passage:string;explanation:string;citations:import('./contentAssessment').JudgmentCitation[]};id:string;language:Lang;tradition:Tradition;revision:number;createdAt:number;records:ReferenceRecord[];currentId:string;ended:boolean;events?:{id:string;text:string}[];lastEvent?:{id:string;text:string};live?:{handle:string;expires:number;callId:string};error?:string};
export const currentTrainingRecord=(s:TrainingSession)=>s.records.find(r=>r.id===s.currentId)!;

// A successfully processed silent turn is waiting for continuation, not a failed request.
export function awaitingContinuation(s:TrainingSession){
 const last=currentTrainingRecord(s).turns?.at(-1);
 return !s.error&&!s.ended&&last?.role==='user'&&!!s.events?.some(e=>e.id===last.id&&e.text==='');
}
