// Real model HTTP checks using synthetic learner answers; no voice/avatar sessions.
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.BASIRA_TEST_URL||'http://127.0.0.1:3001';
const report={at:new Date().toISOString(),kind:'Live model HTTP requests with synthetic learner answers',avatarTested:false,voiceTested:false,checks:[]};
async function post(path,body){const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});const data=await r.json();if(!r.ok)throw Error(`${r.status}:${data.error}`);return data;}
try{
 const {questions}=await (await fetch(base+'/api/training/questions')).json();
 for(const [background,language] of [['hinduism','ar'],['christianity','en'],['atheism','ar'],['judaism','en']]){
  const question=questions.find(q=>q.tradition===background&&q.status==='draft_requires_human_review');
  const turns=[{id:'q1',role:'assistant',text:question.question[language],pointIds:question.points.map(p=>p.id),delivery:'text'},{id:'a1',role:'user',text:language==='ar'?'أفهم أن هذا رأي المؤلف، لكنني لم أوضح حجته بعد.':'I understand this is the author’s view, but I have not explained the argument yet.',pointIds:[],delivery:'text'}];
  const body={questionId:question.id,referenceVersion:question.referenceVersion,language,turns};
  const followup=await post('/api/training/followup',body);
  if(followup.questionId!==question.id||followup.pointIds.some(id=>!question.points.some(p=>p.id===id)))throw Error('unbound followup');
  const check={background,language,questionId:question.id,referenceVersion:question.referenceVersion,followup,syntheticTurns:turns};report.checks.push(check);
  console.log(JSON.stringify({stage:'followup',background,language,ok:true}));
  if(background==='hinduism'||background==='christianity'){
   if(!followup.readyForReview){
    turns.push({id:'q2',role:'assistant',text:followup.text,pointIds:followup.pointIds,delivery:'text'},{id:'a2',role:'user',text:question.points[0].text[language],pointIds:followup.pointIds,delivery:'text'});
   }
   check.assessment=await post('/api/training/assess',{...body,turns});
   for(const point of check.assessment.points)if(point.answerQuote&&!turns.some(t=>t.id===point.turnId&&t.role==='user'&&t.text.includes(point.answerQuote)))throw Error('unbound quote');
   // Synthetic retry intentionally supplies the stored answer, not claimed human improvement.
   const retry=[turns[0],{id:'retry1',role:'user',text:question.answer[language],pointIds:[],delivery:'text'}];
   check.retry=await post('/api/training/assess',{...body,turns:retry});
   check.syntheticRetry=retry;
   if(check.retry.points.map(p=>p.id).sort().join()!==check.assessment.points.map(p=>p.id).sort().join())throw Error('criteria changed');
   console.log(JSON.stringify({stage:'review_and_retry',background,language,ok:true,original:check.assessment.verdict,retry:check.retry.verdict}));
  }
 }
}catch(e){report.error=e.message;process.exitCode=1;console.error(JSON.stringify({stage:'failed',error:e.message}));}
finally{await mkdir('artifacts/reports',{recursive:true});await writeFile('artifacts/reports/reference-dialogue-live.json',JSON.stringify(report,null,2)+'\n');}
