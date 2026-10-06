// Real browser uploads and provider responses. Synthetic inputs; never a human accuracy certification.
import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import ffmpeg from 'ffmpeg-static';
const base=process.env.BASIRA_TEST_URL||'https://basiraapp.vercel.app',dir='artifacts/acceptance-media',results=[];
await mkdir(dir,{recursive:true});await mkdir('artifacts/screenshots',{recursive:true});await mkdir('artifacts/reports',{recursive:true});
const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:1360,height:1000}}),page=await context.newPage();page.setDefaultTimeout(25000);
const output='artifacts/reports/content-upload-'+(new URL(base).hostname==='basiraapp.vercel.app'?'hosted':'local')+'-live.json';
const text='قال الله تعالى في سورة الإخلاص، الآية الأولى: «قل هو الله واحد».',run=promisify(execFile);
try{
 if(process.env.BASIRA_REUSE_SAMPLES!=='1'){await writeFile(dir+'/quotation.txt',text);
 await page.setContent(`<html lang="ar" dir="rtl"><body style="margin:0;padding:65px;background:#f7f8f0;color:#224d3d;font:36px sans-serif;line-height:2"><h1 style="font-size:24px">عينة اختبار — اقتباس يحتاج مراجعة</h1><p>${text}</p></body></html>`);await page.screenshot({path:dir+'/quotation.png'});
 const audio=await fetch(base+'/api/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language:'ar',text}),signal:AbortSignal.timeout(60000)});if(!audio.ok)throw Error('sample_speech_'+audio.status);await writeFile(dir+'/speech.pcm',Buffer.from(await audio.arrayBuffer()));
 await run(ffmpeg,['-v','error','-f','s16le','-ar','24000','-ac','1','-i',dir+'/speech.pcm','-y',dir+'/quotation.wav']);
 await run(ffmpeg,['-v','error','-loop','1','-i',dir+'/quotation.png','-i',dir+'/quotation.wav','-c:v','libx264','-tune','stillimage','-r','10','-pix_fmt','yuv420p','-c:a','aac','-shortest','-y',dir+'/quotation.mp4']);
 }
 for(const [kind,label,ext] of [['text','نص','txt'],['image','صورة','png'],['audio','صوت','wav'],['video','فيديو','mp4']]){
  if(process.env.BASIRA_TEST_KINDS&&!process.env.BASIRA_TEST_KINDS.split(',').includes(kind))continue;
  const result={kind,realProviders:true,syntheticInput:true,errors:[],pipeline:[]};let title='Upload acceptance '+kind+' '+Date.now();
  const listener=async r=>{if(/\/api\/content\/(structure|assess-item|review|summary)$/.test(new URL(r.url()).pathname))result.pipeline.push({stage:new URL(r.url()).pathname.split('/').pop(),status:r.status()});if(r.url().includes('/api/')&&r.status()>=400)result.errors.push({route:new URL(r.url()).pathname,status:r.status(),error:(await r.json().catch(()=>({}))).error});};page.on('response',listener);const progress=setInterval(()=>{void page.locator('[role=alert]').allTextContents().then(alerts=>console.log(JSON.stringify({kind,pending:true,alerts}))).catch(()=>{});},20000);
  try{
   console.log(JSON.stringify({stage:'upload',kind}));await page.goto(base+'/?app=content&lang=ar');await page.locator('#content-language').selectOption('ar');await page.getByRole('button',{name:label,exact:true}).click();await page.locator('#report-title').fill(title);
   await page.locator('input[type=file]').setInputFiles(dir+'/quotation.'+ext);result.uploadedThroughUI=true;
   if(kind==='image'){await page.locator('.extracted-text-disclosure > summary').click();const editor=page.locator('.transcript-segment textarea').first();await expect(editor).toBeEnabled({timeout:90000});const extracted=await editor.inputValue();await editor.fill(extracted+'\n');result.extractedTextEditable=(await editor.inputValue())===extracted+'\n';}
   await page.getByRole('button',{name:'راجع المحتوى',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('.content-final-report')||document.querySelector('[role=alert]'),null,{timeout:180000});if(await page.locator('[role=alert]').count())throw Error(await page.locator('[role=alert]').first().innerText());await expect(page.locator('.assessment-loading')).toHaveCount(0,{timeout:240000});
   result.assessments=await page.locator('.assessment-item').count();result.visualReview=await page.locator('.visual-editorial').count();result.body=await page.locator('.content-final-report').innerText();title=await page.locator('.content-report-header h1').innerText();result.savedTitle=title;
   if(!result.assessments)throw Error('no_assessments');
   result.canonicalCorrectionVisible=result.body.includes('أحد')||result.body.includes('أَحَد');
   if(result.pipeline.some(p=>p.stage==='review'))throw Error('removed_quotation_stage_called');
   if(!result.pipeline.some(p=>p.stage==='summary'&&p.status===200))throw Error('final_summary_not_completed');
   if(!result.body.includes('خلاصة المراجعة'))throw Error('final_summary_not_visible');
   const edit=page.getByRole('button',{name:'تعديل المراجعة',exact:true}).first();await edit.click();await page.locator('.assessment-item').first().getByLabel('ملاحظة المراجع',{exact:true}).fill('ملاحظة اختبار بشري: التحقق من الاقتباس الأصلي.');
   const download=page.waitForEvent('download');await page.getByRole('button',{name:'تصدير تقرير مقروء',exact:true}).click();await(await download).saveAs(dir+'/'+kind+'-report.txt');result.export=true;if(kind==='audio'||kind==='video'){await page.locator('.assessment-original summary').first().click();const media=page.locator('.assessment-original '+(kind==='audio'?'audio':'video'));await expect(media).toHaveCount(1);await media.evaluate(async el=>{el.muted=true;await el.play();el.pause();el.currentTime=1;});result.mediaPlayable=true;await expect.poll(()=>media.evaluate(el=>el.currentTime)).toBeGreaterThanOrEqual(1);result.seekable=true;}
   await expect(page.getByText('محفوظ على هذا الجهاز',{exact:true})).toBeVisible();await page.screenshot({path:`artifacts/screenshots/upload-live-${kind}-ar.png`,fullPage:true,animations:'disabled',timeout:10000}).catch(e=>{result.screenshotError=e.name;});
   await page.reload();await page.locator('.report-library summary').click();await page.locator('.saved-report').filter({hasText:title}).getByRole('button',{name:'فتح',exact:true}).click();await expect(page.locator('.assessment-item').first().getByLabel('ملاحظة المراجع',{exact:true})).toHaveValue('ملاحظة اختبار بشري: التحقق من الاقتباس الأصلي.');result.reopened=true;
   await page.getByRole('button',{name:'حذف التقرير',exact:true}).click();await expect(page.locator('.content-final-report')).toHaveCount(0);result.deleted=true;
  }catch(e){result.failure=e.message;process.exitCode=1;await page.screenshot({path:`artifacts/screenshots/upload-live-${kind}-failure.png`,fullPage:true,animations:'disabled',timeout:10000}).catch(()=>{});const del=page.getByRole('button',{name:'حذف التقرير',exact:true});if(await del.count())await del.click().catch(()=>{});}
  finally{clearInterval(progress);page.off('response',listener);results.push(result);await writeFile(output,JSON.stringify({base,results},null,2));console.log(JSON.stringify({...result,body:undefined}));}
 }
}catch(e){results.push({failure:e.message});console.log(JSON.stringify({failure:e.message}));process.exitCode=1;}
finally{await browser.close();await writeFile(output,JSON.stringify({base,results},null,2));}
