import {MEDIA_MAX_MB,IMAGE_MAX_MB,MEDIA_REQUEST_MS} from './mediaLimits';
import {postContentMedia} from './contentUpload';
import {VisualEditorialPanel} from './VisualEditorialPanel';
import type {VisualEditorial} from './visualEditorial';
import {ContentAssessmentPanel} from './ContentAssessmentPanel';
import type {AssessedItem} from './contentAssessment';
import type {ContentRetrieval} from './contentRetrieval';
import type {ContentStructure} from './contentStructure';
import {ContentStructurePanel} from './ContentStructurePanel';
import {ArgumentReviewPanel} from './ArgumentReviewPanel';
import type {ArgumentReport} from './argumentReviewTypes';
import {useEffect,useRef,useState} from 'react';
import {FileText,BookOpen,Download,Check,RotateCcw,ArrowUpRight} from 'lucide-react';
import type {Lang} from './content';
import {api,RequestError} from './api';
import {categoryLabels,reportText,type ContentReport,type ContentFinding,type ReviewUnit,type VideoFrame} from './contentReviewTypes';
import {saveReport,listReports,getReport,deleteReport} from './reportStore';
import {reviewCopy} from './reviewCopy';
import {contentReviewExample} from './contentReviewExample';
import {FileUpload} from './FileUpload';

