import '../lib/output-dirs.mjs';
import {chromium} from '@playwright/test';import {writeFile,mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync} from 'node:child_process';
const base=process.env.BASIRA_TEST_URL||'http://127.0.0.1:3002';const dir=await mkdtemp(join(tmpdir(),'basira-media-ui-'));const report={date:new Date().toISOString(),kind:'Real Chromium upload, transcription, OCR and review with synthetic publication fixture',checks:[]};let browser;
try{
 const r=await fetch(base+'/api/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language:'ar',text:'قال تعالى: قل هو الله أحد. سورة الإخلاص، الآية الأولى.'})});if(!r.ok)throw Error('fixture_generation_failed');
 await writeFile(join(dir,'voice.pcm'),Buffer.from(await r.arrayBuffer()));await writeFile(join(dir,'caption.txt'),'112:1  قل هو الله واحد');
 execFileSync('ffmpeg',['-v','error','-f','s16le','-ar','24000','-ac','1','-i',join(dir,'voice.pcm'),join(dir,'voice.wav')]);
 execFileSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=white:s=960x540:r=10','-i',join(dir,'voice.wav'),'-vf',`drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=${join(dir,'caption.txt')}:fontsize=48:fontcolor=black:x=(w-tw)/2:y=(h-th)/2`,'-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',join(dir,'review.mp4')]);
 browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1400,height:1000}});page.setDefaultTimeout(90000);
 await page.goto(base+'/?app=content');await page.getByRole('button',{name:'فيديو',exact:true}).click();await page.locator('input[type=file]').setInputFiles(join(dir,'review.mp4'));
 await page.getByRole('button',{name:'تفريغ الصوت وقراءة الفيديو',exact:true}).click();await page.getByRole('button',{name:'تحليل النص المصحّح',exact:true}).waitFor();
 await page.waitForFunction(()=>document.querySelectorAll('.transcript-segment').length>=2&&!document.querySelector('.processing-state'),undefined,{timeout:150000});
 const audio=page.locator('.transcript-segment').filter({has:page.locator('textarea[aria-label*="audio-"]')}).first();
 await audio.locator('textarea').fill('قال تعالى: «قل هو الله أحد» [112:1].');await audio.locator('input[type=checkbox]').check();
 await page.getByRole('button',{name:'تحليل النص المصحّح',exact:true}).click();await page.locator('.content-finding').first().waitFor();
 report.checks.push({segments:await page.locator('.transcript-segment').count(),findings:await page.locator('.content-finding').count(),frames:await page.locator('.review-frame').count(),illustrative:await page.locator('.sample-report-notice').count()});
 await page.getByRole('button',{name:'قبول الملاحظة',exact:true}).first().click();await page.screenshot({path:'artifacts/screenshots/media-review-ar-desktop.png',fullPage:true});
 await page.getByText('محفوظ على هذا الجهاز',{exact:true}).waitFor();await page.reload();await page.getByText(/التقارير المحفوظة/).click();await page.getByRole('button',{name:'فتح',exact:true}).first().click();
 await page.locator('.content-finding').first().waitFor();
 report.checks.push({reopened:await page.locator('.content-finding').count(),decisionPersisted:await page.getByText('قبلها المراجع',{exact:true}).count(),originalPlayback:await page.locator('video').count()});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/screenshots/media-review-ar-mobile.png',fullPage:true});
 report.checks.push({horizontalOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
}catch(e){report.error=e.message.split('\n')[0];process.exitCode=1;}
finally{await browser?.close();await rm(dir,{recursive:true,force:true});await writeFile('artifacts/reports/media-review-browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
