import {it,expect} from 'vitest';
import {compareReferenceAttempts} from '../src/referenceComparison';
import type {BookQuestion,ReferenceAttempt} from '../src/referencePracticeTypes';
import bank from '../data/training/questions.json';
const q=bank.questions[0] as BookQuestion;
const attempt=(status:'covered'|'missing'|'contradicted'):ReferenceAttempt=>({id:status,at:1,answer:'Answer',assessment:{verdict:'partial',spokenFeedback:'Feedback',points:q.points.map(p=>({id:p.id,status,answerQuote:status==='missing'?'':'Answer',explanation:'Explanation'}))}});
it('compares identical criteria without converting missing evidence into improvement',()=>{
 expect(compareReferenceAttempts(q,attempt('contradicted'),attempt('missing'))[0].change).toBe('conflict_not_repeated');
 expect(compareReferenceAttempts(q,attempt('covered'),attempt('missing'))[0].change).toBe('no_longer_covered');
 expect(compareReferenceAttempts(q,attempt('missing'),attempt('covered'))[0].change).toBe('newly_covered');
 expect(compareReferenceAttempts(q,attempt('covered'),attempt('contradicted'))[0].change).toBe('conflict_identified');
 expect(compareReferenceAttempts(q,attempt('missing'),attempt('missing'))[0].change).toBe('unchanged');
});
it('does not invent a comparison when a criterion is absent from a saved assessment',()=>{
 const retry=attempt('covered');retry.assessment.points=[];
 expect(compareReferenceAttempts(q,attempt('missing'),retry).every(r=>r.change==='unavailable')).toBe(true);
});
