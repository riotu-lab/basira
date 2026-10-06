import 'dotenv/config';
import assert from 'node:assert/strict';
import {ModelProvider} from '../../server/model.js';
import {questionBank} from '../../server/referencePractice.js';
import type {Lang} from '../../src/content.js';
import type {ReferenceTurn} from '../../src/referencePracticeTypes.js';
const model=new ModelProvider(process.env),question=questionBank().find(q=>q.tradition==='christianity')!;
for(const language of ['ar','en'] as Lang[]){
 const initial:ReferenceTurn={id:'q',role:'assistant',text:question.question[language],pointIds:question.points.map(p=>p.id)};
 const inputs=language==='ar'?['أهلًا صديقي.','لحظة أكمل فكرتي.','والله لا أعرف، سوف أبحث في الموضوع.']:['Hello my friend.','Let me finish my thought.','I don’t know honestly. I would like to research that.'];
 let deferred:ReferenceTurn[]=[];
 for(const [i,text] of inputs.entries()){
  const turns:ReferenceTurn[]=[initial,{id:'a',role:'user',text,pointIds:initial.pointIds}];
  const response=await model.referenceFollowup(language,question,turns,AbortSignal.timeout(60000));
  assert.equal(response.readyForReview,false);assert.equal(response.grounding,'social_only');assert.equal(response.pointIds.length,0);
  deferred=[...turns,{id:'b',role:'assistant',text:response.text,pointIds:[]}];
  console.log(JSON.stringify({language,case:['greeting','pause','defer'][i],check:'deterministic_control',passed:true}));
 }
 deferred.push({id:'c',role:'user',text:language==='ar'?'نعم، سؤال آخر من فضلك.':'Yes, another question please.',pointIds:[]});
 const next=await model.referenceFollowup(language,question,deferred,AbortSignal.timeout(60000));assert.equal(next.readyForReview,true);
 console.log(JSON.stringify({language,case:'accept_next_question',check:'deterministic_control',passed:true}));
 const content=await model.referenceFollowup(language,question,[initial,{id:'answer',role:'user',text:question.answer[language],pointIds:initial.pointIds}],AbortSignal.timeout(60000));
 assert.ok(content.readyForReview||content.pointIds.length>0);
 console.log(JSON.stringify({language,case:'substantive_answer',check:'live_model',grounding:content.grounding,passed:true}));
}
