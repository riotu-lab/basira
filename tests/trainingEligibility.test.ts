// @vitest-environment node
import {it,expect} from 'vitest';
import {isSocialAcknowledgment} from '../src/trainingEligibility';
import {questionBank,bookQuestion} from '../server/referencePractice';
it('quarantines the reported ritual record without reassigning it to another background',()=>{
 expect(questionBank().some(q=>q.id==='5df09cbb8ae4433656d7')).toBe(false);
 expect(()=>bookQuestion('5df09cbb8ae4433656d7')).toThrow();
});
it('distinguishes acknowledgments from substantive religious statements',()=>{
 for(const t of ['صدقت، شكراً لك.','نعم، كذلك.','شكراً','Thank you.','Okay, thanks.']){
  // "نعم، كذلك" can refer back to substantive content and is deliberately not a standalone match.
  expect(isSocialAcknowledgment(t)).toBe(t!=='نعم، كذلك.');
 }
 for(const t of ['نعم، الله واحد.','Thanks, but I think the universe has a cause.','لا أعرف','الكون له سبب'])expect(isSocialAcknowledgment(t)).toBe(false);
});
