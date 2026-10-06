import {AUDIO_CRITERIA,type AudioCriterion} from './audioAssessment';
import {analyzeRecording,type SpokenDelivery} from './spokenDelivery';
import {QUALITY_CRITERIA,type QualityCriterion} from './trainingQuality';
import {sessionMessages,AVATAR_WARNING_SECONDS} from './sessionMessages';
import {ReferenceReview} from './ReferenceReview';
import {useEffect,useRef,useState} from 'react';
import {BookOpen,Mic,MicOff,Volume2,Square} from 'lucide-react';
import type {Lang} from './content';
import type {Config} from './useJourney';
import {api,RequestError,speech} from './api';
import {errorMessage} from './experienceCopy';
import {Microphone,PcmPlayer} from './audio';
import {createAvatarConnection,type AvatarConnection} from './avatarConnection';
import {traditionLabels,type Tradition,type BookQuestion,type ReferenceAssessment,type ReferenceRecord,type ReferenceTurn} from './referencePracticeTypes';
const KEY='basira.reference-practice.v1';
function records():ReferenceRecord[]{const value=JSON.parse(localStorage.getItem(KEY)||'[]');if(!Array.isArray(value))throw Error('storage');return value.filter(v=>typeof v.id==='string'&&v.question?.id&&['ar','en'].includes(v.language)&&Array.isArray(v.attempts));}
export function ReferencePractice({lang,config,onBack}:{lang:Lang;config:Config|null;onBack:()=>void}){
 const ar=lang==='ar';
 const [language,setLanguage]=useState<Lang>(lang),[tradition,setTradition]=useState<Tradition>('hinduism'),[questions,setQuestions]=useState<BookQuestion[]>([]),[questionsLoaded,setQuestionsLoaded]=useState(false),[questionId,setQuestionId]=useState(''),[answer,setAnswer]=useState('');
 const [record,setRecord]=useState<ReferenceRecord|null>(null),[saved,setSaved]=useState<ReferenceRecord[]>([]),[reveal,setReveal]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[storageError,setStorageError]=useState(false),[mic,setMic]=useState(false),[avatar,setAvatar]=useState(false),[remaining,setRemaining]=useState<number|null>(null),[avatarEnd,setAvatarEnd]=useState<'time'|'idle'|null>(null),[speaking,setSpeaking]=useState(false),[followupBusy,setFollowupBusy]=useState(false),[readyForReview,setReadyForReview]=useState(false);
 const [inputKind,setInputKind]=useState<ReferenceTurn['inputKind']>('typed');
 const [assessingSpeech,setAssessingSpeech]=useState(false),[includeSpeech,setIncludeSpeech]=useState(true);
 const [draftDelivery,setDraftDelivery]=useState<SpokenDelivery|undefined>(),[recordings,setRecordings]=useState<Record<string,string>>({});
 const clipUrls=useRef<Record<string,string>>({}),clipOwners=useRef<Record<string,string>>({});
 function rememberClip(id:string,blob:Blob){const urls=clipUrls.current;urls[id]=URL.createObjectURL(blob);clipOwners.current[id]=record?.id||auditSession.current;while(Object.keys(urls).length>10){const oldest=Object.keys(urls)[0];URL.revokeObjectURL(urls[oldest]);delete urls[oldest];delete clipOwners.current[oldest];}setRecordings({...urls});}
 function removeClips(r:ReferenceRecord){const ids=[...Object.keys(clipOwners.current).filter(id=>clipOwners.current[id]===r.id),r.draftSpokenDelivery?.recordingId,...(r.turns||[]).map(t=>t.spokenDelivery?.recordingId),...r.attempts.flatMap(a=>(a.turns||[]).map(t=>t.spokenDelivery?.recordingId))];for(const id of ids)if(id&&clipUrls.current[id]){URL.revokeObjectURL(clipUrls.current[id]);delete clipUrls.current[id];delete clipOwners.current[id];}setRecordings({...clipUrls.current});}
 const answerInput=useRef<HTMLTextAreaElement>(null),auditSession=useRef<string>(crypto.randomUUID());
 const video=useRef<HTMLVideoElement>(null),connection=useRef<AvatarConnection|null>(null),microphone=useRef(new Microphone()),player=useRef(new PcmPlayer()),controller=useRef<AbortController|null>(null),epoch=useRef(0),outputEpoch=useRef(0),lock=useRef(false);
 const sessionRecords=record?saved.filter(r=>(r.sessionId||r.id)===(record.sessionId||record.id)):[];
 const question=record?.question||questions.find(q=>q.id===questionId&&q.tradition===tradition);
 const dialogue=record?.turns||[];
 const hasAnswers=dialogue.some(t=>t.role==='user');
 const choose=(q:BookQuestion)=>{if(lock.current)return;epoch.current++;controller.current?.abort();void stopOutput();setRecord(null);auditSession.current=crypto.randomUUID();setReadyForReview(false);setQuestionId(q.id);setAnswer('');setDraftDelivery(undefined);setReveal(false);setError(null);};
 const fail=(e:unknown)=>setError(e instanceof RequestError?e.code:'connection_failed');
 useEffect(()=>{const request=new AbortController();void api<{questions:BookQuestion[]}>('/api/training/questions',undefined,request.signal).then(d=>{setQuestions(d.questions);if(d.questions.length)setQuestionId(d.questions[0].id);}).catch(e=>{if(!request.signal.aborted)fail(e);}).finally(()=>{if(!request.signal.aborted)setQuestionsLoaded(true);});try{setSaved(records());}catch{setStorageError(true);}return()=>{Object.values(clipUrls.current).forEach(url=>URL.revokeObjectURL(url));clipUrls.current={};clipOwners.current={};request.abort();epoch.current++;controller.current?.abort();microphone.current.cancel();void player.current.close();void connection.current?.stop();};},[]);
 async function stopOutput(){document.querySelectorAll<HTMLAudioElement>('.training-quality audio').forEach(a=>a.pause());outputEpoch.current++;controller.current?.abort();player.current.stop();setSpeaking(false);try{await connection.current?.interrupt();}catch{await connection.current?.stop();connection.current=null;setAvatar(false);}}
 async function speak(text:string){
  await stopOutput();const current=epoch.current,output=outputEpoch.current;const request=new AbortController();controller.current=request;
  try{if(connection.current?.speakText)await connection.current.speakText(text,()=>setSpeaking(true));else{const pcm=await speech(text,language,request.signal,record?.id||auditSession.current);if(current!==epoch.current||output!==outputEpoch.current||request.signal.aborted)return;if(connection.current)await connection.current.speak(pcm,()=>setSpeaking(true));else await player.current.play(pcm,()=>setSpeaking(true));}}catch(e){if(current===epoch.current&&output===outputEpoch.current&&!request.signal.aborted)fail(e);}finally{if(current===epoch.current&&output===outputEpoch.current)setSpeaking(false);}
 }
 async function enableAvatar(){
  if(lock.current||!question)return;lock.current=true;setBusy(true);setError(null);setAvatarEnd(null);setRemaining(null);const current=epoch.current;const request=new AbortController();controller.current=request;
  try{const c=await createAvatarConnection(config?.avatar.provider,(reason)=>{connection.current=null;setAvatar(false);setRemaining(null);if(reason==='avatar_idle_ended'){setAvatarEnd('idle');setError(null);}else setError(reason||'avatar_connection_failed');},()=>{connection.current=null;setAvatar(false);setRemaining(0);setAvatarEnd('time');setError(null);},setRemaining);connection.current=c;await c.start(video.current!,request.signal);if(current!==epoch.current){await c.stop();return;}setAvatar(true);await speak(question.question[language]);}catch(e){fail(e);}finally{lock.current=false;setBusy(false);}
 }
 function persist(next:ReferenceRecord){
  setRecord(next);
  try{const all=[next,...records().filter(r=>r.id!==next.id)];localStorage.setItem(KEY,JSON.stringify(all));setSaved(all);setStorageError(false);return true;}catch{setStorageError(true);return false;}
 }
 function answerHistory():ReferenceTurn[]{
  if(!question)return [];
  const history:ReferenceTurn[]=dialogue.length?[...dialogue]:[{id:crypto.randomUUID(),role:'assistant',text:question.question[language],pointIds:question.points.map(p=>p.id),delivery:'text'}];
  if(answer.trim()){
   if(history.at(-1)?.role==='user')return history;
   history.push({id:crypto.randomUUID(),role:'user',text:answer.trim(),inputKind,...(draftDelivery?{spokenDelivery:draftDelivery}:{}),pointIds:history.at(-1)!.pointIds,delivery:'text'});
  }
  // Unanswered follow-ups are retained in the saved discussion, but not assessed as learner evidence.
  return history.at(-1)?.role==='assistant'?history.slice(0,-1):history;
 }
 function currentRecord(turns:ReferenceTurn[]):ReferenceRecord{
  return {...record,id:record?.id||auditSession.current,sessionId:record?.sessionId||record?.id||auditSession.current,question:question!,language,attempts:record?.attempts||[],turns,draftAnswer:undefined,draftSpokenDelivery:undefined,focusPointId:record?.focusPointId};
 }
 async function continueDiscussion(){
  if(lock.current||!question||(!answer.trim()&&!hasAnswers))return;
  lock.current=true;setBusy(true);setFollowupBusy(true);setError(null);await stopOutput();
  const current=++epoch.current,request=new AbortController();controller.current=request;
  const turns=answerHistory(),next=currentRecord(turns);persist(next);setAnswer('');setDraftDelivery(undefined);
  try{
   const followup=await api<{text:string;pointIds:string[];readyForReview:boolean}>('/api/training/followup',{sessionId:next.sessionId||next.id,language,questionId:question.id,referenceVersion:question.referenceVersion,focusPointId:record?.focusPointId,turns},request.signal);
   if(current!==epoch.current)return;
   if(followup.readyForReview){
    await completeQuestion(next,turns,request,current,true);
   }else{
    const turn:ReferenceTurn={id:crypto.randomUUID(),role:'assistant',text:followup.text,pointIds:followup.pointIds,delivery:'text'};
    persist({...next,turns:[...turns,turn]});
    if(avatar)await speak(followup.text);
   }
  }catch(e){if(current===epoch.current)fail(e);}finally{lock.current=false;setBusy(false);setFollowupBusy(false);}
 }
 async function completeQuestion(next:ReferenceRecord,turns:ReferenceTurn[],request:AbortController,current:number,advance:boolean){
  const assessment=await api<ReferenceAssessment>('/api/training/assess',{sessionId:next.sessionId||next.id,language:next.language,questionId:next.question.id,referenceVersion:next.question.referenceVersion,answer:turns.filter(t=>t.role==='user').map(t=>t.text).join('\n\n'),turns},request.signal);
  if(current!==epoch.current)return;
  const completed:ReferenceRecord={...next,completed:true,retrying:false,turns:[],attempts:[...next.attempts,{id:crypto.randomUUID(),at:Date.now(),answer:turns.filter(t=>t.role==='user').map(t=>t.text).join('\n\n'),turns:next.turns,assessment,focusPointId:next.focusPointId,focusDelivery:next.focusDelivery,focusAudioCriterion:next.focusAudioCriterion,focusQualityId:next.focusQualityId}]};
  // Assessment and the original source snapshot are saved before advancing. Storage failure never discards the question.
  if(!persist(completed)){setReadyForReview(true);return;}
  setReadyForReview(false);
  if(advance&&!next.retrying){
   const all=records(),sessionId=next.sessionId||next.id;
   const asked=new Set(all.filter(r=>(r.sessionId||r.id)===sessionId).flatMap(r=>[r.question.id,...(r.askedQuestionIds||[])]));
   const candidate=questions.find(q=>q.tradition===next.question.tradition&&!asked.has(q.id));
   if(candidate){
    const following:ReferenceRecord={id:crypto.randomUUID(),sessionId,askedQuestionIds:[...asked,candidate.id],question:candidate,language:next.language,attempts:[],turns:[]};
    if(!persist(following)){setRecord(completed);setReadyForReview(true);return;}
    setQuestionId(candidate.id);setAnswer('');setDraftDelivery(undefined);setReveal(false);
    if(avatar)await speak(candidate.question[next.language]);
   }else{persist({...completed,exhausted:true});await connection.current?.stop();connection.current=null;setAvatar(false);setRemaining(null);}
  }
 }
 async function assess(){
  if(lock.current||!question||(!answer.trim()&&!hasAnswers))return;lock.current=true;setBusy(true);setError(null);await stopOutput();const current=++epoch.current;const request=new AbortController();controller.current=request;
  const turns=answerHistory(),reviewTranscript=!answer.trim()&&dialogue.at(-1)?.role==='assistant'?[...dialogue]:turns,next=currentRecord(reviewTranscript);persist(next);setAnswer('');setDraftDelivery(undefined);
  try{await completeQuestion(next,turns,request,current,false);
   if(current===epoch.current){await connection.current?.stop();connection.current=null;setAvatar(false);setRemaining(null);}
  }catch(e){if(current===epoch.current)fail(e);}finally{lock.current=false;setBusy(false);}
 }
 async function endDiscussion(){
  if(lock.current||mic)return;
  if(answer.trim()||hasAnswers){await assess();return;}
  await stopOutput();await connection.current?.stop();connection.current=null;setAvatar(false);setRemaining(null);
  const completed=sessionRecords.find(r=>r.completed);
  if(completed){setRecord(completed);setQuestionId(completed.question.id);setReadyForReview(false);}
 }
 async function toggleMic(){
  if(mic){setMic(false);setBusy(true);lock.current=true;const current=epoch.current;const request=new AbortController();controller.current=request;
   try{const blob=await microphone.current.finish();const response=await fetch(`/api/transcribe?language=${language}`,{method:'POST',headers:{'Content-Type':blob.type,'X-Basira-Session':record?.id||auditSession.current},body:blob,signal:AbortSignal.any([request.signal,AbortSignal.timeout(60000)])});const result=await response.json();if(!response.ok)throw new RequestError(result.error);const measured=await analyzeRecording(blob,result.text);if(current===epoch.current){rememberClip(measured.recordingId,blob);setDraftDelivery(measured);setAnswer(result.text);setInputKind('transcribed');persist({...currentRecord(dialogue),draftAnswer:result.text,draftInputKind:'transcribed',draftSpokenDelivery:measured});
    if(includeSpeech&&config?.voice.audioAssessmentConfigured){setAssessingSpeech(true);try{const r=await fetch(`/api/training/speech-review?language=${language}`,{method:'POST',headers:{'Content-Type':blob.type,'X-Basira-Session':record?.id||auditSession.current},body:blob,signal:AbortSignal.any([request.signal,AbortSignal.timeout(70000)])});const review=await r.json();if(!r.ok)throw new RequestError(review.error);measured.assessment=review;}catch(e){measured.assessmentError=e instanceof RequestError?e.code:'connection_failed';}finally{setAssessingSpeech(false);}if(current===epoch.current){setDraftDelivery({...measured});persist({...currentRecord(dialogue),draftAnswer:result.text,draftInputKind:'transcribed',draftSpokenDelivery:{...measured}});}}
   }}catch(e){fail(e);}finally{lock.current=false;setBusy(false);}return;}
  if(lock.current)return;await stopOutput();try{await microphone.current.start(()=>{microphone.current.cancel();setMic(false);setError('recording_limit');});setMic(true);}catch{setError('microphone_unavailable');}
 }
 async function leave(){epoch.current++;controller.current?.abort();microphone.current.cancel();await stopOutput();await connection.current?.stop();connection.current=null;onBack();}
 const last=record?.attempts.at(-1);
 const reviewing=!!record?.completed&&!record.retrying;
 return <section className="reference-practice"><div className="video-call-heading"><h2>{ar?'تدرّب على سؤال موثّق':'Practise a sourced question'}</h2><button className="text-button" disabled={busy} onClick={()=>void leave()}>{ar?'العودة للحوار':'Back to dialogue'}</button></div><p className="scope-note">{ar?'نقارن إجابتك بإجابة المؤلف المسلم في المرجع، لا نحكم على أتباع دين أو نفترض اتفاقهم. أسئلة مولّدة من المراجع ومراجعة آليًا؛ ما زالت تحتاج إلى مراجعة مختص. الشخصية محاكاة للتدريب وليست ممثلًا لجميع أتباع الدين.':'Your answer is compared with the Muslim author’s reference answer, not used to judge or stereotype a religious community. Questions are drawn from source material and model-reviewed; specialist review is pending. The interlocutor is simulated and does not represent everyone in a community.'}</p>
  <div className="reference-selectors"><label>{ar?'سياق الحوار':'Dialogue context'}<select value={tradition} disabled={busy||mic||avatar||!questionsLoaded} onChange={e=>{epoch.current++;void stopOutput();setTradition(e.target.value as Tradition);setRecord(null);auditSession.current=crypto.randomUUID();setReadyForReview(false);setAnswer('');setDraftDelivery(undefined);setReveal(false);setQuestionId(questions.find(q=>q.tradition===e.target.value)?.id||'');}}>{(Object.keys(traditionLabels) as Tradition[]).map(t=><option key={t} value={t}>{traditionLabels[t][lang]} ({questions.filter(q=>q.tradition===t).length})</option>)}</select></label><label>{ar?'لغة التدريب':'Practice language'}<select value={language} disabled={busy||mic||!!record||avatar} onChange={e=>{epoch.current++;void stopOutput();setLanguage(e.target.value as Lang);}}><option value="ar">العربية</option><option value="en">English</option></select></label></div>
  {!questionsLoaded&&<p role="status">{ar?'جارٍ تحميل الأسئلة والمراجع…':'Loading questions and references…'}</p>}
  {questionsLoaded&&!question&&<p role="status">{ar?'لا توجد أسئلة موثّقة متاحة لهذا السياق بعد. لم نولّد إجابات بديلة.':'No source-checked questions are available for this context yet. No replacement answers were generated.'}</p>}
  <div className="reference-questions"><label>{ar?'اختر سؤالًا':'Choose a question'}<select value={questionId} disabled={busy||mic||avatar||!questionsLoaded} onChange={e=>{const q=questions.find(q=>q.id===e.target.value);if(q)choose(q);}}>{questions.filter(q=>q.tradition===tradition).map(q=><option value={q.id} key={q.id}>{q.question[language]}</option>)}</select></label></div>
  <video className={`reference-avatar ${avatar?'connected':''}`} ref={video} autoPlay playsInline/>
  {question&&<><div className="practice-question"><span className="eyebrow"><BookOpen size={16}/>{question.source.title} · {question.source.pages}</span><h3 dir="auto">{question.question[language]}</h3></div><div className="media-actions">{config?.avatar.configured&&!avatar&&<button className="secondary" disabled={busy||mic} onClick={()=>void enableAvatar()}>{ar?'اسألني بصوت الشخصية':'Ask me with the avatar'}</button>}{(avatar||config?.voice.configured)&&<button className="text-button" disabled={busy||mic} onClick={()=>void speak([...dialogue].reverse().find(t=>t.role==='assistant')?.text||question.question[language])}><Volume2 size={17}/>{ar?'استمع للسؤال':'Listen to question'}</button>}{speaking&&<button className="text-button" onClick={()=>void stopOutput()}><Square size={16}/>{ar?'إيقاف الصوت':'Stop speech'}</button>}{avatar&&<button className="text-button" onClick={()=>{void connection.current?.stop();connection.current=null;setAvatar(false);}}>{ar?'إنهاء الشخصية':'End avatar'}</button>}</div>{avatar&&remaining!==null&&remaining>0&&remaining<=AVATAR_WARNING_SECONDS&&<p role="status">{sessionMessages[lang].warning}</p>}{avatarEnd&&<p className="session-limit-note" role="status">{avatarEnd==='idle'?sessionMessages[lang].idleEnded:sessionMessages[lang].timeEnded}</p>}
  {dialogue.length>0&&<section className="reference-dialogue" aria-label={ar?'سجل المناقشة':'Discussion history'} aria-live="polite">{dialogue.map(t=><article key={t.id} className={`reference-turn ${t.role}`}><strong>{t.role==='user'?(ar?'أنت':'You'):(ar?'شخصية التدريب':'Practice partner')}</strong><p dir="auto">{t.text}</p></article>)}</section>}
  {record?.exhausted&&<p role="status">{ar?'أكملت جميع الأسئلة المتاحة لهذا السياق في هذه الجلسة. يمكنك مراجعة إجاباتك أو بدء جلسة جديدة.':'You have completed all available questions for this context in this session. Review your answers or start a new session.'}</p>}
  {sessionRecords.length>0&&<section className="saved-sessions" aria-label={ar?'أسئلة هذه الجلسة':'Questions in this session'}><h3>{ar?'أسئلة هذه الجلسة':'Questions in this session'} ({sessionRecords.length})</h3><p>{ar?'عند اكتمال السؤال نحفظ مراجعته وننتقل إلى سؤال لم يُطرح. يمكنك إنهاء المناقشة ومراجعتها في أي وقت.':'When a question is complete, we save its assessment and move to an unasked question. You can end and review at any time.'}</p>{sessionRecords.filter(r=>r.completed).map(r=><button className="text-button" key={r.id} disabled={busy||mic||(!reviewing&&(hasAnswers||!!answer.trim()))} onClick={()=>{void stopOutput();setRecord(r);setQuestionId(r.question.id);setAnswer('');setDraftDelivery(undefined);setReadyForReview(false);}}>{r.question.question[language]}</button>)}{sessionRecords.filter(r=>!r.completed&&r.id!==record?.id).map(r=><button key={r.id} className="secondary" disabled={busy||mic} onClick={()=>{void stopOutput();setRecord(r);setQuestionId(r.question.id);setAnswer(r.draftAnswer||'');setDraftDelivery(r.draftSpokenDelivery);setInputKind(r.draftInputKind||'unknown');setReadyForReview(false);}}>{ar?'استئناف المناقشة':'Resume discussion'}</button>)}</section>}
  {readyForReview&&<p role="status">{ar?'يمكنك الآن مراجعة المناقشة وفق معايير السؤال ومراجعه.':'You can now review this discussion against the question’s reference criteria.'}</p>}
  {record?.focusDelivery&&<p className="reference-focus" role="status">{record.focusAudioCriterion?`${ar?'تركيز الإعادة: ':'Retry focus: '}${AUDIO_CRITERIA[record.focusAudioCriterion][lang]}. ${ar?'سجّل الإجابة عن السؤال نفسه وطبّق الاقتراح، ثم قارن التسجيلين.':'Record the same answer using the suggestion, then compare both recordings.'}`:ar?'تركيز الإعادة: سجّل الإجابة عن السؤال نفسه. أكمل فكرة قصيرة قبل الوقفة، ثم استمع إلى المحاولتين. لا تحتاج إلى الإسراع.':'Retry focus: record the same answer. Complete a short thought before pausing, then listen to both attempts. There is no need to speed up.'}</p>}
  {record?.focusQualityId&&<p className="reference-focus" role="status">{ar?'نقطة التركيز لهذه المحاولة: ':'Focus for this attempt: '}{QUALITY_CRITERIA[record.focusQualityId][lang]}</p>}
  {record?.focusPointId&&<p className="reference-focus" role="status">{ar?'نقطة التركيز لهذه المحاولة: ':'Focus for this attempt: '}{question.points.find(p=>p.id===record.focusPointId)?.text[language]}</p>}
  {config?.voice.transcriptionConfigured&&<p className="scope-note">{ar?'يُرسل التسجيل للتفريغ. عند تفعيل المراجعة الصوتية يُرسل أيضًا لتحليل النطق والطلاقة والتنغيم. تُحفظ الملاحظات مع المحاولة وفي سجل مراجعة النظام، ولا نحفظ الصوت في السجل. يبقى آخر ١٠ تسجيلات للتشغيل في ذاكرة هذه الصفحة فقط؛ مغادرة التدريب تزيلها.':'Recordings are sent for transcription and, when enabled, audio-based pronunciation, fluency and intonation coaching. Feedback is saved with the attempt and in the system review log; audio is not stored in that log. The latest 10 recordings remain in page memory for playback; leaving training clears them.'}</p>}
  {config?.voice.audioAssessmentConfigured&&<label className="speech-opt-in"><input type="checkbox" checked={includeSpeech} disabled={busy||mic} onChange={e=>setIncludeSpeech(e.target.checked)}/>{ar?'مراجعة النطق والطلاقة والتنغيم من التسجيل':'Review pronunciation, fluency and intonation from the recording'}</label>}
  {assessingSpeech&&<p role="status" className="reference-focus">{ar?'جارٍ الاستماع إلى التسجيل ومراجعة الأداء الصوتي… نصك محفوظ.':'Listening to your recording and reviewing spoken delivery… Your transcript is saved.'}</p>}
  {draftDelivery?.assessmentError&&<p role="status">{ar?'تعذّرت المراجعة الصوتية؛ يمكنك متابعة التدريب بالنص المحفوظ أو تسجيل محاولة جديدة.':'Audio review was unavailable; continue with your saved transcript or record a new attempt.'}</p>}

  <label>{ar?'إجابتك':'Your answer'}<textarea ref={answerInput} maxLength={2400} rows={4} dir="auto" value={answer} disabled={busy||reviewing||dialogue.at(-1)?.role==='user'} onChange={e=>{const kind=inputKind==='transcribed'||inputKind==='corrected_transcript'?'corrected_transcript':'typed';setInputKind(kind);setAnswer(e.target.value);const delivery=draftDelivery?{...draftDelivery,transcriptEdited:true}:undefined;setDraftDelivery(delivery);if(question)persist({...currentRecord(dialogue),draftAnswer:e.target.value,draftInputKind:kind,draftSpokenDelivery:delivery});}}/></label><div className="media-actions">{config?.voice.transcriptionConfigured&&<button className="secondary" disabled={busy||reviewing||dialogue.at(-1)?.role==='user'} onClick={()=>void toggleMic()}>{mic?<Mic/>:<MicOff/>}{mic?(ar?'إنهاء التسجيل ومراجعة النص':'Stop & check transcript'):(ar?'سجّل إجابتك':'Record answer')}</button>}<button className="secondary" disabled={busy||mic||reviewing||readyForReview||(!answer.trim()&&dialogue.at(-1)?.role!=='user')||!config?.ai.configured} onClick={()=>void continueDiscussion()}>{followupBusy?(ar?'جارٍ التفكير في إجابتك…':'Considering your answer…'):(ar?'تابع المناقشة':'Continue discussion')}</button><button className="primary" disabled={busy||mic||reviewing||(!answer.trim()&&!hasAnswers)||!config?.ai.configured} onClick={()=>void assess()}>{busy?(ar?'جارٍ مراجعة الإجابة…':'Reviewing answer…'):(ar?'قيّم إجابتي بالمرجع':'Compare my answer with the reference')}</button></div>
  {record&&!reviewing&&<button className="secondary" disabled={busy||mic} onClick={()=>void endDiscussion()}>{ar?'إنهاء المناقشة ومراجعتها':'End discussion and review'}</button>}
  {record&&<button className="text-button" disabled={busy||mic} onClick={()=>{void stopOutput();void connection.current?.stop();connection.current=null;setAvatar(false);setRemaining(null);setRecord(null);auditSession.current=crypto.randomUUID();setAnswer('');setDraftDelivery(undefined);setReadyForReview(false);setReveal(false);}}>{ar?'ابدأ جلسة جديدة':'Start a new session'}</button>}
  {last&&record&&<ReferenceReview key={last.id} recordings={recordings} record={record} lang={lang} disabled={busy||mic} onSpeak={(avatar||config?.voice.configured)?()=>void speak(last.assessment.spokenFeedback):undefined} onRetry={pointId=>{setInputKind('typed');setAnswer('');setDraftDelivery(undefined);setReadyForReview(false);persist({...record,completed:false,retrying:true,exhausted:false,draftAnswer:undefined,turns:[],focusDelivery:pointId?.startsWith('delivery:'),focusAudioCriterion:pointId?.startsWith('delivery:')&&pointId!=='delivery:pauses'?pointId.slice(9) as AudioCriterion:undefined,focusPointId:pointId?.startsWith('quality:')||pointId?.startsWith('delivery:')?undefined:pointId,focusQualityId:pointId?.startsWith('quality:')?pointId.slice(8) as QualityCriterion:undefined});answerInput.current?.focus();if(avatar||config?.voice.configured)void speak(question.question[language]);}}/>}
  <button className="text-button" onClick={()=>setReveal(!reveal)}>{ar?(reveal?'إخفاء الجواب المرجعي':'عرض الجواب المرجعي'):(reveal?'Hide reference answer':'Show reference answer')}</button>{reveal&&<section className="reference-answer"><p dir="auto">{question.answer[language]}</p><small>{ar?'إعادة صياغة من المرجع؛ ليست اقتباسًا حرفيًا':'Paraphrased from the source; not a verbatim quotation'}</small><p>{question.source.author} · {question.source.pages}</p><blockquote dir="auto">{question.source.excerpt}</blockquote><a href={question.source.url} target="_blank" rel="noreferrer">{question.source.title}</a></section>}
  </>}
  {error&&<p role="alert">{errorMessage(error,lang)}</p>}{storageError&&<p role="alert">{ar?'تعذّر حفظ أو قراءة المحاولات على هذا الجهاز.':'Could not save or read attempts on this device.'}</p>}
  <details className="saved-sessions"><summary>{ar?'تدريبات مرجعية محفوظة':'Saved reference practice'} ({saved.length})</summary>{saved.map(r=><div key={r.id}><span>{r.question.question[lang]}</span><button className="text-button" disabled={busy||mic||avatar||!questionsLoaded} onClick={()=>{epoch.current++;void stopOutput();setRecord(r);auditSession.current=r.id;setReadyForReview(false);setTradition(r.question.tradition);setQuestionId(r.question.id);setLanguage(r.language);setAnswer(r.draftAnswer||'');setDraftDelivery(r.draftSpokenDelivery);setInputKind(r.draftInputKind||'unknown');setReveal(false);}}>{ar?'فتح':'Open'}</button><button className="text-button" disabled={busy||mic||avatar||!questionsLoaded} onClick={()=>{try{const all=records().filter(v=>v.id!==r.id);localStorage.setItem(KEY,JSON.stringify(all));setSaved(all);removeClips(r);if(record?.id===r.id)setRecord(null);}catch{setStorageError(true);}}}>{ar?'حذف':'Delete'}</button></div>)}</details>
 </section>;
}
