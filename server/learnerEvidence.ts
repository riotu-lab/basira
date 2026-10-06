import type {ReferenceTurn} from '../src/referencePracticeTypes.js';
import {ApiError} from './validation.js';
export type LearnerPassage={id:string;turnId?:string;text:string;start:number;end:number};
// Sentence/clause boundaries preserve the original bytes. Full turns remain in the model context.
export function learnerPassages(answer:string,turns?:ReferenceTurn[]):LearnerPassage[]{
 const entries=turns?turns.filter(t=>t.role==='user').map(t=>({text:t.text,turnId:t.id})):[{text:answer,turnId:undefined}];
 return entries.flatMap((entry,i)=>Array.from(entry.text.matchAll(/[^.!?؟。;؛\n]+[.!?؟。;؛\n]*/gu)).flatMap((match,j)=>{
  const raw=match[0],text=raw.trim();if(!text)return [];
  const start=match.index+raw.indexOf(text);
  return [{id:`learner-${i+1}-${j+1}`,turnId:entry.turnId,text,start,end:start+text.length}];
 }));
}
export function resolveLearnerEvidence(ids:unknown,status:string,passages:LearnerPassage[]){
 if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length||ids.length>6||(status==='missing'?ids.length!==0:ids.length===0))throw new ApiError('invalid_model_evidence',502);
 const selected=ids.map(id=>{const passage=passages.find(p=>p.id===id);if(!passage)throw new ApiError('invalid_model_evidence',502);return passage;});
 return selected.map(p=>({passageId:p.id,turnId:p.turnId,quote:p.text,start:p.start,end:p.end}));
}
