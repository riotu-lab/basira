// Real model + audit check with synthetic learner turns; no avatar/audio usage.
import 'dotenv/config';
import {mkdir,writeFile} from 'node:fs/promises';
import {ModelProvider} from '../../server/model';
import {AiAudit,SqliteAuditStore,aiRequestContext} from '../../server/aiAudit';
import {questionBank} from '../../server/referencePractice';
import type {ReferenceTurn} from '../../src/referencePracticeTypes';
const store=new SqliteAuditStore('.local/ai-audit-verification/grounding.sqlite');
const env={...process.env,AI_AUDIT_ENABLED:'true'};
const model=new ModelProvider(env,fetch,new AiAudit(env,store));
const report:{checks:unknown[];error?:string}={checks:[]};
try{
 for(const language of ['ar','en'] as const){
  const q=questionBank().find(q=>q.evidence?.length)!;
  const turns:ReferenceTurn[]=[{id:'question',role:'assistant',text:q.question[language],pointIds:q.points.map(p=>p.id)},{id:'answer',role:'user',text:language==='ar'?'أفهم النقطة الأولى جزئيًا، لكنني لم أوضح معناها بعد.':'I partly understand the first point but have not explained what it means yet.',pointIds:q.points.map(p=>p.id)}];
  const result=await aiRequestContext.run({sessionId:`grounding-check-${language}-${Date.now()}`},()=>model.referenceFollowup(language,q,turns,AbortSignal.timeout(60000)));
  const [record]=await store.list(1);
  if(record.status!=='completed'||!['model_checked','unsupported','not_needed'].includes(result.grounding))throw Error('grounding_check_failed');
  if(result.grounding!=='not_needed'&&record.calls.length!==2)throw Error('checker_not_audited');
  if(result.grounding==='unsupported'&&(result.text||result.pointIds.length||!result.readyForReview))throw Error('rejected_candidate_exposed');
  report.checks.push({language,grounding:result.grounding,calls:record.calls.length,ok:true});
 }
 for(const language of ['ar','en'] as const){
  const q=questionBank().find(q=>q.evidence?.length)!;
  for(const supported of [true,false]){
   const candidate={text:supported?(language==='ar'?'كيف يخاطب الإنسان خالقه في مثال المؤلف عن وقت الاضطرار؟':"How does a person address their Creator in the author's example of a time of need?"):(language==='ar'?'ما النسبة المئوية للأطفال الذين يؤمنون بهذا وفق أحدث الدراسات؟':'What percentage of children believe this according to the latest studies?'),pointIds:[supported?'point-3':'point-2'],readyForReview:false};
   let calls=0;
   const transport:typeof fetch=async(input,init)=>++calls===1?new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(candidate)}]}]}),{headers:{'x-request-id':'fixture-candidate-real-checker'}}):fetch(input,init);
   const controlled=new ModelProvider(env,transport,new AiAudit(env,store));
   const turns:ReferenceTurn[]=[{id:'q',role:'assistant',text:q.question[language],pointIds:q.points.map(p=>p.id)},{id:'a',role:'user',text:language==='ar'?'لا أزال أحتاج إلى توضيح الحجة.':'I still need to clarify the argument.',pointIds:q.points.map(p=>p.id)}];
   const result=await controlled.referenceFollowup(language,q,turns,AbortSignal.timeout(60000));
   if(result.grounding!==(supported?'model_checked':'unsupported'))throw Error('controlled_grounding_expectation_failed');
   report.checks.push({kind:'fixture_candidate_real_checker',language,expectedSupported:supported,grounding:result.grounding,ok:true});
  }
 }

}catch(e){report.error=e instanceof Error&&/^[a-z_]+$/.test(e.message)?e.message:'check_failed';process.exitCode=1;}
finally{store.close();await mkdir('artifacts/reports',{recursive:true});await writeFile('artifacts/reports/followup-grounding-live.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
