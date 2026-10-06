// Real reference assessment using synthetic learner answers; verifies exact evidence, not human learning.
import 'dotenv/config';
import {mkdir,writeFile} from 'node:fs/promises';
import {ModelProvider} from '../../server/model';
import {AiAudit,SqliteAuditStore} from '../../server/aiAudit';
import {questionBank} from '../../server/referencePractice';
const store=new SqliteAuditStore('.local/ai-audit-verification/assessment-passages.sqlite');
const model=new ModelProvider(process.env,fetch,new AiAudit({...process.env,AI_AUDIT_ENABLED:'true'},store));
const report:{checks:unknown[];error?:string}={checks:[]};
try{
 const q=questionBank().find(q=>q.evidence?.length)!;
 for(const language of ['ar','en'] as const){
  const answer=q.answer[language];
  const turns:any[]=[{id:'question',role:'assistant',text:q.question[language],pointIds:q.points.map(p=>p.id)},{id:'answer',role:'user',inputKind:'typed',text:answer,pointIds:q.points.map(p=>p.id)}];
  const result=await model.assessReference(language,q,answer,AbortSignal.timeout(60000),turns);
  let count=0;
  for(const p of result.points){
   if(p.status==='missing'){if(p.answerQuote||p.evidence?.length)throw Error('missing_has_evidence');continue;}
   if(!p.evidence?.length||p.answerQuote!==p.evidence[0].quote)throw Error('evidence_missing');
   for(const e of p.evidence){if(e.turnId!=='answer'||answer.slice(e.start,e.end)!==e.quote)throw Error('evidence_not_verbatim');count++;}
  }
  if(!count)throw Error('no_selected_passages');
  if(result.quality?.findings.length!==8||result.quality.spokenDelivery!=='not_assessed')throw Error('quality_missing');
  for(const finding of result.quality.findings)for(const e of finding.evidence)if(answer.slice(e.start,e.end)!==e.quote)throw Error('quality_evidence_not_verbatim');
  const [record]=await store.list(1);if(record.status!=='completed')throw Error('audit_not_complete');
  report.checks.push({language,selectedPassages:count,verbatim:true,referenceCompared:true,qualityCriteria:result.quality.findings.length,spokenDelivery:result.quality.spokenDelivery,auditSaved:true});
 }
}catch(e){report.error=e instanceof Error&&/^[a-z_]+$/.test(e.message)?e.message:'check_failed';process.exitCode=1;}
finally{store.close();await mkdir('artifacts/reports',{recursive:true});await writeFile('artifacts/reports/assessment-passages-live.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
