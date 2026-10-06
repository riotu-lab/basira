import {TrainingStore} from '../../server/trainingStore.js';
import 'dotenv/config';
import {writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {trainingGatewayKey,trainingContext} from '../../server/trainingGateway.js';
import {currentTrainingRecord,type TrainingSession} from '../../src/trainingSession.js';
const base=process.env.BASIRA_TEST_URL||'http://127.0.0.1:3005';
async function post(path:string,body:unknown){const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(150000)});const d=await r.json();if(!r.ok)throw Error(d.error||`HTTP ${r.status}`);return d;}
const reports:unknown[]=[],store=new TrainingStore(process.env);

for(const language of ['ar','en'] as const){let token:string|undefined;try{
 const created=await post('/api/training/session',{language,tradition:'hinduism'});token=created.token;const original=currentTrainingRecord(created.session as TrainingSession),answer=original.question.answer[language];
 // Real model with an explicitly synthetic transport lease; no paid avatar session.
 const callId=randomUUID();await store.put(token!,{...created.session,live:{handle:'synthetic-transport-no-provider-session',callId,expires:Date.now()+150000}});
 const r=await fetch(base+'/api/training-llm/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${trainingGatewayKey(process.env)}`,'Content-Type':'application/json'},body:JSON.stringify({stream:true,messages:[{role:'system',content:trainingContext(token!,callId)},{role:'user',content:answer}]}),signal:AbortSignal.timeout(150000)});const stream=await r.text();if(!r.ok||!stream.includes('[DONE]'))throw Error('gateway_response_failed');
 let s=await post('/api/training/session/read',{token}) as TrainingSession;delete s.live;await store.put(token!,s);
 if(!s.records[0].turns?.some(t=>t.role==='user'&&t.text===answer))throw Error('original_answer_not_preserved');
 s=(await post('/api/training/session/action',{token,id:randomUUID(),action:'finish'})).session;
 if(!s.records[0].attempts.length)throw Error('assessment_missing');
 const attempt=s.records[0].attempts[0];
 await post('/api/training/session/action',{token,id:randomUUID(),action:'retry',recordId:original.id,focusPointId:original.question.points[0].id});
 const retryText=language==='ar'?'أفهم أن هذه وجهة نظر المؤلف، وأود أن أوضح حجته بهدوء.':'I understand that this is the author’s perspective, and I would explain the argument calmly.';
 await post('/api/training/session/action',{token,id:randomUUID(),action:'answer',text:retryText,inputKind:'typed'});
 s=(await post('/api/training/session/action',{token,id:randomUUID(),action:'finish'})).session;
 const final=s.records.find(v=>v.id===original.id)!;
 if(final.attempts.length!==2||final.attempts[0].id!==attempt.id||final.question.referenceVersion!==original.question.referenceVersion)throw Error('retry_preservation_failed');
 reports.push({language,realModel:true,scriptedInput:true,liveAvatar:false,syntheticTransport:true,gatewaySSE:true,questionId:original.question.id,originalVerdict:attempt.assessment.verdict,retryVerdict:final.attempts[1].assessment.verdict,originalPreserved:true,referencePreserved:true,attempts:final.attempts.length});
 console.log(JSON.stringify({language,stage:'complete',attempts:2}));
 }catch(e){reports.push({language,error:e instanceof Error?e.message:'failed'});process.exitCode=1;console.log(JSON.stringify({language,stage:'failed',error:e instanceof Error?e.message:'failed'}));}
 finally{if(token){const state=await store.get(token).catch(()=>null);if(state){delete state.live;await store.put(token,state);}}if(token)await post('/api/training/session/delete',{token}).catch(()=>{process.exitCode=1;});}
}
mkdirSync('artifacts/reports',{recursive:true});writeFileSync('artifacts/reports/training-session-live.json',JSON.stringify(reports,null,2));

store.close();
