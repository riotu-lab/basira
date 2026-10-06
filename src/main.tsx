import {DataPrivacyNotice} from './DataPrivacyNotice';
import {TrainingMeeting} from './TrainingMeeting';
import {sessionMessages,AVATAR_WARNING_SECONDS} from './sessionMessages';
import '@fontsource/tajawal/400.css';
import '@fontsource/tajawal/500.css';
import '@fontsource/tajawal/700.css';
import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ArrowUp,ArrowUpRight,AudioLines,BookOpen,Check,ChevronLeft,ChevronRight,Eye,EyeOff,Globe2,Headphones,MessageCircle,Mic,MicOff,MoveUpRight,RotateCcw,ShieldCheck,Sparkles,Square,Clock3,WifiOff} from 'lucide-react';
import '@fontsource-variable/noto-sans-arabic';
import '@fontsource-variable/dm-sans';
import {copy,type Lang,type Turn} from './content';
import {useJourney} from './useJourney';
import {ReviewPanel} from './ReviewPanel';
import {ContentReview} from './ContentReview';
import {experienceCopy,errorMessage} from './experienceCopy';
import './styles.css';
import './motion.css';
import './studio.css';
import {useTranscriptScroll} from './useTranscriptScroll';
import {useSwitchMotion} from './useSwitchMotion';
const VideoCall=React.lazy(()=>import('./VideoCall').then(module=>({default:module.VideoCall})));
import {Landing} from './Landing';
import {PortraitGuide} from './PortraitGuide';

