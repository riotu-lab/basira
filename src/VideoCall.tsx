import {useConversationActivity} from './useConversationActivity';
import {useCallCapture} from './useCallCapture';
import {LiveUtterances,displayUtterances} from './liveUtterances';
import {ProgressiveText} from './ProgressiveText';
import {callSounds} from './callSounds';
import {useMicrophoneLevel} from './useMicrophoneLevel';
import {sessionMessages,AVATAR_WARNING_SECONDS} from './sessionMessages';
import {AVATAR_MAX_SECONDS,AvatarIdleGuard} from './avatarLimits';
import {useEffect,useRef,useState} from 'react';
import Daily,{type DailyCall,type DailyParticipant} from '@daily-co/daily-js';
import {Mic,MicOff,Video,VideoOff,Square,Eye,EyeOff,MessageCircle,ArrowUp,RotateCcw,Sparkles,Volume2,VolumeX,ArrowRight,BookOpen} from 'lucide-react';
import type {Lang,Turn} from './content';
import {api,RequestError} from './api';
import {errorMessage} from './experienceCopy';
import {VideoTranscript} from './videoTranscript';
import {saveSession} from './sessionStore';
import {SOURCES} from './domain';

export function VideoCall({onReviewCaptureChange,reviewCapture=false,captureContext,waitingForContinuation=false,trainingEnded,trainingError,trainingToken,trainingTurns,onTrainingUpdate,lang,language,onReview,onBack,onRestart,initialTurns=[],initialSessionId,onContinueText,embedded=false,initialCamera=true,autoStart=false}:{onReviewCaptureChange?:(enabled:boolean)=>void;reviewCapture?:boolean;captureContext?:{sessionId:string;recordId:string;attempt:number};waitingForContinuation?:boolean;trainingEnded?:boolean;trainingError?:string;trainingToken?:string;trainingTurns?:Turn[];onTrainingUpdate?:()=>void;initialTurns?:Turn[];initialSessionId?:string;onRestart?:(id:string,turns:Turn[])=>void|Promise<void>;onContinueText?:(id:string,turns:Turn[])=>void|Promise<void>;initialCamera?:boolean;autoStart?:boolean;embedded?:boolean;lang:Lang;language:Lang;onReview:(id:string,turns:Turn[],finalDraft?:string)=>void|Promise<void>;onBack:()=>void}){
 const openingId=useRef((trainingTurns||initialTurns).length===1&&(trainingTurns||initialTurns)[0].role==='assistant'?(trainingTurns||initialTurns)[0].id:undefined);
 const liveText=useRef(new LiveUtterances()),initialIds=useRef(new Set((trainingTurns||initialTurns).filter(t=>t.id!==openingId.current).map(t=>t.id)));
 const [liveRevision,setLiveRevision]=useState(0),[soundsEnabled,setSoundsEnabled]=useState(()=>callSounds.enabled());
 const connectionChime=useRef(false),typedMessages=useRef(new Set<string>()),reviewRequested=useRef(false);
 const [openingReview,setOpeningReview]=useState(false);
 const transcriptView=useRef<HTMLDivElement>(null),followTranscript=useRef(true);
 const ar=lang==='ar',remote=useRef<HTMLVideoElement>(null),local=useRef<HTMLVideoElement>(null);
 const call=useRef<DailyCall|null>(null),media=useRef<MediaStream|null>(null),handle=useRef<string|undefined>(undefined),remoteId=useRef<string|undefined>(undefined);
 const transcript=useRef(new VideoTranscript()),recordId=useRef(initialSessionId||crypto.randomUUID()),controller=useRef<AbortController|null>(null),generation=useRef(0),finishing=useRef(false),stopPromise=useRef<Promise<void>|null>(null);
 const seeded=useRef(false);if(!seeded.current){transcript.current.turns=structuredClone(initialTurns);seeded.current=true;}
 const conversationId=useRef<string|undefined>(undefined);
 const [typed,setTyped]=useState(''),[sendError,setSendError]=useState(false),[restarting,setRestarting]=useState(false);
 const clearing=useRef(false),starting=useRef(false),cameraPending=useRef(false);
 const [cameraBusy,setCameraBusy]=useState(false),[cameraError,setCameraError]=useState(false);
 const connectTimeout=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),replyTimeout=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const [awaitingReply,setAwaitingReply]=useState(false);
 const idle=useRef<AvatarIdleGuard|null>(null);
 const [idleEnded,setIdleEnded]=useState(false);
 const timer=useRef<ReturnType<typeof setInterval>|undefined>(undefined);
 const [state,setState]=useState<'ready'|'connecting'|'connected'|'ended'>('ready'),[error,setError]=useState<string|null>(null),[remaining,setRemaining]=useState(AVATAR_MAX_SECONDS),[muted,setMuted]=useState(false),[camera,setCamera]=useState(initialCamera),[showText,setShowText]=useState(true),[turns,setTurns]=useState<Turn[]>(()=>structuredClone(initialTurns)),[speaking,setSpeaking]=useState(false),[saveError,setSaveError]=useState(false),[timeEnded,setTimeEnded]=useState(false);
 const [capturedStream,setCapturedStream]=useState<MediaStream|null>(null),[providerHearing,setProviderHearing]=useState(false),[networkRecovering,setNetworkRecovering]=useState(false);
 const activity=useConversationActivity(state==='connected'&&!networkRecovering,waitingForContinuation);
 const capture=useCallCapture({enabled:reviewCapture,stream:capturedStream,active:state==='connected',muted,speaking,camera,context:captureContext,video:local});
 const recoveryTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const micLevel=useMicrophoneLevel(capturedStream,state==='connected'&&!muted,()=>{if(!speaking)idle.current?.touch();});
 const micLabel=muted?(ar?'الميكروفون مكتوم':'Microphone muted'):providerHearing?(ar?'تتلقى الخدمة كلامك':'Speech detected by service'):micLevel>.18?(ar?'الميكروفون يلتقط صوتًا':'Microphone detects sound'):(ar?'الميكروفون جاهز':'Microphone ready');
 const meter=<span className="voice-level-bars" aria-hidden="true">{[.5,.8,1,.7,.45].map((weight,i)=><i key={i} style={{height:`${4+micLevel*22*weight}px`}}/>)}</span>;
 useEffect(()=>{if(followTranscript.current&&transcriptView.current)transcriptView.current.scrollTop=transcriptView.current.scrollHeight;},[turns,showText,liveRevision]);
 function persist(){if(trainingToken){setTurns(structuredClone(transcript.current.turns));onTrainingUpdate?.();return;}const current=structuredClone(transcript.current.turns);setTurns(current);if(!current.length)return;try{saveSession({id:recordId.current,updatedAt:Date.now(),language,mode:'ai',finished:false,turns:current,attempt:null,practice:null,comparison:null,selected:null,sources:structuredClone(SOURCES)});}catch{setSaveError(true);}}
 const stopPath=trainingToken?'/api/training/video-stop':'/api/avatar/stop';
 const stopBody=(id?:string)=>trainingToken?{token:trainingToken}:{id};
 useEffect(()=>{if(waitingForContinuation){activity.listen();clearTimeout(replyTimeout.current);setAwaitingReply(false);setSendError(false);}},[waitingForContinuation,trainingTurns]);
 useEffect(()=>{if(trainingTurns){transcript.current.turns=structuredClone(trainingTurns);setTurns(structuredClone(trainingTurns));}},[trainingTurns]);
 async function stop(){
  if(stopPromise.current)return stopPromise.current;
  activity.reset();await capture.finish();setCapturedStream(null);setProviderHearing(false);clearTimeout(recoveryTimer.current);idle.current?.stop();generation.current++;controller.current?.abort();clearInterval(timer.current);clearTimeout(connectTimeout.current);clearTimeout(replyTimeout.current);
  if(remote.current){remote.current.muted=true;remote.current.pause();remote.current.srcObject=null;}
  media.current?.getTracks().forEach(t=>t.stop());media.current=null;if(local.current)local.current.srcObject=null;
  const c=call.current;call.current=null;
  stopPromise.current=(async()=>{
   await Promise.allSettled([(async()=>{try{await c?.leave();}finally{await c?.destroy();}})(),(async()=>{
    if(!handle.current)return;
    const id=handle.current;
    try{try{await api(stopPath,stopBody(id));}catch{await api(stopPath,stopBody(id));}handle.current=undefined;}
    catch{setError('avatar_stop_unconfirmed');navigator.sendBeacon(stopPath,new Blob([JSON.stringify(stopBody(id))],{type:'application/json'}));}
   })()]);
  })();
  await stopPromise.current;if(handle.current)stopPromise.current=null;
 }
 useEffect(()=>{if(trainingToken&&trainingEnded&&state==='connected')void finishAndReview();},[trainingEnded,trainingError,state]);
 async function end(reason?:string){if(finishing.current)return;callSounds.play('ended');finishing.current=true;if(reason)setError(reason);persist();await stop();setSpeaking(false);setState('ended');}
 useEffect(()=>{
  const exit=()=>{void capture.finish();media.current?.getTracks().forEach(t=>t.stop());if(handle.current)navigator.sendBeacon(stopPath,new Blob([JSON.stringify(stopBody(handle.current))],{type:'application/json'}));};
  const offline=()=>void end('avatar_network_interrupted');
  window.addEventListener('pagehide',exit);window.addEventListener('offline',offline);
  return()=>{exit();void stop();window.removeEventListener('pagehide',exit);window.removeEventListener('offline',offline);};
 },[]);
 useEffect(()=>{if(!autoStart)return;const id=setTimeout(()=>void start(),0);return()=>clearTimeout(id);},[autoStart]);
 async function start(){
  if(state!=='ready'||starting.current)return;callSounds.play('calling');starting.current=true;setState('connecting');setError(null);const epoch=++generation.current;
  const request=new AbortController();controller.current=request;
  try{
   // Permission precedes billable session creation. No implicit camera activation.
   const stream=await navigator.mediaDevices.getUserMedia({video:initialCamera?{facingMode:'user',width:{ideal:640}}:false,audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
   if(epoch!==generation.current){stream.getTracks().forEach(t=>t.stop());return;}media.current=stream;setCapturedStream(stream);
   if(local.current&&stream.getVideoTracks().length){local.current.srcObject=new MediaStream(stream.getVideoTracks());void local.current.play().catch(()=>{});}
   const requestedAt=Date.now();
   const data=await api<{id:string;url:string;meetingToken:string;conversationId:string;maxSessionSeconds:number}>(trainingToken?'/api/training/video-session':'/api/avatar/video-session',trainingToken?{token:trainingToken}:{language,history:transcript.current.turns},request.signal);
   handle.current=data.id;conversationId.current=data.conversationId;
   if(epoch!==generation.current){await api(stopPath,stopBody(data.id));handle.current=undefined;return;}
   const deadline=requestedAt+(Math.min(data.maxSessionSeconds||AVATAR_MAX_SECONDS,AVATAR_MAX_SECONDS)-5)*1000;
   timer.current=setInterval(()=>{const left=Math.max(0,Math.ceil((deadline-Date.now())/1000));setRemaining(left);if(!left){setTimeEnded(true);void end();}},250);
   connectTimeout.current=setTimeout(()=>{if(epoch===generation.current)void end('avatar_connection_failed');},30000);
   const c=Daily.createCallObject({audioSource:stream.getAudioTracks()[0],videoSource:stream.getVideoTracks()[0]||false});call.current=c;
   const pendingMessages:any[]=[];
   const update=(p:DailyParticipant)=>{
    if(epoch!==generation.current)return;
    if(p.local){const track=p.tracks.video.track;if(local.current&&track)local.current.srcObject=new MediaStream([track]);return;}
    if(remoteId.current&&remoteId.current!==p.session_id)return;
    remoteId.current=p.session_id;
    for(const e of pendingMessages.splice(0))handleMessage(e);
    const video=p.tracks.video.track,audio=p.tracks.audio.track;if(!video||!audio)return;
    if(remote.current){const current=remote.current.srcObject as MediaStream|null;if(current?.getVideoTracks()[0]!==video||current?.getAudioTracks()[0]!==audio)remote.current.srcObject=new MediaStream([video,audio]);if(!clearing.current){remote.current.muted=false;void remote.current.play().then(()=>{clearTimeout(connectTimeout.current);setState('connected');if(!connectionChime.current){connectionChime.current=true;callSounds.play('connected');}}).catch(()=>void end('avatar_playback_blocked'));}}
   };
   c.on('participant-joined',e=>{if(e)update(e.participant);});c.on('participant-updated',e=>{if(e)update(e.participant);});
   c.on('participant-left',e=>{if(e?.participant.session_id===remoteId.current)void end('avatar_participant_left');});
   c.on('error',()=>void end('avatar_transport_error'));c.on('left-meeting',()=>{if(!finishing.current)void end('avatar_room_left');});
   c.on('network-connection',e=>{if(e?.event==='interrupted'){setNetworkRecovering(true);clearTimeout(recoveryTimer.current);recoveryTimer.current=setTimeout(()=>void end('avatar_network_interrupted'),8000);}else if(e?.event==='connected'){clearTimeout(recoveryTimer.current);setNetworkRecovering(false);}});
   function handleMessage(e:any){
    if(!remoteId.current){if(pendingMessages.length<100)pendingMessages.push(e);return;}
    if(e?.fromId!==remoteId.current||epoch!==generation.current)return;
    const data=e.data;if(data.conversation_id&&data.conversation_id!==dataSessionId)return;
    activity.event(data);
    if(liveText.current.update(data,transcript.current.turns))setLiveRevision(v=>v+1);
    if(data.properties?.role==='user'){if(data.event_type==='conversation.started_speaking')setProviderHearing(true);if(data.event_type==='conversation.utterance.streaming')setProviderHearing(data.properties.final!==true);if(data.event_type==='conversation.stopped_speaking'||data.event_type==='conversation.utterance')setProviderHearing(false);}
    if(data.properties?.role==='user'&&['conversation.started_speaking','conversation.stopped_speaking','conversation.utterance','conversation.utterance.streaming'].includes(data.event_type))idle.current?.touch();
    if(['pal','replica'].includes(data.properties?.role)){
     if(data.event_type==='conversation.started_speaking'&&!clearing.current){setSpeaking(true);if(remote.current){remote.current.muted=false;void remote.current.play().catch(()=>void end('avatar_playback_blocked'));}}
     if(data.event_type==='conversation.stopped_speaking'){clearing.current=false;setSpeaking(false);}
    }
    if(data.event_type==='conversation.utterance'&&['pal','replica'].includes(data.properties?.role)){clearTimeout(replyTimeout.current);setAwaitingReply(false);}
    if(trainingToken){if(data.event_type==='conversation.utterance')onTrainingUpdate?.();}else{transcript.current.handle(data);persist();}
    if(!trainingToken&&data.event_type==='conversation.utterance'&&['pal','replica'].includes(data.properties?.role)&&handle.current){
     void api('/api/ai-audit/avatar-utterance',{handle:handle.current,language,turns:transcript.current.turns,sessionId:recordId.current}).catch(()=>void end('ai_audit_unavailable'));
    }
   }
   c.on('app-message',handleMessage);
   const dataSessionId=data.conversationId;
   await c.join({url:data.url,token:data.meetingToken});
   if(epoch!==generation.current)return;
   idle.current=new AvatarIdleGuard(()=>{setIdleEnded(true);void end();});idle.current.start();for(const p of Object.values(c.participants()))update(p);
  }catch(e){if(epoch!==generation.current)return;await end(e instanceof RequestError?e.code:e instanceof DOMException&&['NotAllowedError','NotFoundError'].includes(e.name)?'microphone_unavailable':'avatar_connection_failed');}
 }
 function toggleMic(){const next=!muted;try{call.current?.setLocalAudio(!next);media.current?.getAudioTracks().forEach(t=>{t.enabled=!next;});setMuted(next);callSounds.play(next?'micOff':'micOn');}catch{setError('microphone_unavailable');}}
 async function toggleCamera(){
  const c=call.current;if(!c||cameraPending.current)return;
  cameraPending.current=true;setCameraBusy(true);setCameraError(false);const epoch=generation.current;
  let acquired:MediaStream|null=null;
  try{
   if(camera){
    c.setLocalVideo(false);media.current?.getVideoTracks().forEach(t=>{t.stop();media.current?.removeTrack(t);});
    if(local.current)local.current.srcObject=null;setCamera(false);
    await c.setInputDevicesAsync({videoSource:false});callSounds.play('cameraOff');
   }else{
    acquired=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640}},audio:false});
    if(epoch!==generation.current){acquired.getTracks().forEach(t=>t.stop());return;}
    const track=acquired.getVideoTracks()[0];
    await c.setInputDevicesAsync({videoSource:track});
    if(epoch!==generation.current){acquired.getTracks().forEach(t=>t.stop());return;}
    media.current?.addTrack(track);c.setLocalVideo(true);
    if(local.current){local.current.srcObject=new MediaStream([track]);void local.current.play().catch(()=>{});}setCamera(true);callSounds.play('cameraOn');
   }
   idle.current?.touch();
  }catch{acquired?.getTracks().forEach(t=>t.stop());if(epoch===generation.current)setCameraError(true);}
  finally{cameraPending.current=false;if(epoch===generation.current)setCameraBusy(false);}
 }

 async function finishAndReview(){
  if(reviewRequested.current||restarting)return;reviewRequested.current=true;setOpeningReview(true);
  try{await end();await stop();if(handle.current)return;await onReview(recordId.current,structuredClone(transcript.current.turns),trainingToken?typed.trim()||undefined:undefined);}
  catch{setError('connection_failed');}
  finally{reviewRequested.current=false;setOpeningReview(false);}
 }
 async function restart(){if(restarting)return;callSounds.play('reconnect');setRestarting(true);await stop();if(handle.current){setRestarting(false);return;}try{await onRestart?.(recordId.current,structuredClone(transcript.current.turns));}finally{setRestarting(false);}}
 function sendTyped(e:React.FormEvent){
  e.preventDefault();const text=typed.trim();if(!text||awaitingReply||state!=='connected'||!call.current||!remoteId.current)return;
  if(text.length>800){setSendError(true);return;}
  setSendError(false);typedMessages.current.add(text);
  try{
   if(speaking)interrupt();
   call.current.sendAppMessage({message_type:'conversation',event_type:'conversation.respond',conversation_id:conversationId.current,properties:{text}},remoteId.current);
   if(!trainingToken){transcript.current.recordTyped(text);persist();}setTyped('');idle.current?.touch();setAwaitingReply(true);activity.pending();
   replyTimeout.current=setTimeout(()=>{setAwaitingReply(false);setSendError(true);},trainingToken?90000:20000);
  }catch{setSendError(true);}
 }
 function interrupt(){activity.listen();liveText.current.interruptAssistant();setLiveRevision(v=>v+1);callSounds.play('interrupt');clearing.current=true;transcript.current.interrupt();if(remote.current){remote.current.muted=true;remote.current.pause();}setSpeaking(false);try{call.current?.sendAppMessage({message_type:'conversation',event_type:'conversation.interrupt'},remoteId.current);}catch{void end('avatar_connection_failed');}}
 const waitingForOpening=!!openingId.current&&(state==='ready'||state==='connecting');
 const displayTurns=waitingForOpening?[]:displayUtterances(turns,liveText.current.entries);
 return <section className={`video-call-panel ${embedded?'embedded-video-call':''} ${showText?'with-transcript':''} ${state==='ended'?'call-ended':''}`} aria-label={ar?'محادثة فيديو':'Video conversation'}>
  <div className="video-call-heading"><h2>{ar?'حوار وجهًا لوجه':'A face-to-face conversation'}</h2><span role="status">{state==='connecting'?(ar?'جارٍ الاتصال…':'Connecting…'):state==='connected'?(speaking?(ar?'الشخصية تتحدث':'Speaking'):['thinking','delayed'].includes(activity.phase)?(ar?'جارٍ تجهيز الرد':'Preparing a reply'):(muted?(ar?'الميكروفون مكتوم':'Microphone muted'):(ar?'جاهزة للحوار':'Ready to listen'))):state==='ended'?(timeEnded?(ar?'انتهى الوقت':'Time ended'):(ar?'انتهت الجلسة':'Session ended')):''}</span></div>

  <div className="video-call-stage"><video ref={remote} autoPlay playsInline/>{state==='connected'&&!networkRecovering&&!speaking&&['settling','thinking','delayed'].includes(activity.phase)&&<div className={`avatar-turn-status ${activity.phase}`} role="status" aria-live="polite"><span className="thought-orbit" aria-hidden="true"><i/><i/><i/><b/></span><span><strong>{activity.phase==='settling'?(ar?'أستمع، خذ وقتك':'Listening—take your time'):activity.phase==='delayed'?(ar?'ما زلت أجهّز الرد':'Still preparing your reply'):(ar?'أفكّر في إجابتك…':'Considering your answer…')}</strong><small>{activity.phase==='settling'?(ar?'يمكنك إكمال فكرتك':'You can finish your thought'):activity.phase==='delayed'?(ar?'الرد يستغرق وقتًا أطول من المعتاد':'This reply is taking longer than usual'):(ar?'أحضّر لك الرد':'Preparing a reply for you')}</small></span></div>}{state==='connecting'&&<div className="avatar-connecting" role="status"><div className="connection-constellation" aria-hidden="true"><span/><span/><span/><Sparkles size={30}/></div><h3>{ar?'نهيّئ مساحة الحوار':'Bringing your conversation together'}</h3><p>{ar?'جارٍ توصيل الصوت والشخصية…':'Connecting voice and avatar…'}</p></div>}<div className="video-call-self"><video ref={local} autoPlay playsInline muted style={{visibility:camera?'visible':'hidden'}}/>{!camera&&<VideoOff className="camera-off-symbol" aria-hidden="true"/>}<span>{camera?(ar?'أنت':'You'):(ar?'الكاميرا متوقفة':'Camera off')}</span>{state==='connected'&&<div className="self-mic-level" title={micLabel}>{meter}</div>}</div>{state==='ready'&&<div className="video-call-placeholder">{ar?'مساحة لحوار طبيعي بالصوت والصورة':'Space for a natural voice and video conversation'}</div>}</div>
  {idleEnded&&<p role="status">{sessionMessages[lang].videoIdleEnded}</p>}
  {timeEnded&&!idleEnded&&<p role="status">{sessionMessages[lang].videoTimeEnded}</p>}
  {error&&<p role="alert">{errorMessage(error,lang)}</p>}
  {cameraError&&<p role="status">{ar?'تعذّر تشغيل الكاميرا. تحقق من الإذن ثم حاول مجددًا؛ المحادثة الصوتية مستمرة.':'Camera unavailable. Check permission and try again; your voice call continues.'}</p>}
  {trainingError&&state==='connected'&&<p className="call-recovery-note" role="status">{ar?'إجابتك محفوظة. نحتاج إعادة المحاولة للتحقق من الخطوة التالية.':'Your answer is saved. The next step needs another verification attempt.'} <button className="text-button" disabled={restarting} onClick={async()=>{await end();await restart();}}>{ar?'استكمال الإجابة':'Resume answer'}</button></p>}
  {networkRecovering&&<p className="call-recovery-note" role="status">{ar?'نعيد الاتصال… كلماتك محفوظة.':'Reconnecting… Your words are saved.'}</p>}
  {saveError&&<p role="alert">{ar?'تعذّر حفظ النص محليًا. انسخه قبل المغادرة.':'Could not save locally. Copy the transcript before leaving.'}</p>}
  {state==='ready'&&!autoStart?<><p className="session-limit-note">{ar?'حتى ٥ دقائق، تشمل وقت الاتصال. تنتهي الجلسة بعد دقيقتين ونصف دون نشاط للحفاظ على الرصيد.':'Up to 5 minutes, including connection time. Ends after 2½ minutes without activity to conserve credits.'}</p><button className="primary" onClick={()=>void start()}>{ar?'ابدأ مكالمة الفيديو':'Start video call'}</button><button className="text-button" onClick={async()=>{await stop();if(!handle.current)onBack();}}>{ar?'رجوع':'Back'}</button></>:state==='ended'?<div className="call-completion"><div className="call-completion-copy"><span className="eyebrow">{ar?'الخطوة التالية':'Your next step'}</span><h3>{ar?'حوّل الحوار إلى فرصة للتطوّر':'Turn your conversation into practice'}</h3><p>{ar?'راجع إجاباتك مع المراجع، ثم اختر نقطة لتجرّبها من جديد.':'Review your answers alongside the references, then choose a point to try again.'}</p></div><div className="call-completion-actions"><button className="primary review-call-action" disabled={openingReview||restarting} onClick={()=>void finishAndReview()}><BookOpen size={19}/>{openingReview?(ar?'نُنهي الاتصال ونفتح المراجعة…':'Closing the call and opening your review…'):(ar?'راجع المحادثة':'Review conversation')}<ArrowRight size={18} className="review-direction"/></button>{onRestart&&<button className="secondary" disabled={restarting||openingReview} onClick={()=>void restart()}><RotateCcw size={16} className={restarting?'recovery-spin':''}/>{restarting?(ar?'جارٍ استكمال الحوار…':'Resuming your conversation…'):(ar?'إعادة الاتصال':'Reconnect')}</button>}<button className="text-button" disabled={openingReview||restarting} onClick={async()=>{await stop();if(!handle.current)onBack();}}>{ar?'رجوع':'Back'}</button></div></div>:<div className="video-call-controls"><button className="secondary" onClick={toggleMic} disabled={state!=='connected'} aria-pressed={muted}>{muted?<MicOff/>:<Mic/>}{muted?(ar?'تشغيل الميكروفون':'Unmute'):(ar?'كتم الميكروفون':'Mute')}</button><button className="secondary" onClick={()=>void toggleCamera()} disabled={state!=='connected'||cameraBusy} aria-pressed={camera}>{camera?<Video/>:<VideoOff/>}{camera?(ar?'إيقاف الكاميرا':'Camera off'):(ar?'تشغيل الكاميرا':'Camera on')}</button><button className="text-button" onClick={interrupt} disabled={state!=='connected'}>{ar?'إيقاف الرد':'Interrupt'}</button><button className="primary end-review-action" disabled={openingReview} onClick={()=>void (trainingToken&&state==='connected'?finishAndReview():end())}><Square/>{openingReview?(ar?'جارٍ إنهاء الاتصال…':'Closing the call…'):trainingToken&&state==='connected'?(ar?'إنهاء التدريب ومراجعته':'End training & review'):(ar?'إنهاء المكالمة':'End call')}</button><span className="meeting-time" dir="ltr">{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')}</span></div>}
  {state==='connected'&&remaining>0&&remaining<=AVATAR_WARNING_SECONDS&&<p role="status">{sessionMessages[lang].warning}</p>}
  <div className="meeting-secondary-controls">  <button className="text-button" aria-expanded={showText} onClick={()=>setShowText(!showText)}>{showText?<EyeOff/>:<Eye/>}{ar?(showText?'إخفاء النص':'عرض النص'):(showText?'Hide transcript':'Show transcript')}</button>
  {onContinueText&&<button className="text-button disconnect-avatar" disabled={state==='connecting'} onClick={async()=>{await end();if(!handle.current)await onContinueText(recordId.current,structuredClone(transcript.current.turns));}}>{ar?'متابعة بدون شخصية':'Continue without avatar'}</button>}
<button className="text-button sound-toggle" aria-pressed={soundsEnabled} onClick={()=>{const next=!soundsEnabled;callSounds.setEnabled(next);setSoundsEnabled(next);if(next)callSounds.play('micOn');}}>{soundsEnabled?<Volume2 size={17}/>:<VolumeX size={17}/>} {ar?(soundsEnabled?'أصوات الواجهة مفعّلة':'أصوات الواجهة متوقفة'):(soundsEnabled?'Interface sounds on':'Interface sounds off')}</button>
{reviewCapture&&<p className="capture-indicator" role="status">{capture.error?(ar?'تعذّر حفظ بعض التسجيلات للمراجعة؛ يستمر الحوار.':'Some review recordings could not be saved; the conversation continues.'):capture.capturing?(ar?'يُحفظ تسجيلك للمراجعة على هذا الجهاز':'Your review recording is being saved on this device'):(ar?'حفظ التسجيل للمراجعة مفعّل':'Review recording enabled')}</p>}<details className="meeting-details"><summary>{ar?'حول هذه الجلسة':'About this session'}</summary>{onReviewCaptureChange&&<button type="button" className="text-button" aria-pressed={reviewCapture} onClick={()=>onReviewCaptureChange(!reviewCapture)}>{reviewCapture?(ar?'إيقاف حفظ التسجيل للمراجعة':'Turn off review recording'):(ar?'تفعيل حفظ التسجيل للمراجعة':'Turn on review recording')}</button>}  <p className="scope-note">{trainingToken?(ar?'تُرسل الكاميرا عند تفعيلها فقط. تُحفظ كلماتك ومراجعاتك على الخادم لاستئناف التدريب؛ تُحفظ مقاطعك محليًا فقط إذا فعّلت التسجيل للمراجعة.':'Your camera is shared only when enabled. Your words and reviews are saved on the server for resuming training; your clips are saved locally only if review recording is enabled.'):ar?'تستخدم المكالمة الميكروفون؛ لا تُرسل الكاميرا إلا عند تفعيلها. يمكنك إيقافهما أو مقاطعة الرد. نحفظ نص الحوار محليًا، دون تسجيل الفيديو.':'The call uses your microphone; your camera is shared only when enabled. You can turn either off or interrupt. We save the transcript locally, without a video recording.'}</p><p>{ar?'حتى ٥ دقائق. تنتهي المكالمة بعد دقيقتين ونصف دون نشاط حفاظًا على الرصيد.':'Up to 5 minutes. Calls end after 2½ minutes without activity to conserve credits.'}</p></details></div>
  {showText&&<section className="meeting-chat-panel"><header className="meeting-chat-heading"><h3>{ar?'نص الحوار':'Conversation'}</h3><p className="transcript-context-note">{ar?'كلمات الحوار؛ اكتمال سماع ردود الشخصية غير مؤكّد.':'Conversation text; full playback of avatar replies is not verified.'}</p></header><div className="video-call-transcript" ref={transcriptView} onScroll={()=>{const el=transcriptView.current;if(el)followTranscript.current=el.scrollHeight-el.scrollTop-el.clientHeight<60;}} role="log" aria-label={ar?'نص الحوار':'Conversation transcript'}>{!displayTurns.length&&<div className={`meeting-chat-empty ${waitingForOpening?'is-preparing':''}`}><MessageCircle size={24}/><p>{waitingForOpening?(ar?'لحظة، ويبدأ الحوار':'Your conversation is about to begin'):(ar?'مساحة لكلماتك':'A space for your words')}</p><span>{waitingForOpening?(ar?'يظهر السؤال مع اتصال الشخصية.':'The opening question appears when the avatar connects.'):(ar?'يظهر الحوار هنا أثناء الحديث.':'Your conversation appears here as you speak.')}</span></div>}{displayTurns.map(t=><p className={`meeting-message ${t.role} ${t.partial?'is-streaming':''}`} key={t.id} dir="auto"><strong>{t.role==='user'?(ar?'أنت':'You'):(trainingToken?(ar?'شخصية التدريب':'Practice partner'):(ar?'دليل بصيرة':'Basira guide'))}: </strong><ProgressiveText text={t.text} animate={!t.streamed&&!initialIds.current.has(t.id)&&(t.role==='assistant'||(!typedMessages.current.has(t.text)&&!t.id.startsWith('typed-')))} onComplete={()=>initialIds.current.add(t.id)} onProgress={()=>{if(followTranscript.current&&transcriptView.current)transcriptView.current.scrollTop=transcriptView.current.scrollHeight;}}/>{t.partial&&<span className="live-transcript-label">{t.role==='user'?(ar?'جارٍ التفريغ…':'Transcribing…'):(ar?'تتحدث الشخصية…':'Avatar speaking…')}</span>}</p>)}</div>{state==='connected'&&<div className={`learner-voice-bubble ${!muted&&(micLevel>.18||providerHearing)?'has-sound':''}`}><Mic size={15}/>{meter}<span>{micLabel}</span></div>}<form className="meeting-composer" onSubmit={sendTyped}><input value={typed} maxLength={800} disabled={state!=='connected'} onChange={e=>setTyped(e.target.value)} aria-label={ar?'اكتب رسالة':'Type a message'} placeholder={ar?'اكتب رسالة…':'Type a message…'} dir="auto"/><button type="submit" aria-label={ar?'إرسال':'Send'} disabled={state!=='connected'||awaitingReply||!typed.trim()}><ArrowUp size={18}/></button></form>{waitingForContinuation&&state==='connected'&&<p className="meeting-send-note" role="status">{ar?'أنا أستمع، أكمل فكرتك على راحتك.':'I’m listening. Take your time to finish your thought.'}</p>}{awaitingReply&&<p className="meeting-send-note" role="status">{ar?'بانتظار الرد…':'Waiting for a reply…'}</p>}{sendError&&<p role="alert">{ar?'تعذّر تأكيد الرد. يمكنك إعادة المحاولة أو المتابعة بالصوت.':'No reply confirmed. You can try again or continue speaking.'}</p>}<small className="meeting-send-note">{ar?'إرسال النص لا يؤكد أن الشخصية استلمته؛ يظهر ردها عند وصوله.':'Sending does not confirm receipt; replies appear when received.'}</small></section>}
 </section>;
}
