// Real providers, synthetic media. Does not establish human recording accuracy.
import 'dotenv/config';
import {chromium} from '@playwright/test';
import {ModelProvider} from '../../server/model';
import {createApp} from '../../server/app';
import {mkdtemp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const run=promisify(execFile),app=createApp(),server=app.app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
const browser=await chromium.launch(),dir=await mkdtemp(join(tmpdir(),'basira-release-media-')),results:any[]=[];
async function post(path:string,body:any,mime='application/json'){const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':mime},body:mime==='application/json'?JSON.stringify(body):body,signal:AbortSignal.timeout(160000)}),v=await r.json();if(!r.ok)throw Error(v.error||`http_${r.status}`);return v;}
try{
 const text='يمسح ظاهر الخف في الوضوء.';const page=await browser.newPage({viewport:{width:800,height:400}});await page.setContent(`<html lang="ar" dir="rtl"><body style="background:white;padding:60px;font:36px sans-serif">${text}</body></html>`);const image=await page.screenshot();await writeFile(join(dir,'frame.png'),image);
 const pcm=await new ModelProvider(process.env).speech('ar',text,AbortSignal.timeout(45000));await writeFile(join(dir,'speech.pcm'),pcm);await run('ffmpeg',['-v','error','-f','s16le','-ar','24000','-ac','1','-i',join(dir,'speech.pcm'),'-y',join(dir,'speech.wav')]);
 await run('ffmpeg',['-v','error','-loop','1','-i',join(dir,'frame.png'),'-i',join(dir,'speech.wav'),'-c:v','libx264','-tune','stillimage','-pix_fmt','yuv420p','-c:a','aac','-shortest','-y',join(dir,'video.mp4')]);
 for(const kind of ['image','audio','video']){
  let units:any[];
  if(kind==='image')units=(await post('/api/content/image',image,'image/png')).units;
  else{const blob=await readFile(join(dir,kind==='audio'?'speech.wav':'video.mp4'));units=(await post('/api/content/media/audio?language=ar',blob,kind==='audio'?'audio/wav':'video/mp4')).units;if(kind==='video'){const frames=await post('/api/content/media/frames?language=ar',blob,'video/mp4');units.push(...frames.frames.filter((f:any)=>f.text.trim()).map((f:any)=>({id:f.id,kind:'frame',frameId:f.id,text:f.text,originalText:f.text,start:f.at,end:Math.min(f.at+15,frames.duration),confirmed:false})));}}
  if(!units.length)throw Error('empty_extraction');
  const structure=await post('/api/content/structure',{language:'ar',units});if(!structure.items.length)throw Error('empty_structure');
  const assessments=[];for(let itemIndex=0;itemIndex<structure.items.length;itemIndex++)assessments.push((await post('/api/content/assess-item',{language:'ar',units,structure,itemIndex})).assessment);
  if(assessments.some(a=>a.uncertain!==true))throw Error('unconfirmed_media_not_flagged');
  results.push({kind,syntheticInput:true,realExtraction:true,realJudge:true,units,assessments});console.log(JSON.stringify({kind,units:units.length,assessed:assessments.length}));
 }
}catch(e){results.push({error:(e as Error).message});process.exitCode=1;console.log(JSON.stringify({error:(e as Error).message}));}
finally{await browser.close();await new Promise<void>(r=>server.close(()=>r()));await app.dispose();await rm(dir,{recursive:true,force:true});await mkdir('artifacts/reports',{recursive:true});await writeFile('artifacts/reports/content-media-assessment-live.json',JSON.stringify(results,null,2));}
