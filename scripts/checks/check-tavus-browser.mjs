import '../lib/output-dirs.mjs';
// Real local Chromium + Tavus text echo + model. Typed synthetic answers, no microphone claim.
import {chromium} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
const base='http://127.0.0.1:3001',language=process.argv[2]||'en',ar=language==='ar';
const report={date:new Date().toISOString(),language,kind:'Real local browser/model/voice/Tavus; synthetic typed answers; no physical microphone',checks:[],speechEndpointRequests:0,cleanup:'not_started'};
let browser,page,handle,deadline;
async function stop(){if(!handle)return;const id=handle;try{const r=await fetch(base+'/api/avatar/stop',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id}),signal:AbortSignal.timeout(10000)});if(r.ok){handle=undefined;report.cleanup='confirmed';}else report.cleanup='unconfirmed';}catch{report.cleanup='unconfirmed';}}
try{
 browser=await chromium.launch();page=await browser.newPage({viewport:{width:1440,height:1000},recordVideo:{dir:'artifacts/recordings/tavus',size:{width:1280,height:900}}});page.setDefaultTimeout(25000);
 page.on('request',r=>{if(r.url().endsWith('/api/speech'))report.speechEndpointRequests++;});
 page.on('pageerror',e=>{(report.pageErrors??=[]).push(e.name);});
 page.on('response',async r=>{if(r.url().endsWith('/api/avatar/session')){const data=await r.json().catch(()=>({}));if(r.ok()){handle=data.id;report.cleanup='pending';deadline=setTimeout(()=>{report.deadlineReached=true;void stop().finally(()=>browser.close());},50000);}else report.sessionError=data.error;}});
 report.stage='load';await page.goto(new URL('/?app=training',base).href);const config=await page.evaluate(async()=>{const r=await fetch('/api/config');return r.json();});
 if(config.avatar?.provider!=='tavus'||!config.avatar.configured)throw Error('tavus_not_configured');
 // Observe provider events without modifying their handling or content.
 await page.evaluate(async()=>{window.tavusEvents=[];const source=await (await fetch('/src/tavus.ts')).text();const modulePath=source.match(/from ["']([^"']*tavusProtocol[^"']*)["']/)[1];const {TavusProtocol}=await import(modulePath);const original=TavusProtocol.prototype.handle;TavusProtocol.prototype.handle=function(e){window.tavusEvents.push({type:e?.event_type,role:e?.properties?.role,interrupted:e?.properties?.interrupted,hasInference:!!e?.inference_id,matchesConversation:e?.conversation_id===this.conversationId,matchesInference:e?.inference_id===this.active?.id,keys:Object.keys(e||{})});return original.call(this,e);};});
 if(!ar)await page.getByRole('button',{name:'لغة الواجهة'}).click();await page.locator('#session-language').selectOption(language);
 await page.getByRole('button',{name:ar?'صوت وشخصية':'Voice + avatar',exact:true}).click();
 report.stage='start';await page.getByRole('button',{name:ar?'ابدأ المناقشة':'Begin practice',exact:true}).click();
 report.stage='video';await page.waitForFunction(()=>{const v=document.querySelector('video');return v?.videoWidth>0&&v.currentTime>0&&!v.paused;},{},{timeout:35000});
 report.checks.push({video:await page.locator('video').evaluate(v=>({width:v.videoWidth,height:v.videoHeight,frames:v.getVideoPlaybackQuality().totalVideoFrames,audioTracks:v.srcObject.getAudioTracks().length}))});
 report.stage='first_speech';await page.waitForFunction(()=>window.tavusEvents.some(e=>e.type==='conversation.started_speaking'),{},{timeout:22000});await page.screenshot({path:`artifacts/screenshots/tavus-${language}-speaking.png`,fullPage:true});await page.waitForFunction(()=>window.tavusEvents.some(e=>e.type==='conversation.stopped_speaking'&&e.interrupted===false),{},{timeout:22000});
 if(process.argv.includes('--diagnose'))throw Error('diagnostic_complete');
 await page.waitForFunction(()=>document.querySelector('.composer button')&&![...document.querySelectorAll('button')].some(b=>['Stop response','إيقاف الرد'].includes(b.textContent.trim())));
 report.checks.push({firstSpeechCompleted:true});await page.screenshot({path:`artifacts/screenshots/tavus-${language}-live.png`,fullPage:true});
 report.stage='answer';await page.locator('.composer input').fill(ar?'الإيمان يدفعني لمساعدة الناس، لكن من يختلف معي جاهل ولا أريد الاستماع إليه.':'Faith encourages me to help people, but anyone who disagrees is ignorant and not worth listening to.');await page.locator('.composer button').click();
 report.stage='interrupt';await page.waitForFunction(()=>window.tavusEvents.filter(e=>e.type==='conversation.started_speaking'&&e.role==='pal').length>=2,{},{timeout:18000});
 await page.getByRole('button',{name:ar?'إيقاف الرد':'Stop response',exact:true}).click();
 await page.waitForFunction(()=>window.tavusEvents.some(e=>e.type==='conversation.stopped_speaking'&&e.interrupted===true),{},{timeout:6000});
 report.checks.push({interruptionAcknowledged:true,localPlaybackStopped:await page.locator('video').evaluate(v=>v.muted&&v.paused)});
 report.stage='review';await page.locator('.end-button').click();await stop();clearTimeout(deadline);
 await page.locator('.review-loading').waitFor({state:'hidden',timeout:45000});
 report.checks.push({findings:await page.locator('.finding').count(),reviewError:await page.locator('.review-error').count()});
 await page.screenshot({path:`artifacts/screenshots/tavus-${language}-review.png`,fullPage:true});
 if(process.argv.includes('--practice')){
  report.stage='retry';await page.getByRole('button',{name:ar?'تدرّب على الملاحظة المختارة':'Practise the selected finding',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.turn.assistant')&&!document.querySelector('.typing')&&![...document.querySelectorAll('button')].some(b=>['Stop response','إيقاف الرد'].includes(b.textContent.trim())),{},{timeout:45000});
  await page.locator('.composer input').fill(ar?'الإيمان يدعوني لمساعدة الناس. وقد تختلف تجربتك عن تجربتي؛ ما الذي يعنيه الإيمان لك؟':'Faith encourages me to help others. Your experience may differ from mine. What does faith mean to you?');
  await page.locator('.composer button').click();await page.locator('.comparison-result').waitFor({timeout:45000});await stop();clearTimeout(deadline);
  report.checks.push({retryCompared:true,preservedAttempts:await page.locator('.answer-attempt').count()});
  await page.screenshot({path:`artifacts/screenshots/tavus-${language}-comparison.png`,fullPage:true});
 }
 report.stage='complete';
}catch(e){report.error=report.sessionError||e.name;report.errorMessage=e.message?.split('\n')[0]?.replace(/https?:\/\/\S+/g,'[url]');if(page&&!page.isClosed()){report.events=await page.evaluate(()=>window.tavusEvents||[]).catch(()=>[]);report.visibleErrors=await page.locator('[role="alert"]').allTextContents().catch(()=>[]);await page.screenshot({path:`artifacts/screenshots/tavus-${language}-incomplete.png`,fullPage:true}).catch(()=>{});}process.exitCode=1;}
finally{clearTimeout(deadline);await stop();await browser?.close();await stop();await mkdir('artifacts',{recursive:true});await writeFile(`artifacts/reports/tavus-${language}-browser.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
