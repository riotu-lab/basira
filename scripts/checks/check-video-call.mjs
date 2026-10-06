import '../lib/output-dirs.mjs';
import {chromium} from '@playwright/test';
import {writeFile,readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync} from 'node:child_process';
import 'dotenv/config';
const base=process.env.BASIRA_TEST_URL||'http://127.0.0.1:3002';
const report={date:new Date().toISOString(),kind:'Live Tavus full pipeline with synthetic camera and microphone in Chromium',checks:[],cleanup:'not_started'};
const dir=await mkdtemp(join(tmpdir(),'basira-video-test-'));let browser,page,id,watchdog;
async function cleanup(){if(!id)return;const r=await fetch(`https://tavusapi.com/v2/conversations/${encodeURIComponent(id)}/end`,{method:'POST',headers:{'x-api-key':process.env.TAVUS_API_KEY},signal:AbortSignal.timeout(10000)});report.cleanup=r.ok?'confirmed':'unconfirmed';}
try{
 const speech=await fetch(base+'/api/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language:'ar',text:'ماذا ترى أمام الكاميرا؟ ما لون الصورة؟'})});if(!speech.ok)throw Error('fixture_speech_failed');
 await writeFile(join(dir,'voice.pcm'),Buffer.from(await speech.arrayBuffer()));
 execFileSync('ffmpeg',['-v','error','-f','s16le','-ar','24000','-ac','1','-i',join(dir,'voice.pcm'),'-af','adelay=8000,apad=pad_dur=6','-ar','48000',join(dir,'voice.wav')]);
 execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=red:s=640x360:r=10','-t','1','-pix_fmt','yuv420p',join(dir,'camera.y4m')]);
 browser=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',`--use-file-for-fake-video-capture=${join(dir,'camera.y4m')}`,`--use-file-for-fake-audio-capture=${join(dir,'voice.wav')}`]});
 page=await browser.newPage({viewport:{width:1400,height:1000}});page.setDefaultTimeout(25000);
 page.on('response',async r=>{if(r.url().endsWith('/api/avatar/video-session')&&r.ok()){const d=await r.json();id=d.conversationId;report.cleanup='pending';watchdog=setTimeout(()=>{report.deadlineReached=true;void cleanup().finally(()=>browser.close());},50000);}});
 page.on('pageerror',e=>{(report.pageErrors??=[]).push(e.message.split('\n')[0]);});
 await page.goto(base+'/?app=training');
 await page.getByRole('button',{name:'مكالمة فيديو بالكاميرا',exact:true}).click();
 await page.getByRole('button',{name:'ابدأ مكالمة الفيديو',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.video-call-stage>video')?.videoWidth>0,undefined,{timeout:35000});
 report.checks.push({remoteVideo:true,localVideo:await page.locator('.video-call-self video').evaluate(v=>v.videoWidth>0)});
 await page.screenshot({path:'artifacts/screenshots/video-call-ar-live.png',fullPage:true});
 await page.waitForFunction(()=>document.querySelectorAll('.video-call-transcript p').length>=2,undefined,{timeout:30000});
 report.transcript=await page.locator('.video-call-transcript').innerText();
 await page.getByRole('button',{name:'كتم الميكروفون',exact:true}).click();await page.getByRole('button',{name:'إيقاف الكاميرا',exact:true}).click();
 report.checks.push({muted:await page.getByRole('button',{name:'تشغيل الميكروفون',exact:true}).getAttribute('aria-pressed'),cameraOff:await page.getByRole('button',{name:'تشغيل الكاميرا',exact:true}).getAttribute('aria-pressed')});
 await page.getByRole('button',{name:'إنهاء المكالمة',exact:true}).click();await page.getByText('انتهت الجلسة',{exact:true}).waitFor();
 await cleanup();clearTimeout(watchdog);
 await page.getByRole('button',{name:'راجع المحادثة',exact:true}).click();await page.locator('.review-loading').waitFor({state:'hidden',timeout:45000});
 report.checks.push({reviewError:await page.locator('.review-error').count(),savedRecords:await page.evaluate(()=>Object.keys(localStorage).length)});
}catch(e){if(page&&!page.isClosed())report.transcript=await page.locator('.video-call-transcript').innerText().catch(()=>'');report.error=e.message.split('\n')[0].replace(/https?:\/\/\S+/g,'[url]');process.exitCode=1;}
finally{clearTimeout(watchdog);await cleanup().catch(()=>{report.cleanup='unconfirmed';});if(page&&!page.isClosed()){report.visibleErrors=await page.locator('[role="alert"]').allTextContents().catch(()=>[]);await page.screenshot({path:'artifacts/screenshots/video-call-ar-final.png',fullPage:true}).catch(()=>{});}await browser?.close();await rm(dir,{recursive:true,force:true});await writeFile('artifacts/reports/video-call-live.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
