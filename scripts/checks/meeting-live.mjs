import {chromium,devices} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
const base=process.env.BASIRA_TEST_URL||'http://127.0.0.1:3002',lang=process.argv.includes('--en')?'en':'ar',mobile=process.argv.includes('--mobile');
const report={workflow:'legacy_general',language:lang,mobile,realProvider:true,physicalMedia:false,checks:[]};let handle,page,timer;
const browser=await chromium.launch({headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
async function stop(){if(!handle)return;try{const r=await fetch(base+'/api/avatar/stop',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:handle})});if(r.ok){report.cleanup=true;handle=null;}}catch{report.cleanup=false;}}
try{
 const context=await browser.newContext({...mobile?devices['iPhone 13']:{viewport:{width:1440,height:1000}},permissions:['microphone','camera']});page=await context.newPage();
 page.on('response',async r=>{if(r.url().endsWith('/api/avatar/video-session')){const d=await r.json().catch(()=>({}));if(r.ok()){handle=d.id;clearTimeout(timer);timer=setTimeout(()=>{void stop();},55000);}else report.providerError=d.error;}});
 await page.goto(base+'/?app=training&legacy=1&lang='+lang);await page.locator('#session-language').selectOption(lang);
 await page.getByRole('button',{name:lang==='ar'?'ابدأ المناقشة':'Begin practice',exact:true}).click();
 await page.waitForFunction(()=>{const v=document.querySelector('.video-call-stage>video');return v?.videoWidth>0&&v.currentTime>0;},null,{timeout:35000});report.checks.push('real_avatar_video_received');
 await page.getByRole('button',{name:lang==='ar'?'تشغيل الكاميرا':'Camera on',exact:true}).click();await page.waitForFunction(()=>!!document.querySelector('.video-call-self video')?.srcObject?.getVideoTracks().length);report.checks.push('synthetic_camera_attached');
 await page.getByRole('button',{name:lang==='ar'?'إيقاف الكاميرا':'Camera off',exact:true}).click();report.checks.push('camera_disabled');
 await page.getByRole('button',{name:lang==='ar'?'كتم الميكروفون':'Mute',exact:true}).click();
 await page.locator('.meeting-composer input').fill(lang==='ar'?'أريد أن نتحدث عن احترام الاختلاف. اسألني سؤالًا قصيرًا عن الاستماع.':'I want to discuss respecting differences. Ask me a short question about listening.');
 report.stage='typed_response';const count=await page.locator('.meeting-message.assistant').count();await page.locator('.meeting-composer button').click();
 await page.waitForFunction(n=>document.querySelectorAll('.meeting-message.assistant').length>n,count,{timeout:18000});report.reply=await page.locator('.meeting-message.assistant').last().innerText();report.checks.push('typed_message_received_real_reply');
 await page.getByRole('button',{name:lang==='ar'?'إيقاف الرد':'Interrupt',exact:true}).click();report.checks.push('interrupt_sent');
 await page.screenshot({path:`artifacts/screenshots/meeting-live-${lang}-${mobile?'mobile':'desktop'}.png`,fullPage:true});
 await page.getByRole('button',{name:lang==='ar'?'متابعة بدون شخصية':'Continue without avatar',exact:true}).click();await page.locator('.composer input').waitFor({timeout:15000});report.checks.push('continued_in_text');
 report.preservedTurns=await page.locator('.turn').count();
 if(process.argv.includes('--reconnect')){
  await page.getByRole('button',{name:lang==='ar'?'إعادة الاتصال بالشخصية':'Reconnect avatar'}).click();
  await page.waitForFunction(()=>{const v=document.querySelector('.video-call-stage>video');return v?.videoWidth>0&&v.currentTime>0;},null,{timeout:35000});report.checks.push('real_reconnect_video');
  await page.getByRole('button',{name:lang==='ar'?'كتم الميكروفون':'Mute',exact:true}).click();
  await page.waitForTimeout(5000);
  const n=await page.locator('.meeting-message.assistant').count();await page.locator('.meeting-composer input').fill(lang==='ar'?'ما الموضوع الذي طلبت منك مناقشته قبل انقطاع الاتصال؟':'What topic did I ask to discuss before reconnecting?');await page.locator('.meeting-composer button').click();
  await page.waitForFunction(n=>document.querySelectorAll('.meeting-message.assistant').length>n,n,{timeout:18000});
  report.reconnectReply=await page.locator('.meeting-message.assistant').last().innerText();report.checks.push('real_reconnect_reply');
 }

}catch(e){if(page){report.visibleTranscript=await page.locator('.meeting-message').allTextContents().catch(()=>[]);await page.screenshot({path:`artifacts/screenshots/meeting-live-${lang}-failure.png`,fullPage:true}).catch(()=>{});}report.error=e.name;report.stageError=report.providerError||'browser_or_transport_timeout';process.exitCode=1;}
finally{clearTimeout(timer);await stop();await browser.close();await stop();await mkdir('artifacts/reports',{recursive:true});await writeFile(`artifacts/reports/meeting-live-${lang}-${mobile?'mobile':'desktop'}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
