import {MEDIA_MAX_MB,CONTENT_MAX_SECONDS} from '../src/mediaLimits.js';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ffmpeg=require('ffmpeg-static')||'ffmpeg';
const ffprobe=require('ffprobe-static').path;
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {ApiError} from './validation.js';
import type {ModelProvider} from './model.js';
import type {Lang} from '../src/content.js';
import type {ReviewUnit,VideoFrame} from '../src/contentReviewTypes.js';
const run=promisify(execFile);
export async function processMedia(data:Buffer,mime:string,language:Lang,mode:'audio'|'frames'|'visual',model:ModelProvider,signal:AbortSignal){
 if(!data.length||data.length>MEDIA_MAX_MB*1024*1024)throw new ApiError('media_size_limit',413);
 const formats:Record<string,string>={'audio/mpeg':'mp3','audio/mp3':'mp3','audio/mp4':'m4a','audio/x-m4a':'m4a','audio/wav':'wav','audio/x-wav':'wav','audio/ogg':'ogg','audio/webm':'webm','video/mp4':'mp4','video/webm':'webm','video/quicktime':'mov'};
 const ext=formats[mime.split(';')[0]];if(!ext)throw new ApiError('unsupported_media',415);
 const folder=await mkdtemp(join(tmpdir(),'basira-review-'));
 try{
  const input=join(folder,`input.${ext}`);await writeFile(input,data,{mode:0o600});
  const options={signal,timeout:45000,maxBuffer:2*1024*1024};
  const probe=await run(ffprobe,['-v','error','-protocol_whitelist','file,pipe','-show_entries','format=duration:stream=codec_type','-of','json',input],options);
  const metadata=JSON.parse(probe.stdout);const duration=Number(metadata.format?.duration);
  if(!Number.isFinite(duration)||duration<=0||duration>CONTENT_MAX_SECONDS)throw new ApiError('media_duration_limit',413);
  if(mode==='audio'){
   if(!metadata.streams?.some((s:any)=>s.codec_type==='audio'))throw new ApiError('no_audio_track',422);
   const wav=join(folder,'audio.wav');await run(ffmpeg,['-nostdin','-v','error','-protocol_whitelist','file,pipe','-i',input,'-vn','-ac','1','-ar','16000','-t',String(CONTENT_MAX_SECONDS),'-y',wav],options);
   const units=await model.transcribeContent(language,await readFile(wav),signal);
   if(units.some(u=>(u.end||0)>duration+2))throw new ApiError('invalid_transcription',502);
   return {duration,units:groupTranscript(units),note:language==='ar'?'توقيت المقاطع آلي وتقريبي. صحّح التفريغ وأكّد المقاطع التي استمعت إليها قبل اعتبار الاختلاف مؤكدًا.':'Segment timestamps are machine-generated and approximate. Correct the transcript and confirm the segments you listened to before treating differences as confirmed.'};
  }
  if(!metadata.streams?.some((s:any)=>s.codec_type==='video'))throw new ApiError('no_video_track',422);
  const frames:VideoFrame[]=[];
  // Sampling is explicit: no claim of exhaustive or continuous video analysis.
  const times=mode==='visual'?Array.from({length:Math.min(6,Math.max(3,Math.ceil(duration/10)))},(_,i)=>i):Array.from({length:Math.ceil(duration/15)},(_,i)=>i*15);
  if(mode==='visual')for(let i=0;i<times.length;i++)times[i]=times.length===1?0:Number((Math.max(0,duration-1)*i/(times.length-1)).toFixed(3));
  for(const at of times){
   const path=join(folder,`frame-${frames.length}.jpg`);
   await run(ffmpeg,['-nostdin','-v','error','-protocol_whitelist','file,pipe','-ss',String(at),'-i',input,'-frames:v','1','-vf','scale=960:-2','-q:v','4','-y',path],options);
   const image=(await readFile(path)).toString('base64');frames.push({id:`frame-${frames.length}`,at,image:`data:image/jpeg;base64,${image}`,text:''});
  }
  if(mode==='visual')return {duration,frames,note:language==='ar'?'مراجعة بصرية لعينات موزعة فقط؛ لا تشمل كل الإطارات أو الصوت.':'Visual review of distributed samples only; not every frame or the soundtrack.'};
  const recognized=await model.readFrames(frames,signal);
  return {duration,frames:recognized,note:language==='ar'?'تحليل الفيديو جزئي: إطار كل ١٥ ثانية فقط. قد تفوت نصوص بين الإطارات. الاستخراج البصري قابل للخطأ؛ لا نعتبر الاختصار أو الترجمة خطأ تلقائيًا.':'Video analysis is partial: one frame every 15 seconds. Text between sampled frames may be missed. OCR can be wrong; abbreviations and translations are not automatically errors.'};
 }catch(e){
  if(e instanceof ApiError)throw e;if(signal.aborted)throw new ApiError('request_cancelled',499);
  if((e as NodeJS.ErrnoException).code==='ENOENT'&&String((e as NodeJS.ErrnoException).syscall).startsWith('spawn'))throw new ApiError('media_tools_missing',503);
  throw new ApiError('media_processing_failed',422);
 }finally{await rm(folder,{recursive:true,force:true});}
}

// Keep small ASR fragments together so a quotation and its spoken attribution can
// be reviewed in context. Times remain the provider's first/last segment bounds.
export function groupTranscript(units:ReviewUnit[]):ReviewUnit[]{
 const groups:ReviewUnit[]=[];
 for(const u of units){
  const last=groups.at(-1);
  if(last&&(u.start||0)-(last.end||0)<=3&&(u.end||0)-(last.start||0)<=15&&last.text.length+u.text.length<1200){last.text+=' '+u.text;last.originalText+=' '+u.originalText;last.end=u.end;}
  else groups.push({...u,id:`audio-${groups.length}`});
 }
 return groups;
}