export function ContentReview({lang,onPractice,onAssessmentPractice}:{lang:Lang;onPractice:(finding:ContentFinding,report:ContentReport)=>void;onAssessmentPractice?:(practice:{token:string;question:string;language:Lang})=>void}){
 const t=reviewCopy[lang];
 const [kind,setKind]=useState<ContentReport['kind']>('text'),[language,setLanguage]=useState<Lang>('ar');
 const [showReport,setShowReport]=useState(true),[progress,setProgress]=useState('');
 const [input,setInput]=useState(''),[title,setTitle]=useState('');
 const [report,setReport]=useState<ContentReport|null>(null),[saved,setSaved]=useState<ContentReport[]>([]);
 const [media,setMedia]=useState<Blob>(),[mediaUrl,setMediaUrl]=useState('');
 const [busy,setBusy]=useState<null|'fileRead'|'audioBusy'|'frameBusy'|'reviewBusy'|'exampleBusy'|'structureBusy'|'imageBusy'|'retrievalBusy'>(null),[error,setError]=useState<string|null>(null);
 const [mediaMB,setMediaMB]=useState(import.meta.env.VITE_VERCEL_DEPLOYMENT?4:MEDIA_MAX_MB);
 useEffect(()=>{if(!import.meta.env.VITE_VERCEL_DEPLOYMENT)return;void fetch('/api/content/upload-policy').then(r=>r.json()).then(p=>{if([4,MEDIA_MAX_MB].includes(p.mediaMB))setMediaMB(p.mediaMB);}).catch(()=>{});},[]);
 const [saveState,setSaveState]=useState<'saved'|'saving'|'failed'>('saved'),[storageError,setStorageError]=useState(false);
 const controller=useRef<AbortController|null>(null),epoch=useRef(0),saveQueue=useRef(Promise.resolve());
 const mounted=useRef(true);
 const deleted=useRef(new Set<string>()),saveRevision=useRef(0);
 const audio=useRef<HTMLAudioElement>(null),video=useRef<HTMLVideoElement>(null);
 useEffect(()=>{mounted.current=true;void listReports().then(rows=>{if(mounted.current)setSaved(rows);}).catch(()=>{if(mounted.current)setStorageError(true);});return()=>{mounted.current=false;epoch.current++;controller.current?.abort();};},[]);
 useEffect(()=>{if(!media){setMediaUrl('');return;}const url=URL.createObjectURL(media);setMediaUrl(url);return()=>URL.revokeObjectURL(url);},[media]);
 useEffect(()=>{
  if(!report||deleted.current.has(report.id))return;
  const revision=++saveRevision.current;
  setSaveState('saving');const current=report;
  saveQueue.current=saveQueue.current.catch(()=>{}).then(async()=>{
   try{if(deleted.current.has(current.id))return;await saveReport(current,media);const all=await listReports();if(!mounted.current)return;setSaved(all);if(revision===saveRevision.current)setSaveState('saved');setStorageError(false);}catch{if(mounted.current)setSaveState('failed');}
  });
 },[report,media]);
 const fail=(e:unknown)=>setError(e instanceof RequestError?e.code:e instanceof Error&&e.name==='AbortError'?'request_cancelled':'connection_failed');
 function cancel(){epoch.current++;controller.current?.abort();controller.current=null;setBusy(null);setError('request_cancelled');}
 function start(stage:NonNullable<typeof busy>){controller.current?.abort();const c=new AbortController();controller.current=c;const id=++epoch.current;setBusy(stage);setError(null);return {id,signal:c.signal};}
 function fresh(k=kind):ContentReport{return {version:1,id:crypto.randomUUID(),title:title.trim()||(lang==='ar'?'مراجعة محتوى':'Content review'),language,kind:k,createdAt:Date.now(),originalText:k==='text'?input:'',units:[],findings:[],frames:[],coverage:reviewCopy[language].scope,analysisStatus:'draft',...(k==='video'?{videoStatus:reviewCopy[language].videoPending}:{})};}
 function selectFiles(files:File[]){
  if(busy||!files.length)return;
  if(files.length!==1){setError('one_file_only');return;}
  const file=files[0];
  const valid=kind==='text'?(/\.txt$/i.test(file.name)||file.type==='text/plain'):
   kind==='image'?(/\.(png|jpe?g|webp)$/i.test(file.name)||['image/png','image/jpeg','image/webp'].includes(file.type)):
   kind==='audio'?(/\.(mp3|m4a|wav|ogg|webm)$/i.test(file.name)||['audio/mpeg','audio/mp3','audio/mp4','audio/x-m4a','audio/wav','audio/x-wav','audio/ogg','audio/webm'].includes(file.type)):
   (/\.(mp4|webm|mov)$/i.test(file.name)||['video/mp4','video/webm','video/quicktime'].includes(file.type));
  if(!valid){setError(kind==='text'?'text_file_required':'unsupported_media');return;}
  if(file.size===0){setError('empty_file');return;}
  if(kind==='text')void textFile(file);else chooseMedia(file);
 }
 async function textFile(file:File){
  const {id}=start('fileRead');try{
   if(file.size>80000)throw new RequestError('content_too_long');
   let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());}catch{throw new RequestError('invalid_utf8');}
   if(text.length>20000)throw new RequestError('content_too_long');if(id!==epoch.current)return;
   setInput(text);setTitle(title.trim()||file.name);setReport(null);setMedia(undefined);
  }catch(e){if(id===epoch.current)fail(e);}finally{if(id===epoch.current)setBusy(null);}
 }
 function chooseMedia(file:File){
  if(kind==='image'&&file.size>IMAGE_MAX_MB*1024*1024){setError('image_size_limit');return;}
  if(kind!=='image'&&file.size>mediaMB*1024*1024){setError('media_size_limit');return;}
  const extension=file.name.split('.').pop()?.toLowerCase()||'';
  const types:Record<string,string>={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',mp3:'audio/mpeg',m4a:'audio/mp4',wav:'audio/wav',ogg:'audio/ogg',webm:kind==='video'?'video/webm':'audio/webm',mp4:'video/mp4',mov:'video/quicktime'};
  const mime=file.type&&file.type!=='application/octet-stream'?file.type:types[extension];
  const upload=file.type===mime?file:new File([file],file.name,{type:mime});
  setMedia(upload);setTitle(title.trim()||file.name);setError(null);
  const next={...fresh(),title:title.trim()||file.name,media:{name:file.name,type:mime,size:file.size,duration:0}};
  setReport(next);if(kind==='image')void extractImage(upload,next);
 }
 async function extractImage(upload=media,current=report){
  if(!upload||!current)return;const {id,signal}=start('imageBusy');
  try{
   const response=await postContentMedia('/api/content/image',upload,AbortSignal.any([signal,AbortSignal.timeout(90000)]));
   const result=await response.json();if(!response.ok)throw new RequestError(result.error);if(id!==epoch.current)return;
   const extracted={...current,units:result.units,assessment:undefined,retrieval:undefined,structure:undefined,findings:[],arguments:undefined,analysisStatus:'draft' as const};
   setReport(extracted);if(!result.units.length)return;
   setBusy('structureBusy');
   const structured=await api<ContentStructure>('/api/content/structure',{language:current.language,units:result.units},signal,120000);
   if(id===epoch.current)setReport({...extracted,assessment:undefined,retrieval:undefined,structure:structured});
  }catch(e){if(id===epoch.current)fail(e);}finally{if(id===epoch.current)setBusy(null);}
 }
 async function requestVisual(current:ContentReport,signal:AbortSignal){
  if(!media)throw new RequestError('invalid_media');
  const query=new URLSearchParams({language:current.language,audience:current.visualContext?.audience||'',purpose:current.visualContext?.purpose||''});
  const response=await postContentMedia(`/api/content/visual/${current.kind}?${query}`,media,AbortSignal.any([signal,AbortSignal.timeout(150000)]));
  const result=await response.json();if(!response.ok)throw new RequestError(result.error);return result as VisualEditorial;
 }
 async function visualOnly(){if(!report||!media||report.example||busy)return;const {id,signal}=start('reviewBusy');setProgress(lang==='ar'?'وصف المشاهد ومراجعة عرضها للجمهور…':'Describing visuals and reviewing their presentation…');setShowReport(true);try{const visualReview=await requestVisual(report,signal);if(id===epoch.current)setReport({...report,visualReview,visualError:false});}catch(e){if(id===epoch.current){setReport(r=>r&&({...r,visualError:true}));fail(e);}}finally{if(id===epoch.current){setBusy(null);setProgress('');}}}
 async function assessAll(){
  if(report?.example||busy)return;
  let current:ContentReport|null=kind==='text'&&!report?{...fresh(),units:[{id:'text-1',kind:'text' as const,text:input,originalText:input,confirmed:true}]}:report;
  if(!current)return;
  const {id,signal}=start('reviewBusy');current={...current,findings:[],quotationCheckIncomplete:false,coverage:reviewCopy[current.language].scope,analysisStatus:'incomplete'};setReport(current);setShowReport(true);
  try{
   if(current.kind==='image'&&media&&!current.units.length){
    setProgress(lang==='ar'?'قراءة النص من الصورة…':'Reading text from your image…');
    const response=await postContentMedia('/api/content/image',media,signal);const data=await response.json();if(!response.ok)throw new RequestError(data.error);
    if(id!==epoch.current)return;current={...current,units:data.units};setReport(current);
   }
   if(['image','video'].includes(current.kind)&&!current.visualReview){
    setProgress(lang==='ar'?'مراجعة الصورة والمشاهد للجمهور…':'Reviewing visual presentation…');
    try{current={...current,visualReview:await requestVisual(current,signal),visualError:false};}catch(e){if(signal.aborted)throw e;current={...current,visualError:true};}
    if(id!==epoch.current)return;setReport(current);
   }
   if((current.kind==='video'||current.kind==='audio')&&media){
    for(const stage of (current.kind==='video'?['audio','frames']:['audio']) as ('audio'|'frames')[]){if(current.extractionStages?.[stage]||current.units.some(u=>u.kind===(stage==='audio'?'audio':'frame'))||(stage==='frames'&&current.frames.length))continue;
     setProgress(lang==='ar'?(stage==='audio'?'استخراج الكلام المسموع…':'قراءة النصوص من إطارات الفيديو…'):(stage==='audio'?'Transcribing the soundtrack…':'Reading text from video frames…'));
     try{const response:Response=await postContentMedia(`/api/content/media/${stage}?language=${current.language}`,media,AbortSignal.any([signal,AbortSignal.timeout(MEDIA_REQUEST_MS)]));const data:any=await response.json();if(!response.ok)throw new RequestError(data.error);
      current=stage==='audio'?{...current,units:[...current.units,...data.units],extractionNote:data.note}:{...current,frames:data.frames,videoStatus:data.note,units:[...current.units,...data.frames.filter((f:VideoFrame)=>f.text.trim()).map((f:VideoFrame)=>({id:f.id,frameId:f.id,kind:'frame' as const,start:f.at,end:Math.min(f.at+15,data.duration),text:f.text,originalText:f.text,confirmed:false}))]};
      current={...current,extractionErrors:{...current.extractionErrors,[stage]:undefined},extractionStages:{...current.extractionStages,[stage]:'complete'},media:current.media?{...current.media,duration:data.duration}:undefined,structure:undefined,assessment:undefined,retrieval:undefined,findings:[],arguments:undefined,analysisStatus:'draft'};
     }catch(e){if(signal.aborted)throw e;
      if(current.kind==='audio')throw e;
      if(stage==='audio'&&e instanceof RequestError&&['no_audio_track','empty_transcription'].includes(e.code))current={...current,extractionErrors:{...current.extractionErrors,audio:undefined},extractionStages:{...current.extractionStages,audio:'absent'},extractionNote:lang==='ar'?'لم يُستخرج كلام من الفيديو؛ نراجع النص المرئي والمشاهد المتاحة.':'No speech was extracted from this video; visible text and sampled visuals are reviewed.'};
      else current={...current,extractionErrors:{...current.extractionErrors,[stage]:e instanceof RequestError?e.code:'media_processing_failed'},extractionNote:(current.extractionNote||'')+' '+(lang==='ar'?'لم يكتمل استخراج أحد مسارات الصوت/النص؛ لا يُعد المحتوى مفحوصًا بالكامل.':'One audio/text extraction path did not complete; content is not fully reviewed.')};
     }
     if(id!==epoch.current)return;setReport(current);
    }
   }
   const units=current.units.filter(u=>u.text.trim());
   if(!units.length){setReport({...current,analysisStatus:'incomplete'});throw new RequestError('no_reviewable_text');}

   setProgress(lang==='ar'?'استخراج المقاطع للاسترجاع':'Extracting passages for reference search');
   if(!current.structure){current={...current,structure:await api<ContentStructure>('/api/content/structure',{language:current.language,units},signal,120000)};if(id!==epoch.current)return;setReport(current);}
   const structure=current.structure!;
   if(!current.assessment){current={...current,assessment:{version:1,at:new Date().toISOString(),items:[],total:structure.items.length,complete:false},analysisStatus:'incomplete'};setReport(current);}
   for(let i=0;i<structure.items.length;i++){
    if(current.assessment!.items.some(a=>a.item.id===structure.items[i].id))continue;
    setProgress(lang==='ar'?`استرجاع الأدلة ومراجعتها · المقطع ${i+1} من ${structure.items.length}`:`Retrieving and checking evidence · passage ${i+1} of ${structure.items.length}`);
    const result:{assessment:AssessedItem;retrieval:ContentRetrieval}=await api<{assessment:AssessedItem;retrieval:ContentRetrieval}>('/api/content/assess-item',{language:current.language,units,structure,itemIndex:i},signal,150000);
    if(id!==epoch.current)return;
    current={...current,assessment:{...current.assessment!,items:[...current.assessment!.items,result.assessment]},retrieval:{...result.retrieval,items:[...(current.retrieval?.items||[]).filter(v=>v.itemId!==result.assessment.item.id),...result.retrieval.items]}};setReport(current);
   }
   if(id!==epoch.current)return;
   setProgress(lang==='ar'?'تنظيم النتائج وإعداد خلاصة المراجعة…':'Organizing findings and preparing your review…');
   const counts:Record<string,number>={supported_in_excerpt:0,inconsistent_with_excerpt:0,insufficient_evidence:0,specialist_review:0,not_stated:0};
   for(const reviewed of current.assessment!.items)for(const part of Object.values(reviewed.parts))counts[part.status]++;
   try{const summary=await api<{overview:string;nextStep:string}>('/api/content/summary',{language:current.language,kind:current.kind,counts},signal,60000);if(id!==epoch.current)return;current={...current,assessment:{...current.assessment!,summary,summaryUnavailable:false}};}
   catch(e){if(signal.aborted)throw e;current={...current,assessment:{...current.assessment!,summaryUnavailable:true}};}
   if(id!==epoch.current)return;
   current={...current,assessment:{...current.assessment!,complete:true},analysisStatus:structure.morePossible||current.kind==='video'||units.some(u=>u.kind!=='text'&&!u.confirmed)?'incomplete':'complete'};setReport(current);
  }catch(e){if(id===epoch.current)fail(e);}finally{if(id===epoch.current){setBusy(null);setProgress('');}}
 }
 function changeUnit(id:string,patch:Partial<ReviewUnit>){setReport(r=>r&&({...r,analysisStatus:'draft',findings:[],assessment:undefined,retrieval:undefined,structure:undefined,arguments:undefined,units:r.units.map(u=>u.id===id?{...u,...patch}:u)}));}
 function decide(id:string,patch:Partial<ContentFinding>){setReport(r=>r&&({...r,findings:r.findings.map(f=>f.id===id?{...f,...patch}:f)}));}
 function seek(at:number){const el=kind==='video'?video.current:audio.current;if(el){el.currentTime=at;void el.play().catch(()=>setError('media_processing_failed'));}}
 async function open(id:string){
  cancel();setError(null);await saveQueue.current;
  try{const entry=await getReport(id);if(!entry)return;setReport(entry.report);setShowReport(true);setKind(entry.report.kind);setLanguage(entry.report.language);setTitle(entry.report.title);setInput(entry.report.originalText);setMedia(entry.media);}catch{setStorageError(true);}
 }
 async function remove(id:string){
  deleted.current.add(id);saveRevision.current++;
  if(report?.id===id){cancel();setReport(null);setMedia(undefined);setInput('');setError(null);}
  try{await saveQueue.current;await deleteReport(id);setSaved(await listReports());}catch{setStorageError(true);}
 }
 async function showExample(){
  if(kind==='text'||kind==='image'||busy)return;
  const {id,signal}=start('exampleBusy');
  try{
   await new Promise<void>((resolve,reject)=>{
    const abort=()=>{clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'));};
    const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},1400);
    signal.addEventListener('abort',abort,{once:true});
   });
   if(id!==epoch.current||signal.aborted)return;
   setMedia(undefined);const sample=contentReviewExample(kind,language);setReport(sample);setTitle(sample.title);setInput('');
  }catch(e){if(id===epoch.current)fail(e);}finally{if(id===epoch.current)setBusy(null);}
 }
 function newContent(next=kind){cancel();setError(null);setReport(null);setMedia(undefined);setInput('');setTitle('');setKind(next);}
 const canExport=!!report&&!busy&&(!!report.example||!!report.assessment?.complete||!!report.assessment?.items.length||!!report.visualReview||!!report.findings.length);
 function download(){if(!report||!canExport)return;const url=URL.createObjectURL(new Blob([reportText(report)],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`basira-review-${report.id}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 const results=report&&report.analysisStatus!=='draft';
 if(showReport&&report&&(report.assessment||report.visualReview||report.visualError||busy==='reviewBusy'||(error&&report.analysisStatus!=='draft')))return <section className="content-final-report" dir={lang==='ar'?'rtl':'ltr'}>
  <header className="content-report-header"><span className="eyebrow">{lang==='ar'?'بصيرة · قبل النشر':'BASIRA · BEFORE PUBLICATION'}</span><h1>{report.title}</h1><p>{saveState==='failed'?t.saveError:saveState==='saving'?t.saving:t.saved}</p><div className="content-report-actions"><button className="secondary" disabled={!!busy} onClick={()=>setShowReport(false)}>{lang==='ar'?'عودة إلى المحتوى':'Back to content'}</button><button className="primary" disabled={!canExport} onClick={download}><Download size={17}/>{t.export}</button><button className="text-button" disabled={!!busy} onClick={()=>void remove(report.id)}>{t.delete}</button>{(!report.assessment||!report.assessment.complete||report.assessment?.summaryUnavailable||Object.values(report.extractionErrors||{}).some(Boolean)||error)&&!busy&&<button className="primary" onClick={()=>void assessAll()}>{lang==='ar'?'استئناف المراجعة':'Resume review'}</button>}</div></header>
  {busy&&<div className="assessment-loading" role="status"><span className="loading-spinner"/><p>{progress}</p><button className="text-button" onClick={cancel}>{t.cancel}</button></div>}
  {error&&<p role="alert" className="review-error">{(t as Record<string,string>)[error]||t.error}</p>}
  {report.assessment?.summary&&!busy&&<section className="review-summary"><h2>{lang==='ar'?'خلاصة المراجعة':'Review overview'}</h2><p>{report.assessment.summary.overview}</p><strong>{lang==='ar'?'خطوتك التالية':'Your next step'}</strong><p>{report.assessment.summary.nextStep}</p></section>}
  {report.assessment?.summaryUnavailable&&!busy&&<p role="status">{lang==='ar'?'الملاحظات محفوظة أدناه؛ لم تكتمل صياغة الخلاصة الآلية.':'Your findings are saved below; the automated overview could not be completed.'}</p>}
  {report.quotationCheckIncomplete&&!busy&&<p className="scope-note">{report.coverage}</p>}
  <details className="assessment-original"><summary>{lang==='ar'?'المحتوى الأصلي والنص المستخدم':'Original content and analyzed text'}</summary>{mediaUrl&&(kind==='image'?<img src={mediaUrl} alt={t.original}/>:kind==='video'?<video ref={video} src={mediaUrl} controls/>:<audio ref={audio} src={mediaUrl} controls/>)}<pre dir="auto">{report.originalText}</pre>{report.units.map(u=><div key={u.id}><p dir="auto">{u.text}</p>{u.kind!=='text'&&<details><summary>{t.transcriptOriginal}</summary><p dir="auto">{u.originalText}</p></details>}{u.kind==='frame'&&report.frames.find(f=>f.id===u.frameId)&&<img src={report.frames.find(f=>f.id===u.frameId)!.image} alt={t.frame}/>}</div>)}</details>
  {Object.values(report.extractionErrors||{}).some(Boolean)&&!busy&&<p role="status">{lang==='ar'?'لم يكتمل استخراج أحد مسارات الملف. الملاحظات المتاحة محفوظة؛ استأنف المراجعة لإعادة محاولة المسار المتعذر.':'One extraction path did not finish. Available findings are saved; resume review to retry the failed path.'}</p>}
  {report.analysisStatus==='incomplete'&&!busy&&<p className="scope-note">{lang==='ar'?'حدود الفحص: قد تكون بعض المقاطع غير مستخرجة أو غير مؤكدة. تحليل الفيديو لا يغطي كل إطار.':'Coverage limits: some passages may be unextracted or unconfirmed. Video analysis does not cover every frame.'}</p>}
  {['image','video'].includes(report.kind)&&<div className="visual-review-actions">{(!report.visualReview||report.visualError)&&<p role="status">{lang==='ar'?'المراجعة البصرية لم تكتمل بعد؛ نتائج النص مستقلة عنها.':'Visual review is not complete; text results are independent.'}</p>}<button className="secondary" disabled={!!busy||!media||report.example} onClick={()=>void visualOnly()}>{report.visualReview?(lang==='ar'?'إعادة المراجعة البصرية':'Re-run visual review'):(lang==='ar'?'مراجعة المشاهد بصريًا':'Review visual presentation')}</button></div>}
  {report.visualReview&&<fieldset disabled={!!busy} className="assessment-fieldset"><VisualEditorialPanel value={report.visualReview} lang={lang} onChange={visualReview=>setReport(r=>r&&({...r,visualReview}))} onSeek={at=>{const el=document.querySelector<HTMLDetailsElement>('.assessment-original');if(el){el.open=true;el.scrollIntoView({behavior:'smooth'});}seek(at);}}/></fieldset>}
  {!report.assessment&&<p className="scope-note">{lang==='ar'?'لم تُنجز مراجعة نصية موثقة لهذا المحتوى. الوصف البصري لا يحل محل التحقق من الأقوال والمراجع.':'No source-backed text assessment has been completed for this content. Visual description does not replace checking claims and references.'}</p>}
  {report.assessment&&<fieldset disabled={!!busy} className="assessment-fieldset"><ContentAssessmentPanel assessment={report.assessment} onAssessmentPractice={p=>onAssessmentPractice?.({...p,language:report.language})} findings={report.findings} units={report.units} lang={lang} onChange={(itemId,patch)=>setReport(r=>r?.assessment?{...r,assessment:{...r.assessment,items:r.assessment.items.map(i=>i.item.id===itemId?{...i,...patch}:i)}}:r)} onFinding={decide} onPractice={f=>onPractice(f,report)} onSeek={unit=>{const el=document.querySelector<HTMLDetailsElement>('.assessment-original');if(el){el.open=true;el.scrollIntoView({behavior:'smooth'});}if(unit.start!==undefined&&kind!=='image')seek(unit.start);}}/></fieldset>}
 </section>;
 return <section className="content-workflow" aria-label={lang==='ar'?'مراجعة المحتوى':'Content review'}>
  <div className="page-intro"><div><div className="eyebrow"><FileText size={16}/>{lang==='ar'?'مراجعة قبل النشر':'PRE-PUBLICATION REVIEW'}</div><h1>{t.title}</h1><p>{t.subtitle}</p></div><span className="review-seal">02 <BookOpen size={25}/></span></div>
  <div className="content-grid">
   <aside className="content-aside"><details className="coverage-details"><summary>{lang==='ar'?'مصادر المراجعة':'Review sources'}</summary><ul className="review-source-list">
     {[
      {url:'https://dorar.net/aqeeda',ar:'العقيدة · الموسوعة العقدية',en:'Creed · Aqeedah encyclopedia'},
      {url:'https://dorar.net/feqhia',ar:'الفقه · الموسوعة الفقهية',en:'Jurisprudence · Fiqh encyclopedia'},
      {url:'https://dorar.net/tafseer',ar:'التفسير · التفسير المحرر',en:'Tafsir · Al-Tafsir al-Muharrar'},
      {url:'https://tanzil.net',ar:'النص القرآني · تنزيل',en:'Quran text · Tanzil'},
     ].map(source=><li key={source.url}><a href={source.url} target="_blank" rel="noreferrer"><span>{source[lang]}</span><ArrowUpRight size={14} aria-hidden="true"/></a></li>)}
    </ul><p>{lang==='ar'?'هذه روابط مجموعات المصادر المعلنة. لم تُوثّق طبعة كل مقطع مستورد أو نسبته بعد؛ يظهر المقتطف ومرجعه المتاح بجانب الملاحظة.':'These links identify the declared source collections. The edition and attribution of every imported passage have not been verified; findings show the excerpt and available reference.'}</p><p className="scope-disclaimer">{t.noApproval}</p></details>
    <details className="report-library"><summary>{t.reports} ({saved.length})</summary>{storageError&&<p role="alert">{t.storageError}</p>}{saved.map(r=><div className="saved-report" key={r.id}><strong dir="auto">{r.title}</strong><small>{new Date(r.createdAt).toLocaleDateString(lang)} · {t[r.kind]}</small><div><button className="text-button" disabled={!!busy} onClick={()=>void open(r.id)}>{t.open}</button><button className="text-button" disabled={!!busy} onClick={()=>void remove(r.id)}>{t.delete}</button></div></div>)}</details>
   </aside>
   <div className="content-main">
    <div className="content-toolbar"><div className="mode-switch">{(['text','image','audio','video'] as const).map(k=><button key={k} className={kind===k?'selected':''} aria-pressed={kind===k} disabled={!!busy} onClick={()=>newContent(k)}>{t[k]}</button>)}</div><button className="text-button" disabled={!!busy} onClick={()=>newContent()}><RotateCcw size={15}/>{t.new}</button></div>
    {!report&&<><label className="field-label" htmlFor="content-language">{lang==='ar'?'لغة المحتوى':'Content language'}</label><select id="content-language" value={language} onChange={e=>setLanguage(e.target.value as Lang)}><option value="ar">العربية</option><option value="en">English</option></select><label className="field-label" htmlFor="report-title">{t.titleLabel}</label><input id="report-title" value={title} onChange={e=>setTitle(e.target.value)} maxLength={120}/></>}
    {!report&&kind==='text'&&<><label className="field-label" htmlFor="publication-text">{t.paste}</label><textarea id="publication-text" className="publication-input" dir="auto" value={input} onChange={e=>setInput(e.target.value)} maxLength={20000} placeholder={lang==='ar'?'الصق النص كما سيظهر للقارئ…':'Paste the text as your audience will see it…'}/><FileUpload label={t.upload} lang={lang} accept=".txt,text/plain" disabled={!!busy} onFiles={selectFiles}/></>}
    {kind!=='text'&&!media&&!report?.example&&<FileUpload label={kind==='image'?t.imageUpload:t.mediaUpload} lang={lang} media accept={kind==='image'?'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp':kind==='audio'?'audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/webm,.m4a,.wav,.mp3,.ogg,.webm':'video/mp4,video/webm,video/quicktime,.mov'} disabled={!!busy} onFiles={selectFiles}/>}
    {(kind==='audio'||kind==='video')&&!report&&<button className="text-button example-report-button" disabled={!!busy} onClick={showExample}><BookOpen size={16}/>{lang==='ar'?'عرض تقرير توضيحي ببيانات تجريبية':'View an illustrative sample report'}</button>}
    {report?.example&&<div className="sample-report-notice" role="status"><strong>{lang==='ar'?'تقرير توضيحي':'Illustrative report'}</strong></div>}
    {kind==='image'&&<p className="retention-note">{t.imageLimits} {lang==='ar'?'تبدأ قراءة الصورة واستخراج الاقتباسات عند رفعها.':'Uploading starts image reading and quotation extraction.'}</p>}{kind!=='image'&&<p className="retention-note">{t.limits.replace('{limit}',String(mediaMB))}</p>}<p className="retention-note">{t.permission}</p>
    {report&&<div className="report-heading"><h2 dir="auto">{report.title}</h2><span role={saveState==='failed'?'alert':'status'}>{saveState==='failed'?t.saveError:saveState==='saving'?t.saving:t.saved}</span></div>}
    {mediaUrl&&(kind==='image'?<div className="image-review-workspace"><figure className="image-review-original"><img className="review-frame" src={mediaUrl} alt={t.original}/><figcaption>{t.original}</figcaption></figure>{report?.structure?<ContentStructurePanel key={report.id} value={report.structure} lang={lang}/>:<div className="image-review-progress" aria-live="polite"><span className="eyebrow">{lang==='ar'?'من الصورة إلى المعنى':'FROM IMAGE TO MEANING'}</span><h2>{busy?(lang==='ar'?'نقرأ كلماتك بعناية':'A closer look at your words'):(lang==='ar'?'صورتك محفوظة هنا':'Your image is preserved here')}</h2><ol><li data-active={busy==='imageBusy'}>{lang==='ar'?'قراءة النص المرئي':'Read the visible text'}</li><li data-active={busy==='structureBusy'}>{lang==='ar'?'استخراج الاقتباسات والادعاءات':'Identify quotations and claims'}</li></ol><p>{lang==='ar'?'سنُظهر ما ورد في الصورة، دون إصدار حكم على صحته.':'We show what the image says, without judging its accuracy.'}</p></div>}</div>:kind==='video'?<video className="review-player" ref={video} src={mediaUrl} controls playsInline/>:<audio className="review-player" ref={audio} src={mediaUrl} controls/>)}
    {report?.kind==='text'&&<details className="original-content"><summary>{t.original}</summary><pre dir="auto">{report.originalText}</pre></details>}
    {report&&kind!=='text'&&<>{!report.example&&report.extractionNote&&<p className="scope-note">{report.extractionNote}</p>}{kind==='video'&&!report.example&&<p className="analysis-warning" role="status">{report.videoStatus||t.videoPending}</p>}
     {report.units.length>0&&<details className="transcript-editor extracted-text-disclosure"><summary>{lang==='ar'?'عرض النص المستخرج وتعديله':'View and edit extracted text'}</summary><h3>{t.transcript}</h3><p className="retention-note">{t.modified}</p>{report.units.map(u=><div className="transcript-segment" key={u.id}><div className="segment-heading"><span>{kind==='image'?t.image:`${u.kind==='frame'?t.frame:t.audio} · ${u.start?.toFixed(1)}s — ${u.end?.toFixed(1)}s`}</span>{kind!=='image'&&<button className="text-button" disabled={!!report?.example} onClick={()=>seek(u.start||0)}>{t.seek}</button>}</div>{kind!=='image'&&u.kind==='frame'&&<img className="review-frame" src={report.frames.find(f=>f.id===u.frameId)?.image} alt={`${t.frame} ${u.start}s`}/>}<textarea aria-label={`${t.transcript} ${u.id}`} dir="auto" value={u.text} disabled={!!busy||report.example} onChange={e=>changeUnit(u.id,{text:e.target.value,confirmed:false})}/><label className="voice-option"><input type="checkbox" checked={u.confirmed} disabled={!!busy||report.example} onChange={e=>changeUnit(u.id,{confirmed:e.target.checked})}/>{u.kind==='frame'?t.confirmFrame:t.confirm}</label><details><summary>{t.transcriptOriginal}</summary><p dir="auto">{u.originalText}</p></details></div>)}</details>}
    </>}
    {busy&&<div className="processing-state" role="status"><span className="loading-spinner"/><span>{progress||t[busy]}</span><button className="text-button" onClick={cancel}>{t.cancel}</button></div>}
    {error&&<p className="review-error" role="alert">{((t as Record<string,string>)[error]||t.error).replace('{limit}',String(mediaMB))}</p>}
    {report&&['image','video'].includes(kind)&&!report.example&&<section className="visual-context"><h3>{lang==='ar'?'قبل المراجعة البصرية':'Before visual review'}</h3><p>{lang==='ar'?'اختياري: ساعدنا على فهم الجمهور والرسالة المقصودة، دون افتراضهما من الصورة.':'Optional: tell us the audience and intended message rather than having us infer them from the image.'}</p><label>{lang==='ar'?'الجمهور المقصود':'Intended audience'}<input maxLength={400} disabled={!!busy} value={report.visualContext?.audience||''} onChange={e=>setReport({...report,visualReview:undefined,visualContext:{audience:e.target.value,purpose:report.visualContext?.purpose||''}})}/></label><label>{lang==='ar'?'الهدف أو التعليق المصاحب':'Purpose or accompanying caption'}<textarea maxLength={600} disabled={!!busy} value={report.visualContext?.purpose||''} onChange={e=>setReport({...report,visualReview:undefined,visualContext:{audience:report.visualContext?.audience||'',purpose:e.target.value}})}/></label></section>}
    <div className="content-actions"><button className="primary" disabled={!!busy||report?.example||(!report?!input.trim()||kind!=='text':!report.units.some(u=>u.text.trim())&&!(['image','video','audio'].includes(kind)&&media))} onClick={()=>void assessAll()}><BookOpen size={17}/>{lang==='ar'?'راجع المحتوى':'Review content'}</button>{(report?.assessment||report?.visualReview)&&<button className="secondary" onClick={()=>setShowReport(true)}>{lang==='ar'?'فتح التقرير':'Open report'}</button>}</div>
    {report?.structure&&(kind!=='image'||!mediaUrl)&&<ContentStructurePanel key={report.id} value={report.structure} lang={lang}/>}

    {results&&<div className="content-results"><div className="review-section-heading"><h2>{t.results}</h2><span>{report.findings.filter(f=>f.category!=='out_of_scope').length}</span></div>{report.analysisStatus==='incomplete'&&<p className="analysis-warning">{t.incomplete}{kind==='video'?` · ${t.partialVideo}`:''}</p>}<p className="scope-note">{report.coverage}</p>{!report.findings.length&&!report.arguments?.items.length&&<p>{t.none}</p>}
     {report.arguments&&<ArgumentReviewPanel report={report.arguments} lang={lang} onChange={(id,patch)=>setReport(r=>r&&r.arguments?{...r,arguments:{...r.arguments,items:r.arguments.items.map(i=>i.id===id?{...i,...patch}:i)}}:r)} onSeek={id=>{const unit=report.units.find(u=>u.id===id);if(unit?.start!==undefined)seek(unit.start);else {const original=document.querySelector<HTMLDetailsElement>('.original-content');if(original){original.open=true;original.scrollIntoView({behavior:'smooth'});}}}}/>}
     {report.findings.filter(f=>f.category==='out_of_scope').length>0&&<details className="review-scope-details"><summary>{lang==='ar'?'تعليقات لم يشملها فحص الاقتباسات':'Commentary not covered by quotation checks'} · {report.findings.filter(f=>f.category==='out_of_scope').length}</summary><p>{lang==='ar'?'هذه ملاحظة عن نطاق الأداة، وليست خطأً في المحتوى أو طلبًا لاتخاذ قرار.':'This describes the tool’s scope, not an error in the content or a request for a decision.'}</p>{report.findings.filter(f=>f.category==='out_of_scope').map(f=><div key={f.id}><blockquote dir="auto">{f.passage}</blockquote><p>{f.explanation}</p></div>)}</details>}
     {report.findings.filter(f=>f.category!=='out_of_scope').map(f=>{const unit=report.units.find(u=>u.id===f.unitId)!;const frame=unit.kind==='frame'?report.frames.find(fr=>fr.id===unit.frameId):report.frames.find(fr=>fr.at>=(unit.start||0)&&fr.at<=(unit.end||0));const spoken=frame?report.units.filter(u=>u.kind==='audio'&&(u.start||0)<=frame.at&&(u.end||0)>=frame.at):[];
      return <article className={`content-finding ${f.category}`} key={f.id}><div className="finding-category">{categoryLabels[f.category][lang]}<span>{t[f.decision]}</span></div><div className="evidence-columns"><div><span className="eyebrow">{t.passage}</span><blockquote dir="auto">{f.passage}</blockquote>{kind!=='image'&&unit.start!==undefined&&<button className="text-button" disabled={!!report?.example} onClick={()=>seek(unit.start!)}>{t.seek} · {unit.start.toFixed(1)}s</button>}{frame&&<><img className="review-frame" src={frame.image} alt={`${t.frame} ${frame.at}s`}/><small>{t.frame} · {frame.at.toFixed(1)}s</small><p className="eyebrow">{t.spoken}</p>{spoken.length?spoken.map(u=><p dir="auto" key={u.id}>{u.text}</p>):<p>{t.noSpoken}</p>}</>}</div><div><span className="eyebrow">{t.reference}</span>{f.reference?<><blockquote className="quran-reference" dir="rtl" lang="ar">{f.reference.excerpt}</blockquote><a href={f.reference.url} target="_blank" rel="noreferrer">{f.reference.title}<ArrowUpRight size={14}/></a>{f.relatedReference&&<><blockquote className="quran-reference" dir="rtl" lang="ar">{f.relatedReference.excerpt}</blockquote><a href={f.relatedReference.url} target="_blank" rel="noreferrer">{f.relatedReference.title}</a></>}</>:<p>{t.noReference}</p>}</div></div><p dir="auto">{f.explanation}</p>{f.uncertain&&<p className="analysis-warning">{t.possible}</p>}{f.correction&&<div className="correction-proposal"><strong>{t.suggestion}</strong><p dir="auto">{f.correction}</p></div>}
       <div className="human-decisions">{(['accepted','rejected','edited'] as const).map((d,i)=><button className={f.decision===d?'selected':''} aria-pressed={f.decision===d} key={d} onClick={()=>decide(f.id,{decision:d})}>{[t.accept,t.reject,t.edit][i]}</button>)}</div>
       {f.decision==='edited'&&<><label className="field-label" htmlFor={`${f.id}-correction`}>{t.correction}</label><textarea id={`${f.id}-correction`} dir="auto" value={f.editedCorrection} onChange={e=>decide(f.id,{editedCorrection:e.target.value})}/></>}
       <label className="field-label" htmlFor={`${f.id}-note`}>{t.note}</label><textarea id={`${f.id}-note`} dir="auto" value={f.reviewerNote} onChange={e=>decide(f.id,{reviewerNote:e.target.value})}/>
       {f.practiceEligible&&!f.uncertain&&['accepted','edited'].includes(f.decision)&&<button className="text-button practice-link" onClick={()=>onPractice(f,report)}><RotateCcw size={15}/>{t.practice}</button>}
      </article>;
     })}
    </div>}
   </div>
  </div>
 </section>;
}
