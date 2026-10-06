import '../lib/output-dirs.mjs';
// Real provider/API checks with synthetic publication fixtures. No avatar session.
import 'dotenv/config';
import {writeFile,mkdtemp,readFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {ModelProvider} from '../../server/model';
const run=promisify(execFile),model=new ModelProvider(process.env),base=process.env.BASIRA_TEST_URL||'http://127.0.0.1:3000';
const evidence:any={date:new Date().toISOString(),kind:'Real HTTP/provider calls; synthetic text and generated audio/video fixtures',browserVerified:false,checks:[]};
async function post(path:string,body:unknown,mime='application/json'){
 const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':mime},body:mime==='application/json'?JSON.stringify(body):body as any,signal:AbortSignal.timeout(180000)});
 const value=await r.json();if(!r.ok)throw Object.assign(Error(value.error||'http_error'),{code:value.error,status:r.status});return value;
}
const folder=await mkdtemp(join(tmpdir(),'basira-content-fixture-'));
try{
 if(process.argv.includes('--recheck-video')){
  const prior=JSON.parse(await readFile('artifacts/reports/content-media-live-check.json','utf8'));
  const audio=prior.checks.find((c:any)=>c.stage==='corrected_audio_review').units;
  const frames=prior.checks.find((c:any)=>c.stage==='video_ocr').frames;
  const units=[...audio,...frames.map((f:any)=>({id:f.id,kind:'frame',frameId:f.id,text:f.text,start:f.at,end:f.at+15,confirmed:false}))];
  const result=await post('/api/content/review',{language:'ar',units});
  if(!result.findings.some((f:any)=>f.unitId==='frame-0'&&f.reference?.id==='quran-112-1'&&f.uncertain&&f.category==='textual_mismatch'))throw Error('Expected frame/reference mismatch was not recovered');
  evidence.checks.push({stage:'recheck_real_ocr_with_updated_resolver',inputOrigin:'Previously captured real OCR and corrected transcript',result});
 }else{
 if(!process.argv.includes('--media-only'))for(const [language,text] of [
  ['en','Quran 112:1 says: “قل هو الله واحد”. The Prophet said: “Cleanliness guarantees wealth.” Every disagreement is religiously forbidden.'],
  ['ar','قال تعالى: «قل هو الله أحد» [112:1]. ونسب الكاتب إلى النبي قول: «النظافة تضمن الغنى».'],
  ['en','The quotation “قل هو الله أحد” is from Quran 16:125.']
 ]){
  try{const result=await post('/api/content/review',{language,units:[{id:'text-1',kind:'text',text,confirmed:true}]});evidence.checks.push({stage:'text',language,input:text,result});console.log('Text review:',language,result.findings.map((f:any)=>f.category).join(', '));}catch(e){evidence.checks.push({stage:'text',language,error:(e as Error).message});}
 }
 evidence.activeStage='generate_synthetic_audio';console.log('Live stage:',evidence.activeStage);
 const pcm=await model.speech('ar','قال تعالى: قل هو الله أحد. سورة الإخلاص، الآية الأولى.',AbortSignal.timeout(45000));
 const raw=join(folder,'speech.pcm'),wav=join(folder,'speech.wav'),video=join(folder,'fixture.mp4'),textfile=join(folder,'caption.txt');
 await writeFile(raw,pcm);await writeFile(textfile,'112:1  قل هو الله واحد');
 evidence.activeStage='prepare_wav';console.log('Live stage:',evidence.activeStage);
 await run('ffmpeg',['-nostdin','-v','error','-f','s16le','-ar','24000','-ac','1','-i',raw,'-y',wav]);
 evidence.activeStage='transcribe_audio';console.log('Live stage:',evidence.activeStage);
 const transcription=await post('/api/content/media/audio?language=ar',await readFile(wav),'audio/wav');
 evidence.checks.push({stage:'audio_transcription',duration:transcription.duration,units:transcription.units});
 const corrected=transcription.units.map((u:any,i:number)=>i===0?{...u,text:'قال تعالى: «قل هو الله أحد» [112:1].',confirmed:true}:u);
 evidence.activeStage='review_corrected_audio';console.log('Live stage:',evidence.activeStage);
 const audioReview=await post('/api/content/review',{language:'ar',units:corrected});
 evidence.checks.push({stage:'corrected_audio_review',units:corrected,result:audioReview});
 evidence.activeStage='prepare_video';console.log('Live stage:',evidence.activeStage);
 await run('ffmpeg',['-nostdin','-v','error','-f','lavfi','-i','color=c=white:s=960x540:r=15','-i',wav,'-vf',`drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=${textfile}:fontsize=48:fontcolor=black:x=(w-tw)/2:y=(h-th)/2`,'-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest','-y',video],{timeout:30000});
 evidence.activeStage='video_ocr';console.log('Live stage:',evidence.activeStage);
 const frames=await post('/api/content/media/frames?language=ar',await readFile(video),'video/mp4');
 evidence.checks.push({stage:'video_ocr',duration:frames.duration,note:frames.note,frames:frames.frames.map((f:any)=>({id:f.id,at:f.at,text:f.text,imageBytes:f.image.length}))});
 const frameUnits=frames.frames.filter((f:any)=>f.text.trim()).map((f:any)=>({id:f.id,kind:'frame',frameId:f.id,start:f.at,end:Math.min(f.at+15,frames.duration),text:f.text,confirmed:false}));
 evidence.activeStage='review_video';console.log('Live stage:',evidence.activeStage);
 if(frameUnits.length){const result=await post('/api/content/review',{language:'ar',units:[...corrected,...frameUnits]});evidence.checks.push({stage:'video_combined_review',result});}
}
}catch(e){evidence.error={code:(e as any).code||'check_failed',message:(e as Error).message};console.log('Content live check failed:',(e as any).code||'check_failed');}
finally{await rm(folder,{recursive:true,force:true});await mkdir('artifacts',{recursive:true});await writeFile(process.argv.includes('--recheck-video')?'artifacts/reports/content-video-recheck.json':process.argv.includes('--media-only')?'artifacts/reports/content-media-live-check.json':'artifacts/reports/content-live-check.json',JSON.stringify(evidence,null,2),{mode:0o600});console.log('Content checks recorded:',evidence.checks.length);}
