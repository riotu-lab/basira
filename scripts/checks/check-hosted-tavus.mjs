import '../lib/output-dirs.mjs';
// Live hosted smoke check: typed synthetic answer, real model/TTS/avatar. No physical mic claim.
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.argv[2]||'https://basiraapp.vercel.app';
const report={base,date:new Date().toISOString(),checks:[],cleanup:'not_started'};
let browser,page,handle,deadline;
async function stop(){if(!handle)return;try{const r=await fetch(base+'/api/avatar/stop',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:handle}),signal:AbortSignal.timeout(10000)});report.cleanup=r.ok?'confirmed':'unconfirmed';if(r.ok)handle=undefined;}catch{report.cleanup='unconfirmed';}}
try{
 browser=await chromium.launch();page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(20000);
 page.on('response',async r=>{if(r.url().endsWith('/api/avatar/session')){const d=await r.json().catch(()=>({}));if(r.ok()){handle=d.id;report.cleanup='pending';deadline=setTimeout(()=>{report.deadlineReached=true;void stop().finally(()=>browser.close());},50000);}else report.sessionError=d.error;}});
 await page.goto(new URL('/?app=training',base).href);
 const config=await page.evaluate(async()=>await(await fetch('/api/config')).json());
 if(config.avatar?.provider!=='tavus'||!config.avatar.configured)throw Error('avatar_not_configured');
 await page.getByRole('button',{name:'لغة الواجهة'}).click();await page.locator('#session-language').selectOption('en');
 await page.getByRole('button',{name:'Begin practice',exact:true}).click();
 await page.waitForFunction(()=>{const v=document.querySelector('.avatar-video');return v?.videoWidth>0&&v.currentTime>0&&!v.paused;},null,{timeout:35000});
 report.checks.push({liveVideo:await page.locator('.avatar-video').evaluate(v=>({width:v.videoWidth,height:v.videoHeight,frames:v.getVideoPlaybackQuality().totalVideoFrames,audioTracks:v.srcObject.getAudioTracks().length}))});
 // This request must be denied by the shared guard before another Tavus call.
 report.checks.push({concurrentStart:await page.evaluate(async()=>{const r=await fetch('/api/avatar/session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});return {status:r.status,error:(await r.json()).error};})});
 await page.waitForFunction(()=>document.querySelector('.turn.assistant')&&![...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Stop response'),null,{timeout:25000});
 await page.screenshot({path:'artifacts/screenshots/hosted-tavus-live.png',fullPage:true});
 await page.locator('.composer input').fill('Faith encourages me to help others. What does it mean in your daily life?');await page.locator('.composer button').click();
 await page.waitForFunction(()=>document.querySelectorAll('.turn.assistant').length>=2,null,{timeout:20000});
 report.checks.push({realConversation:true});
 await page.locator('.end-button').click();await stop();clearTimeout(deadline);
 await page.locator('.review-loading').waitFor({state:'hidden',timeout:45000});
 report.checks.push({findings:await page.locator('.finding').count(),reviewErrors:await page.locator('.review-error').count(),reviewVisible:await page.locator('.review-transcript').count()});
 await page.screenshot({path:'artifacts/screenshots/hosted-tavus-review.png',fullPage:true});
}catch(e){report.error=report.sessionError||e.name;report.message=e.message?.split('\n')[0].replace(/https?:\/\/\S+/g,'[url]');process.exitCode=1;}
finally{clearTimeout(deadline);await stop();await browser?.close();await stop();await mkdir('artifacts',{recursive:true});await writeFile('artifacts/reports/hosted-tavus-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
