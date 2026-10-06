import type {BookQuestion,ReferenceAttempt} from './referencePracticeTypes';
export type PointChange='unchanged'|'newly_covered'|'no_longer_covered'|'conflict_identified'|'conflict_not_repeated'|'unavailable';
/** Compare recorded classifications, never manufacture a score or human improvement. */
export function compareReferenceAttempts(question:BookQuestion,original:ReferenceAttempt,retry:ReferenceAttempt){
 return question.points.map(criterion=>{
  const before=original.assessment.points.find(p=>p.id===criterion.id);
  const after=retry.assessment.points.find(p=>p.id===criterion.id);
  let change:PointChange='unavailable';
  if(before&&after){
   if(before.status===after.status)change='unchanged';
   else if(after.status==='contradicted')change='conflict_identified';
   else if(after.status==='covered')change='newly_covered';
   else if(before.status==='contradicted')change='conflict_not_repeated';
   else change='no_longer_covered';
  }
  return {criterion,before,after,change};
 });
}