const ReferencePractice=React.lazy(()=>import('./ReferencePractice').then(m=>({default:m.ReferencePractice})));
function Mark({small=false}:{small?:boolean}){return <svg className={small?'mark small':'mark'} viewBox="0 0 80 80" fill="none" aria-hidden="true"><path d="M40 9C29 24 18 30 8 40c10 10 21 16 32 31 11-15 22-21 32-31C62 30 51 24 40 9Z" stroke="currentColor" strokeWidth="2"/><path d="M40 18v44M18 40h44M24 24l32 32M56 24 24 56" stroke="currentColor" strokeWidth="1.2"/><circle cx="40" cy="40" r="16" stroke="currentColor" strokeWidth="1.5"/><circle cx="40" cy="40" r="5" fill="currentColor"/></svg>}
export function App({initialLang='ar',initialWorkflow='training'}:{initialLang?:Lang;initialWorkflow?:'training'|'content'}={}){
  const [lang,setLang]=useState<Lang>(initialLang);
  const [contentPractice,setContentPractice]=useState<{token:string;question:string;language:Lang}|undefined>();
  const [workflow,setWorkflow]=useState<'training'|'content'>(initialWorkflow);
  const t=copy[lang],x=experienceCopy[lang],j=useJourney();
  const {sessionLang,setSessionLang,phase,turns,input,setInput,status,mic,latency,seconds,video,config,configError,loadConfig,begin,submit,finish,retry}=j;
  const [showText,setShowText]=useState(true);
  const [videoCall,setVideoCall]=useState(false);
  const [meetingSeed,setMeetingSeed]=useState<{id?:string;turns:Turn[];key:number}>({turns:[],key:0});
  const [startWithCamera,setStartWithCamera]=useState(false);
  const [referencePractice,setReferencePractice]=useState(false);
  const [guidedActive,setGuidedActive]=useState(false);
  const transcriptScroll=useTranscriptScroll(turns.length,status,showText);
  const mode=j.voice?'voice':'text';
  const switchKey=`${j.engine}:${j.interaction}:${lang}`;
  const modeDetails=useSwitchMotion(switchKey,phase==='setup',true);
  const stagePreview=useSwitchMotion(switchKey,phase==='setup');
  const active=guidedActive||referencePractice||videoCall||phase==='conversation'||phase==='connecting';
  const step=videoCall?1:phase==='review'?2:phase==='setup'?0:1;
  const time=`${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;
  const Arrow=lang==='ar'?ChevronLeft:ChevronRight;
  const supported=j.engine==='demo'?['ar','en']:j.interaction==='text'?config?.languages||[]:config?.voice.languages||[];
  const meetingAvailable=j.engine==='ai'&&j.interaction==='avatar'&&!!config?.videoCall?.configured&&!j.openingQuestion;
  const canStart=meetingAvailable||j.engine==='demo'||(config?.ai.configured&&(j.interaction!=='avatar'||config.avatar.configured)&&(!['voice','portrait'].includes(j.interaction)||config.voice.configured));
  useEffect(()=>{document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';document.title=lang==='ar'?'بصيرة | مساحة للحوار':'Basira | Space for dialogue';},[lang]);
  useEffect(()=>{if(phase==='conversation')setShowText(true);},[phase]);
  return <div className={`app-shell ${workflow==='training'&&!referencePractice&&phase!=='review'?'training-studio':''} ${videoCall?'in-meeting':''} ${phase==='conversation'&&!videoCall?'in-text-session':''}`}>
    <header className="header"><a className="brand" href="/" aria-label="بصيرة Basira"><Mark small/><span className="brand-name"><img className="brand-wordmark" src="/brand/basira-wordmark.svg" alt="بصيرة"/><span>BASIRA</span></span></a><div className="header-center"><span className="tiny-dot"/>{t.tagline}</div><button className="language-button" onClick={()=>setLang(lang==='ar'?'en':'ar')} aria-label={t.uiLanguage}><Globe2 size={17}/><span>{lang==='ar'?'English':'العربية'}</span></button></header>
    <main>
      <nav className="workflow-nav" aria-label={lang==='ar'?'مساحات بصيرة':'Basira workflows'}>
        <button className={workflow==='training'?'selected':''} aria-label={lang==='ar'?'فتح مساحة التدريب':'Open dialogue training'} aria-pressed={workflow==='training'} onClick={()=>{setContentPractice(undefined);setWorkflow('training');}}><MessageCircle size={21}/><span>{lang==='ar'?'ابدأ المناقشة':'Start Training'}</span></button>
        <button className={workflow==='content'?'selected':''} aria-pressed={workflow==='content'} disabled={active} title={active?(lang==='ar'?'أنه الجلسة أولًا':'Finish the current session first'):undefined} onClick={()=>setWorkflow('content')}><BookOpen size={21}/><span>{lang==='ar'?'مراجعة المحتوى':'Review Content'}</span></button>
      </nav>
      {workflow==='content'?<ContentReview lang={lang} onAssessmentPractice={p=>{j.reset();setContentPractice(p);setWorkflow('training');}} onPractice={(finding,report)=>{
        j.reset();j.setSessionLang(report.language);j.setEngine('ai');j.setInteraction('text');
        j.setOpeningQuestion(report.language==='ar'?`كيف تدعو الكاتب إلى مراجعة هذا الاقتباس مع ${(finding.relatedReference||finding.reference)?.title} باحترام ودون إصدار حكم ديني؟ المقطع: «${finding.passage.slice(0,500)}»`:`How would you respectfully invite the author to check this quotation against ${(finding.relatedReference||finding.reference)?.title}, without issuing a religious verdict? Passage: “${finding.passage.slice(0,500)}”`);
        setWorkflow('training');
      }}/>:config?.training&&!j.openingQuestion&&!new URLSearchParams(window.location.search).has('legacy')?<TrainingMeeting practice={contentPractice} lang={lang} config={config} onActive={setGuidedActive}/>:<>
      {!referencePractice&&<><div className="page-intro"><div><div className="eyebrow"><span className="short-line"/>{t.practice}</div><h1>{t.title}</h1><p>{t.subtitle}</p></div><div className="intro-detail"><span>01</span><div>{t.skill}<strong>{t.skillName}</strong></div></div></div>
      <p className="scope-note">{lang==='ar'?'نطاق التدريب: الفهم والحوار باحترام. المصدر المتاح مبدأ عام؛ لا نوثّق به أحكامًا أو ادعاءات دينية أخرى.':'Practice scope: understanding and respectful dialogue. The available source is a general principle; it does not verify other religious claims or rulings.'}</p></>}
      {(j.saved.length>0||j.storageError)&&<details className="saved-sessions"><summary>{lang==='ar'?'الجلسات المحفوظة على هذا الجهاز':'Sessions saved on this device'} ({j.saved.length})</summary>
        <p className="retention-note">{lang==='ar'?'تُحفظ النصوص والمراجعات محليًا في هذا المتصفح، دون الصوت أو مفاتيح الخدمة. يمكن لأي شخص يستخدم ملف المتصفح نفسه الاطلاع عليها. حذف المحاولة الأصلية يحذف إعادات التدريب المرتبطة بها.':'Transcripts and reviews are saved locally in this browser, without recordings or service keys. Anyone using this browser profile can access them. Deleting an original attempt also deletes its saved retries.'}</p>
        {j.storageError&&<p role="alert">{lang==='ar'?'تعذّر حفظ السجلات أو قراءتها. لا تعتمد على استعادتها بعد إعادة التحميل. يمكنك حذف السجلات المحلية لإعادة المحاولة.':'Records could not be saved or read. Reload recovery is not guaranteed. You can delete local records to reset storage.'}</p>}
        <ul>{j.saved.map(record=><li key={record.id}><span>{new Date(record.updatedAt).toLocaleString(lang)} · {record.language==='ar'?'العربية':'English'} · {record.mode==='demo'?x.demo:x.ai}{record.practice?` · ${x.second}`:''}</span><button className="text-button" disabled={active||record.mode==='demo'} onClick={()=>void j.restoreSession(record)}>{lang==='ar'?'فتح':'Open'}</button><button className="text-button" onClick={()=>void j.removeSession(record.id)}>{lang==='ar'?'حذف':'Delete'}</button></li>)}</ul>
        <button className="text-button" onClick={()=>void j.removeAllSessions()}>{lang==='ar'?'حذف جميع الجلسات المحلية':'Delete all local sessions'}</button>
      </details>}
      {!referencePractice&&<nav className="steps" aria-label={t.journey}>{[t.step1,t.step2,t.step3].map((label,i)=><React.Fragment key={label}><div className={`step ${i===step?'current':''} ${i<step?'done':''}`} aria-current={i===step?'step':undefined}><span>{i<step?<Check size={14}/>:String(i+1).padStart(2,'0')}</span>{label}</div>{i<2&&<div className="step-line"/>}</React.Fragment>)}</nav>}
      {referencePractice?<React.Suspense fallback={<p role="status">{x.checking}</p>}><ReferencePractice lang={lang} config={config} onBack={()=>setReferencePractice(false)}/></React.Suspense>:phase==='review'?<ReviewPanel lang={lang} journey={j}/>:<div className="workspace">
        <aside className="sidebar"><div className="scenario"><div className="eyebrow"><BookOpen size={16}/>{t.scenario}</div><span className="scenario-number">01 <span>/ 01</span></span><h2>{t.scenarioTitle}</h2><p>{t.scenarioDesc}</p></div>
          {phase==='setup'?<div className="settings">
            <h3>{t.setting}</h3>{j.openingQuestion&&<div className="practice-question"><span className="eyebrow">{lang==='ar'?'تدرّب على نقطة من المحتوى':'Practice a content-review point'}</span><p dir="auto">{j.openingQuestion}</p></div>}
            <label htmlFor="session-language">{t.sessionLanguage}</label>
            <div className="session-language-field"><Globe2 size={17}/><select id="session-language" value={sessionLang} onChange={e=>setSessionLang(e.target.value as Lang)} disabled={videoCall||!supported.length}>
              {!supported.length?<option value={sessionLang}>{x.checking}</option>:supported.map(l=><option key={l} value={l}>{l==='ar'?'العربية':'English'}</option>)}
            </select></div>
            <div ref={modeDetails} className="mode-details">

            <p className="mode-note">{j.engine==='demo'?t.localNote:meetingAvailable?(lang==='ar'?'حوار مباشر؛ يمكنك مقاطعة الرد والتحدث بصورة طبيعية.':'Live conversation: speak naturally and interrupt when needed.'):j.interaction==='text'?x.aiNote:x.voiceNote}</p>
            {j.engine==='ai'&&j.interaction==='portrait'&&<p className="mode-note">{x.portraitNote}</p>}
            {j.engine==='ai'&&j.interaction==='avatar'&&<><p className="mode-note">{meetingAvailable?(lang==='ar'?'تُرسل الكاميرا والميكروفون للمكالمة بعد موافقتك. يمكنك إيقافهما من نافذة الحوار.':'The call shares camera and microphone after permission. You can turn either off inside the conversation window.'):x.avatarNote}</p>{config?.avatar.provider==='tavus'&&<p className="session-limit-note">{lang==='ar'?'حتى ٥ دقائق للجلسة، تشمل وقت الاتصال. تنتهي بعد دقيقتين ونصف دون نشاط للحفاظ على رصيد الخدمة.':'Up to 5 minutes per session, including connection time. Ends after 2½ minutes without activity to conserve service credits.'}</p>}</>}
            {j.engine==='ai'&&config&&config.ai.configured&&((['voice','portrait'].includes(j.interaction)&&!config.voice.configured)||(j.interaction==='avatar'&&config.voice.transcriptionConfigured===false))&&<div className="setup-warning" role="status"><p>{lang==='ar'?'الإدخال الصوتي غير مهيّأ. يمكنك الكتابة؛ يتطلب وضع الصوت دون شخصية خدمة صوت مهيّأة.':'Microphone input is not configured. You can type; voice without an avatar also needs a configured speech service.'}</p></div>}
            {j.engine==='ai'&&config&&!config.ai.configured&&<div className="setup-warning" role="status"><strong>{x.notConnected}</strong><p>{x.aiMissing}</p></div>}
            {j.engine==='ai'&&j.interaction==='avatar'&&config&&!config.avatar.configured&&<div className="setup-warning" role="status"><strong>{t.unavailable}</strong><p>{t.unavailableDesc}</p></div>}
            {configError&&<div className="setup-warning" role="alert"><p>{x.setupError}</p><button className="text-button" onClick={()=>void loadConfig()}>{t.tryAgain}<RotateCcw size={14}/></button></div>}
            </div>
            <button className="secondary start-button" disabled={videoCall} onClick={()=>setReferencePractice(true)}><BookOpen size={16}/>{lang==='ar'?'تدريب بأسئلة من المراجع':'Practise questions from sources'}</button>
            {meetingAvailable&&<label className="start-camera-option"><input type="checkbox" checked={startWithCamera} disabled={videoCall} onChange={e=>setStartWithCamera(e.target.checked)}/><span>{lang==='ar'?'ابدأ والكاميرا مفعّلة':'Start with camera on'}</span></label>}
            <button className="primary start-button" disabled={videoCall||!canStart} onClick={()=>{if(meetingAvailable){setMeetingSeed(prev=>({turns:[],key:prev.key+1}));setVideoCall(true);}else void begin();}}>{j.engine==='ai'&&!config&&!configError?x.checking:t.start}<Arrow size={18}/></button>
          </div>:<div className="session-info"><div className="eyebrow">{j.practice?t.retryLabel:t.skill}</div><h3>{t.skillName}</h3><p>{j.practice?x.practiceHint:t.tipText}</p><div className="session-language"><Globe2 size={16}/>{sessionLang==='ar'?'العربية':'English'}</div><div className="latency"><span>{x.textMetric}</span><strong>{j.engine==='demo'?t.localMetric:latency===null?t.notMeasured:`${latency} ms`}</strong>{j.voice&&<><span>{x.voiceMetric}</span><strong>{j.voiceLatency===null?t.notMeasured:`${j.voiceLatency} ms`}</strong></>}</div></div>}
          <div className="privacy"><ShieldCheck size={20}/><div><strong>{t.privacy}</strong><p>{t.privacyDesc}</p></div></div>
        </aside>
        <section className={`conversation-space ${active?'active':''}`} aria-label={t.practice}>
          {videoCall?<React.Suspense fallback={<div className="inline-call-loading" role="status">{x.checking}</div>}><VideoCall key={meetingSeed.key} initialTurns={meetingSeed.turns} initialSessionId={meetingSeed.id} onRestart={(id,history)=>setMeetingSeed(prev=>({id,turns:history,key:prev.key+1}))} onContinueText={async(id,videoTurns)=>{await j.continueVideoAsText(id,videoTurns);setVideoCall(false);}} embedded autoStart initialCamera={startWithCamera} lang={lang} language={sessionLang} onBack={()=>setVideoCall(false)} onReview={(id,videoTurns)=>{setVideoCall(false);void j.acceptVideoTranscript(id,videoTurns);}}/></React.Suspense>:<>
          <div ref={stagePreview} className={`stage ${j.interaction==='portrait'&&j.engine==='ai'?'portrait-stage':''}`}>
            {j.interaction==='portrait'&&j.engine==='ai'&&<PortraitGuide lang={lang} state={phase==='conversation'?status:'idle'} level={j.audioLevel} recording={mic}/>}
            <div className="stage-top"><div className="stage-name"><span className="tiny-dot"/>{j.engine==='demo'?x.configuredDemo:j.interaction==='avatar'?t.stageLabel:j.interaction==='portrait'?x.portraitBadge:x.ai}</div><span className="stage-counter">{active?time:'BASIRA / 01'}</span></div>
            <video ref={video} className={`avatar-video ${j.interaction==='avatar'&&j.engine==='ai'&&active?'visible':''}`} autoPlay playsInline aria-label={t.stageLabel}/>
            {!(j.engine==='ai'&&(j.interaction==='portrait'||(j.interaction==='avatar'&&phase==='conversation')))&&<div className="stage-center"><div className={`identity ${status==='thinking'&&phase==='conversation'?'breathing':''}`}><div className="identity-ring ring-one"/><div className="identity-ring ring-two"/><Mark/></div>
            <span className="stage-eyebrow">{phase==='setup'?'بصيرة':j.engine==='demo'?t.local:j.interaction==='avatar'?t.awaiting:x.ai}</span><h2>{phase==='connecting'?t.starting:phase==='conversation'?t.skillName:t.ready}</h2><p>{j.engine==='ai'&&j.interaction==='avatar'?t.noAvatar:phase==='conversation'?(j.practice?x.practiceHint:t.typeHint):t.readyDesc}</p></div>}
            <div className="stage-bottom"><span><Headphones size={15}/>{active?t[status]:j.engine==='demo'?x.demo:x[j.interaction]}</span><span className="sound-bars" aria-hidden="true">{[8,15,10,22,13,18,8].map((h,i)=><i key={i} style={{height:h,animationDelay:`${i*.12}s`}} className={phase==='conversation'&&status==='speaking'?'moving':''}/>)}</span></div>
          </div>
          {phase==='setup'?<div className="prelude"><button className="studio-mode-link" aria-label={j.interaction==='text'?(lang==='ar'?'صوت وشخصية':'Voice + avatar'):(lang==='ar'?'نص':'Text')} onClick={()=>j.setInteraction(j.interaction==='text'?'avatar':'text')}>{j.interaction==='text'?<AudioLines size={18}/>:<MessageCircle size={18}/>} {j.interaction==='text'?(lang==='ar'?'العودة إلى الشخصية':'Use the avatar'):(lang==='ar'?'تفضّل الحوار بالكتابة؟':'Prefer a text conversation?')}</button><div className="tip-symbol"><Sparkles size={21}/></div><div><span>{t.tip}</span><p>{t.tipText}</p></div><MoveUpRight className="prelude-arrow" size={26}/></div>:
          phase==='time-ended'?<div className="session-time-ended"><Clock3 size={28}/><h3>{j.error==='avatar_idle_ended'?sessionMessages[lang].idleTitle:sessionMessages[lang].timeTitle}</h3><p role="status">{j.error==='avatar_idle_ended'?sessionMessages[lang].idleEnded:sessionMessages[lang].timeEnded}</p><p className="mode-note">{lang==='ar'?'إذا كنت تسجّل عند انتهاء الوقت، فلن يُرسل التسجيل غير المكتمل.':'If you were recording when time ended, the unfinished recording was not sent.'}</p><div><button className="primary" onClick={()=>void j.resumeText()}>{lang==='ar'?'المتابعة بالكتابة':'Continue typing'}</button><button className="text-button" onClick={()=>void finish()}>{lang==='ar'?'مراجعة الجلسة':'Review session'}</button></div></div>:
          phase==='error'||phase==='offline'?<div className="connection-error" role="alert"><WifiOff size={28}/><h3>{phase==='offline'?t.offline:t.error}</h3><p>{j.error?errorMessage(j.error,lang):phase==='offline'?x.restoreText:t.errorDesc}</p><div>{j.interaction==='avatar'&&<button className="primary" onClick={()=>void j.reconnectAvatar()}>{x.reconnectAvatar}</button>}<button className="primary" onClick={()=>void j.resumeText()}>{x.resume}</button><button className="text-button" onClick={()=>void finish()}>{t.end}</button></div></div>:
          phase==='connecting'?<div className="connecting"><span className="loading-spinner"/><span role="status">{t.starting}</span><button className="text-button" onClick={()=>void j.cancelStart()}>{x.stopSession}</button></div>:
          <div className="chat">{j.interaction==='avatar'&&j.avatarRemaining!==null&&j.avatarRemaining>0&&j.avatarRemaining<=AVATAR_WARNING_SECONDS&&<p className="session-time-warning" role="status"><Clock3 size={16}/>{sessionMessages[lang].warning}</p>}{j.error&&<div className="review-error" role="alert"><p>{errorMessage(j.error,lang)}</p><button className="text-button" onClick={()=>void j.retryResponse()}>{x.responseRetry}</button></div>}<div className="chat-heading"><h3>{t.transcript}</h3><button className="text-button" onClick={()=>setShowText(!showText)}>{showText?<EyeOff size={15}/>:<Eye size={15}/>} {showText?t.hide:t.show}</button></div>
            {showText&&<div ref={transcriptScroll.transcript} onScroll={transcriptScroll.onScroll} className="transcript" role="log" aria-live="polite" aria-label={t.transcript}>{turns.map(turn=><div key={turn.id} className={`turn ${turn.role}`}><span className="turn-avatar">{turn.role==='user'?<span>{lang==='ar'?'أ':'Y'}</span>:<Mark small/>}</span><div><div className="turn-label">{turn.role==='user'?t.you:t.guide}<time>{new Date(turn.at).toLocaleTimeString(lang,{hour:'2-digit',minute:'2-digit'})}</time></div><p dir={sessionLang==='ar'?'rtl':'ltr'}>{turn.text}</p>{turn.interrupted&&<small className="interrupted">{t.interrupted}</small>}</div></div>)}{status==='thinking'&&<div className="typing" aria-label={t.thinking}><i/><i/><i/></div>}</div>}
            {j.voice&&<><p className="transcript-notice">{x.transcriptNotice}</p><label className="voice-option"><input type="checkbox" checked={j.autoSend} onChange={e=>j.setAutoSend(e.target.checked)}/>{lang==='ar'?'إرسال الصوت تلقائيًا عند إيقاف التسجيل':'Send automatically when recording stops'}</label></>}<form className="composer" onSubmit={submit}><input aria-label={t.placeholder} maxLength={2000} value={input} onChange={e=>setInput(e.target.value)} placeholder={t.placeholder} dir="auto"/><button type="submit" aria-label={t.send} disabled={!input.trim()||status!=='listening'||mic}><ArrowUp size={20}/></button></form>
            <div className="conversation-controls"><div>{config?.videoCall?.configured&&<button className="text-button" disabled={mic||status==='thinking'} onClick={async()=>{const seed=await j.prepareAvatarRestart();setMeetingSeed(prev=>({...seed,key:prev.key+1}));setVideoCall(true);}}>{lang==='ar'?'إعادة الاتصال بالشخصية':'Reconnect avatar'}</button>}{config?.voice.configured&&<button className="text-button" disabled={mic||status==='thinking'} onClick={()=>void (j.voice?j.resumeText():j.enableStandaloneVoice())}>{j.voice?(lang==='ar'?'إيقاف الردود الصوتية':'Turn voice off'):(lang==='ar'?'تفعيل الصوت دون شخصية':'Enable voice without avatar')}</button>}
              {j.voice&&config?.voice.transcriptionConfigured!==false&&<><button className={`mic-button ${mic?'enabled':''}`} aria-label={mic?(j.autoSend?(lang==='ar'?'أوقف التسجيل وأرسل':'Stop recording & send'):x.recordStop):x.record} aria-pressed={mic} onClick={()=>void j.toggleMicrophone()}>{mic?<Mic size={18}/>:<MicOff size={18}/>}</button><span className="control-hint">{mic?(j.autoSend?(lang==='ar'?'أوقف التسجيل وأرسل':'Stop recording & send'):x.recordStop):x.record}</span>{mic&&<button className="text-button" onClick={j.mute}>{x.mute}</button>}</>}

              {(status==='speaking'||status==='thinking')&&<button className="text-button" onClick={()=>void j.interrupt().catch(()=>{})}>{x.cancel}</button>}
            </div><button className="end-button" onClick={()=>void finish()}><Square size={12}/>{j.practice?x.compare:t.end}</button></div>
            {j.voice&&<p className="record-hint">{x.recordHint}</p>}

          </div>}
          </>}
        </section>
      </div>}
      </>}
      <footer><Mark small/><span>{t.footer}</span>{config?.audit?.enabled!==false&&<DataPrivacyNotice lang={lang} retentionDays={config?.audit?.retentionDays??7}/>}<span className="footer-edition">BASIRA · EARLY PREVIEW</span></footer>
    </main>
  </div>
}
const root=document.getElementById('root');
export function Entry(){
 const params=new URLSearchParams(window.location.search);
 return params.has('app')?<App initialLang={params.get('lang')==='en'?'en':'ar'} initialWorkflow={params.get('app')==='content'?'content':'training'}/>:<Landing/>;
}
if(root)createRoot(root).render(<Entry/>);
