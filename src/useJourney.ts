import {useCallback,useEffect,useRef,useState} from 'react';
import {api,RequestError,speech} from './api';
import {Microphone,PcmPlayer} from './audio';
import {copy,followup,prompt,type Lang,type Turn} from './content';
import {SOURCES,type Attempt,type Comparison,type Feedback,type Finding,type Practice} from './domain';
import {loadSessions,saveSession,deleteSession,deleteAllSessions,type SavedSession} from './sessionStore';
import {createAvatarConnection,type AvatarConnection} from './avatarConnection';

export type Config={training?:{environment?:string;scope?:string;configured:boolean;avatarConfigured:boolean};audit?:{retentionDays?:number;enabled:boolean;backend:string;configured:boolean;mediaStored:boolean};videoCall?:{configured:boolean;reviewConfigured:boolean};ai:{configured:boolean;missing:string[]};voice:{configured:boolean;transcriptionConfigured?:boolean;audioAssessmentConfigured?:boolean;languages:Lang[]};avatar:{provider?:'tavus'|'liveavatar';configured:boolean;missing:string[]};languages:Lang[]};
export type Phase='setup'|'connecting'|'conversation'|'review'|'error'|'offline'|'time-ended';
export function useJourney(){
  const [sessionLang,setSessionLang]=useState<Lang>('ar');
  const [engine,setEngine]=useState<'ai'|'demo'>('ai');
  const [openingQuestion,setOpeningQuestion]=useState<string|null>(null);
  const [interaction,setInteraction]=useState<'text'|'voice'|'avatar'|'portrait'>('avatar');
  const [phase,setPhase]=useState<Phase>('setup');
  const [config,setConfig]=useState<Config|null>(null);
  const [configError,setConfigError]=useState(false);
  const [turns,setTurns]=useState<Turn[]>([]);
  const turnsRef=useRef<Turn[]>([]);
  const [input,setInput]=useState('');
  const [status,setStatus]=useState<'listening'|'thinking'|'speaking'>('listening');
  const [audioLevel,setAudioLevel]=useState(0);
  const [mic,setMic]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [latency,setLatency]=useState<number|null>(null);
  const [voiceLatency,setVoiceLatency]=useState<number|null>(null);
  const [attempt,setAttempt]=useState<Attempt|null>(null);
  const [practice,setPractice]=useState<Practice|null>(null);
  const practiceRef=useRef<Practice|null>(null);
  const [comparison,setComparison]=useState<Comparison|null>(null);
  const [reviewBusy,setReviewBusy]=useState(false);
  const [reviewError,setReviewError]=useState<string|null>(null);
  const [selected,setSelected]=useState<string|null>(null);
  const [seconds,setSeconds]=useState(0);
  const [avatarRemaining,setAvatarRemaining]=useState<number|null>(null);
  const [saved,setSaved]=useState<SavedSession[]>([]);
  const [storageError,setStorageError]=useState(false);
  const [recordId,setRecordId]=useState<string|null>(null);
  const auditSessionId=useRef<string|null>(null);
  const [recordSources,setRecordSources]=useState(()=>structuredClone(SOURCES));
  const [autoSend,setAutoSend]=useState(true);
  useEffect(()=>{try{setSaved(loadSessions());}catch{setStorageError(true);}},[]);
  useEffect(()=>{
    if(!recordId||!turns.length)return;
    try{setSaved(saveSession({id:recordId,updatedAt:Date.now(),language:sessionLang,mode:engine,finished:phase==='review',turns,attempt,practice,comparison,selected,sources:recordSources}));setStorageError(false);}
    catch{setStorageError(true);}
  },[recordId,turns,sessionLang,engine,phase,attempt,practice,comparison,selected,recordSources]);
  const video=useRef<HTMLVideoElement>(null);
  const connection=useRef<AvatarConnection|null>(null);
  const player=useRef(new PcmPlayer());
  const microphone=useRef(new Microphone());
  const controller=useRef<AbortController|null>(null);
  const epoch=useRef(0),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const phaseRef=useRef(phase);phaseRef.current=phase;
  const sendLock=useRef(false),startLock=useRef(false),finishLock=useRef(false);
  const voice=engine==='ai'&&interaction!=='text';
  const updateTurns=useCallback((value:Turn[]|((old:Turn[])=>Turn[]))=>{
    const next=typeof value==='function'?value(turnsRef.current):value;
    turnsRef.current=next;setTurns(next);
  },[]);
  const markUncertain=useCallback(()=>updateTurns(old=>old.map(t=>t.role==='assistant'&&t.delivery==='pending'?{...t,interrupted:true,delivery:'uncertain'}:t)),[updateTurns]);
  const cancel=useCallback(()=>{
    epoch.current++;controller.current?.abort();controller.current=null;
    if(timer.current)clearTimeout(timer.current);timer.current=null;
    player.current.stop();microphone.current.cancel();sendLock.current=false;
    markUncertain();setMic(false);setStatus('listening');
  },[markUncertain]);
  const closeMedia=useCallback(async()=>{cancel();const live=connection.current;connection.current=null;await live?.stop();},[cancel]);
  async function loadConfig(){
    setConfigError(false);
    try{setConfig(await api<Config>('/api/config'));}catch{setConfigError(true);}
  }
  useEffect(()=>{void loadConfig();return()=>{epoch.current++;controller.current?.abort();if(timer.current)clearTimeout(timer.current);microphone.current.cancel();void player.current.close();void connection.current?.stop();};},[]);
  useEffect(()=>{if(phase!=='conversation')return;const id=setInterval(()=>setSeconds(s=>s+1),1000);return()=>clearInterval(id);},[phase]);
  useEffect(()=>{
    const offline=()=>{if(['conversation','connecting'].includes(phaseRef.current)){void closeMedia();setPhase('offline');}};
    window.addEventListener('offline',offline);return()=>window.removeEventListener('offline',offline);
  },[closeMedia]);
  function fail(error:unknown){setError(error instanceof RequestError?error.code:'connection_failed');}
  async function playTurn(turn:Turn,id:number,signal:AbortSignal,startedAt:number){
    if(!voice)return;
    const started=()=>{if(id===epoch.current){setStatus('speaking');setVoiceLatency(Math.round(performance.now()-startedAt));}};
    const avatar=connection.current;
    let completed:boolean;
    if(avatar?.speakText){
      // Tavus owns synthesis and lip sync; the conversation engine supplies text.
      completed=await avatar.speakText(turn.text,started);
    }else{
      const pcm=await speech(turn.text,sessionLang,signal,auditSessionId.current||undefined);
      if(id!==epoch.current)return;
      completed=avatar?await avatar.speak(pcm,started):await player.current.play(pcm,started,interaction==='portrait'?setAudioLevel:undefined);
    }
    if(id!==epoch.current)return;
    updateTurns(old=>old.map(t=>t.id===turn.id?{...t,delivery:completed?'complete':'uncertain',interrupted:!completed}:t));
    setStatus('listening');
  }
  async function respond(history:Turn[]){
    const id=epoch.current,request=new AbortController();controller.current=request;
    const startedAt=performance.now();setStatus('thinking');setError(null);sendLock.current=true;
    try{
      const result=await api<{text:string;latencyMs:number}>('/api/conversation',{sessionId:auditSessionId.current,language:sessionLang,turns:history},request.signal);
      if(id!==epoch.current)return;
      const turn:Turn={id:crypto.randomUUID(),role:'assistant',text:result.text,at:Date.now(),delivery:voice?'pending':'text'};
      updateTurns([...history,turn]);setLatency(result.latencyMs);
      if(voice)await playTurn(turn,id,request.signal,startedAt);else setStatus('listening');
    }catch(e){if(id===epoch.current){markUncertain();fail(e);setStatus('listening');}}
    finally{if(id===epoch.current)sendLock.current=false;}
  }
  async function begin(target?:Practice){
    if(startLock.current)return;startLock.current=true;
    let runEpoch:number|undefined;
    try{
      // Unlock audio in the click gesture before waiting for network setup.
      if(voice&&interaction!=='avatar')await player.current.prepare();
      await closeMedia();
      const id=epoch.current;runEpoch=id;const request=new AbortController();controller.current=request;
      setError(null);setReviewError(null);setReviewBusy(false);setComparison(null);setInput('');setSeconds(0);setAvatarRemaining(null);setLatency(null);setVoiceLatency(null);
      auditSessionId.current=crypto.randomUUID();setRecordId(auditSessionId.current);setRecordSources(structuredClone(SOURCES));setAttempt(null);
      updateTurns([]);setPractice(target||null);practiceRef.current=target||null;
      if(engine==='ai'&&!navigator.onLine){setPhase('offline');return;}
      setPhase('connecting');
      if(voice&&interaction==='avatar'){
        const live=await createAvatarConnection(config?.avatar.provider,(reason)=>{cancel();setError(reason||'avatar_connection_failed');setPhase(reason==='avatar_idle_ended'?'time-ended':'offline');},()=>{cancel();setPhase('time-ended');},setAvatarRemaining);
        if(id!==epoch.current)return;connection.current=live;
        await live.start(video.current!,request.signal);
        if(id!==epoch.current)return;
      }
      setPhase('conversation');setStatus('listening');
      if(target||engine==='demo'||openingQuestion){
        const turn:Turn={id:crypto.randomUUID(),role:'assistant',text:target?target.question.text:openingQuestion||prompt(sessionLang),at:Date.now(),delivery:voice?'pending':'text'};
        updateTurns([turn]);
        if(voice){setStatus('thinking');await playTurn(turn,id,request.signal,performance.now());}
      }else await respond([]);
    }catch(e){if(runEpoch===undefined||runEpoch===epoch.current){await closeMedia();fail(e);setPhase('error');}}
    finally{startLock.current=false;}
  }
  async function review(current:Attempt,target:Practice|null){
    const request=new AbortController();controller.current=request;const id=epoch.current;
    setReviewBusy(true);setReviewError(null);
    try{
      if(current.mode==='demo')return;
      if(target){
        const comparison=await api<Comparison>('/api/compare',{sessionId:auditSessionId.current,language:sessionLang,criterion:target.finding.criterion,questionTurnId:target.question.id,answerTurnId:target.finding.evidence.turnId,original:target.original.turns,retry:current.turns},request.signal);
        if(id===epoch.current)setComparison(comparison);
      }else{
        const feedback=await api<Feedback>('/api/feedback',{sessionId:auditSessionId.current,language:sessionLang,turns:current.turns},request.signal);
        if(id===epoch.current){setAttempt({...current,feedback});setSelected(feedback.findings[0]?.id||null);}
      }
    }catch(e){if(id===epoch.current)setReviewError(e instanceof RequestError?e.code:'connection_failed');}
    finally{if(id===epoch.current)setReviewBusy(false);}
  }
  async function finish(){
    if(finishLock.current)return;finishLock.current=true;
    try{
      await closeMedia();setPhase('review');setSelected(null);
      const current:Attempt={id:crypto.randomUUID(),language:sessionLang,turns:structuredClone(turnsRef.current),mode:engine};
      setAttempt(current);setComparison(null);
      if(!current.turns.some(t=>t.role==='user'))return;
      await review(current,practiceRef.current);
    }finally{finishLock.current=false;}
  }
  function submit(e:React.FormEvent){
    e.preventDefault();
    if(sendLock.current||phase!=='conversation'||mic||status!=='listening')return;
    sendAnswer(input);
  }
  function sendAnswer(answer:string){
    const value=answer.trim();if(!value||phaseRef.current!=='conversation')return;
    const turn:Turn={id:crypto.randomUUID(),role:'user',text:value,at:Date.now(),delivery:'text'};
    const history=[...turnsRef.current,turn];updateTurns(history);setInput('');setError(null);
    if(practiceRef.current){void finish();return;}
    if(engine==='ai'){void respond(history);return;}
    setStatus('thinking');sendLock.current=true;const id=epoch.current;
    timer.current=setTimeout(()=>{
      if(id!==epoch.current)return;
      updateTurns([...history,{id:crypto.randomUUID(),role:'assistant',text:followup(sessionLang,history.filter(t=>t.role==='user').length),at:Date.now(),delivery:'text'}]);
      setStatus('listening');sendLock.current=false;
    },450);
  }
  async function interrupt(){
    cancel();setError(null);sendLock.current=true;
    try{await connection.current?.interrupt();}
    catch{await closeMedia();setPhase('offline');throw new Error('interrupt_failed');}
    finally{sendLock.current=false;}
  }
  async function toggleMicrophone(){
    if(mic){
      const id=epoch.current;setMic(false);setStatus('thinking');
      connection.current?.listening(false);
      const request=new AbortController();controller.current=request;
      try{
        const blob=await microphone.current.finish();
        const response=await fetch(`/api/transcribe?language=${sessionLang}`,{method:'POST',headers:{'Content-Type':blob.type,...(auditSessionId.current?{'X-Basira-Session':auditSessionId.current}:{})},body:blob,signal:AbortSignal.any([request.signal,AbortSignal.timeout(60000)])});
        const data=await response.json();if(!response.ok)throw new RequestError(data.error||'voice_failed');
        if(id===epoch.current){setStatus('listening');if(autoSend)sendAnswer(data.text);else setInput(data.text);}
      }catch(e){if(id===epoch.current){fail(e);setStatus('listening');}}
      return;
    }
    try{
      await interrupt();
      const id=epoch.current;
      sendLock.current=true;setStatus('thinking');
      await microphone.current.start(()=>{microphone.current.cancel();setMic(false);setError('recording_limit');connection.current?.listening(false);});
      if(id!==epoch.current){microphone.current.cancel();return;}
      sendLock.current=false;setMic(true);setStatus('listening');connection.current?.listening(true);
    }catch(e){sendLock.current=false;setStatus('listening');if(phaseRef.current!=='offline')setError('microphone_unavailable');}
  }
  function mute(){microphone.current.cancel();setMic(false);connection.current?.listening(false);}
  async function retry(){
    if(!attempt)return;
    let finding=attempt.feedback?.findings.find(f=>f.id===selected);
    if(engine==='demo'){
      const answer=attempt.turns.find(t=>t.role==='user'),question=attempt.turns.find(t=>t.role==='assistant');
      if(!answer||!question)return;
      finding={id:'demo-practice',criterion:'understanding',observation:'',suggestion:copy[sessionLang].retryHint,evidence:{turnId:answer.id,quote:answer.text},questionTurnId:question.id,sourceId:'quran-16-125'};
    }
    if(!finding)return;
    const question=attempt.turns.find(t=>t.id===finding.questionTurnId);if(!question)return;
    await begin({original:structuredClone(attempt),finding:structuredClone(finding),question:structuredClone(question)});
  }
  function reset(){setEngine('ai');setOpeningQuestion(null);void closeMedia();setRecordId(null);updateTurns([]);setPractice(null);practiceRef.current=null;setAttempt(null);setPhase('setup');setError(null);}
  async function restoreSession(record:SavedSession){
    await closeMedia();auditSessionId.current=record.id;setRecordId(record.id);setRecordSources(structuredClone(record.sources));
    setSessionLang(record.language);setEngine(record.mode);setInteraction('text');updateTurns(structuredClone(record.turns));
    setAttempt(record.attempt);setPractice(record.practice);practiceRef.current=record.practice;
    setComparison(record.comparison);setSelected(record.selected);setInput('');setError(null);
    setReviewBusy(false);setLatency(null);setVoiceLatency(null);setSeconds(0);
    setReviewError(record.finished&&record.mode==='ai'&&record.turns.some(t=>t.role==='user')&&!(record.practice?record.comparison:record.attempt?.feedback)?'review_incomplete':null);
    setPhase(record.finished?'review':'offline');
  }
  async function removeSession(id:string){
    const target=saved.find(s=>s.id===id);
    if(recordId===id||(target&&!target.practice&&target.attempt?.id===practice?.original.id)){await closeMedia();setRecordId(null);updateTurns([]);setAttempt(null);setPractice(null);practiceRef.current=null;setComparison(null);setPhase('setup');}
    try{setSaved(deleteSession(id));setStorageError(false);}catch{setStorageError(true);}
  }
  async function removeAllSessions(){
    await closeMedia();setRecordId(null);updateTurns([]);setAttempt(null);setPractice(null);practiceRef.current=null;setComparison(null);setPhase('setup');
    try{deleteAllSessions();setSaved([]);setStorageError(false);}catch{setStorageError(true);}
  }
  async function acceptVideoTranscript(id:string,videoTurns:Turn[]){
    await closeMedia();setEngine('ai');setInteraction('text');setRecordId(id);setRecordSources(structuredClone(SOURCES));
    setPractice(null);practiceRef.current=null;setSelected(null);setComparison(null);setError(null);setPhase('review');
    updateTurns(videoTurns);
    const current:Attempt={id:crypto.randomUUID(),language:sessionLang,turns:structuredClone(videoTurns),mode:'ai'};
    setAttempt(current);if(videoTurns.some(t=>t.role==='user'))await review(current,null);
  }
  async function continueVideoAsText(id:string,videoTurns:Turn[]){
    await closeMedia();auditSessionId.current=id;setRecordId(id);setRecordSources(structuredClone(SOURCES));
    setEngine('ai');setInteraction('text');setPractice(null);practiceRef.current=null;
    setAttempt(null);setComparison(null);setSelected(null);setInput('');setError(null);
    setReviewError(null);setStatus('listening');updateTurns(structuredClone(videoTurns));setPhase('conversation');
  }
  async function enableStandaloneVoice(){await closeMedia();await player.current.prepare();setInteraction('voice');setError(null);setStatus('listening');setPhase('conversation');}
  async function prepareAvatarRestart(){await closeMedia();setError(null);setStatus('listening');return {id:auditSessionId.current||recordId||crypto.randomUUID(),turns:structuredClone(turnsRef.current)};}
  async function resumeText(){await closeMedia();setInteraction('text');setError(null);setPhase('conversation');}
  async function cancelStart(){await closeMedia();setPhase('setup');setError(null);}
  async function reconnectAvatar(){
    if(startLock.current)return;startLock.current=true;
    try{
      await closeMedia();const id=epoch.current;setPhase('connecting');
      const request=new AbortController();controller.current=request;
      const live=await createAvatarConnection(config?.avatar.provider,(reason)=>{cancel();setError(reason||'avatar_connection_failed');setPhase(reason==='avatar_idle_ended'?'time-ended':'offline');},()=>{cancel();setPhase('time-ended');},setAvatarRemaining);
      if(id!==epoch.current)return;connection.current=live;
      await live.start(video.current!,request.signal);
      if(id===epoch.current){setPhase('conversation');setStatus('listening');setError(null);}
    }catch(e){await closeMedia();fail(e);setPhase('offline');}finally{startLock.current=false;}
  }
  return {enableStandaloneVoice,prepareAvatarRestart,continueVideoAsText,acceptVideoTranscript,avatarRemaining,audioLevel,openingQuestion,setOpeningQuestion,saved,storageError,recordSources,restoreSession,removeSession,removeAllSessions,autoSend,setAutoSend,sessionLang,setSessionLang,engine,setEngine,interaction,setInteraction,phase,config,configError,loadConfig,turns,input,setInput,status,mic,error,latency,voiceLatency,attempt,practice,comparison,reviewBusy,reviewError,selected,setSelected,seconds,video,voice,begin,submit,finish,retry,reset,interrupt,toggleMicrophone,mute,resumeText,reconnectAvatar,cancelStart,retryResponse:()=>respond(turnsRef.current),retryReview:()=>attempt&&review(attempt,practice),backToOriginal:()=>{if(practice){cancel();setRecordId(null);setAttempt(practice.original);setSelected(practice.finding.id);setPractice(null);practiceRef.current=null;setComparison(null);setReviewBusy(false);setReviewError(null);}}};
}
