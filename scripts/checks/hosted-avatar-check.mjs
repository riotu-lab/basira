import '../lib/output-dirs.mjs';
// Real hosted browser/provider test. Microphone input is a synthetic WAV fixture.
// No keys, session tokens, or signed media URLs are written to evidence.
import {chromium} from '@playwright/test';
import {writeFile,mkdir,unlink} from 'node:fs/promises';
const base='https://basira-ruby.vercel.app';
const language=process.argv[2]||'ar',ar=language==='ar',voiceOnly=process.argv.includes('--voice');
const result={date:new Date().toISOString(),url:base,language,kind:voiceOnly?'Real Chromium + hosted voice APIs; synthetic microphone audio':'Real Chromium + hosted APIs + LiveAvatar; synthetic microphone audio',checks:[],cleanup:'not_started'};
let browser,page,sessionId,capTimer;const wavPath=`/tmp/basira-microphone-${language}.wav`;
async function post(path,body){const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});const data=await r.json();if(!r.ok)throw Error(data.error||'http_'+r.status);return data;}
async function cleanup(){if(sessionId){const id=sessionId;sessionId=undefined;try{await post('/api/avatar/stop',{id});result.cleanup='confirmed';}catch{sessionId=id;result.cleanup='unconfirmed';}}}
try{
 result.stage='prepare_fixture';
 const r=await fetch(base+'/api/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language,text:ar?'الإيمان يساعدني على مساعدة الناس. لكن من يختلف معي جاهل ولا أريد أن أستمع إليه.':'Faith helps me care for people. But anyone who disagrees with me is ignorant and not worth listening to.'}),signal:AbortSignal.timeout(45000)});
 if(!r.ok)throw Error('fixture_speech_http_'+r.status);
 const pcm=Buffer.from(await r.arrayBuffer()),wav=Buffer.alloc(44+pcm.length);wav.write('RIFF');wav.writeUInt32LE(36+pcm.length,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(24000,24);wav.writeUInt32LE(48000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(pcm.length,40);pcm.copy(wav,44);await writeFile(wavPath,wav,{mode:0o600});
 browser=await chromium.launch({args:['--use-fake-device-for-media-stream',`--use-file-for-fake-audio-capture=${wavPath}`]});
 const context=await browser.newContext({permissions:['microphone'],viewport:{width:1440,height:1000}});page=await context.newPage();page.setDefaultTimeout(25000);
 await page.addInitScript(()=>{window.avatarEvents=[];const Native=window.WebSocket;window.WebSocket=class extends Native{constructor(...args){super(...args);this.addEventListener('message',e=>{try{const d=JSON.parse(e.data);if(d.type)window.avatarEvents.push({type:d.type,state:d.state});}catch{}})}};});
 await page.route('**/api/avatar/session',async route=>{await route.continue({postData:JSON.stringify({maxSessionSeconds:60})});});
 page.on('response',async response=>{if(response.url().endsWith('/api/avatar/session')){try{const body=await response.json();if(response.ok()){sessionId=body.id;result.cleanup='pending';result.checks.push({sessionStarted:true,capSeconds:60});}else result.sessionError=body.error;}catch{}}});
 result.stage='open_page';await page.goto(new URL('/?app=training',base).href);if(!ar)await page.getByRole('button',{name:'لغة الواجهة'}).click();
 await page.locator('#session-language').selectOption(language);
 await page.getByRole('button',{name:voiceOnly?(ar?'صوت':'Voice'):(ar?'صوت وشخصية':'Voice + avatar'),exact:true}).click();
 console.log(language+': starting hosted avatar');
 capTimer=setTimeout(()=>{result.deadlineReached=true;void cleanup().finally(()=>browser?.close());},voiceOnly?100000:50000);
 await page.getByRole('button',{name:ar?'ابدأ المناقشة':'Begin practice',exact:true}).click();
 if(!voiceOnly){result.stage='receive_video';await page.waitForFunction(()=>{const v=document.querySelector('video');return v?.videoWidth>0&&!v.paused&&v.currentTime>0;},{},{timeout:30000});
 result.checks.push({video:await page.locator('video').evaluate(v=>({width:v.videoWidth,height:v.videoHeight,playing:!v.paused,hasAudio:v.srcObject?.getAudioTracks().length>0}))});
 result.stage='first_speech';await page.waitForFunction(()=>window.avatarEvents.some(e=>e.type==='agent.speak_ended'),{},{timeout:22000});result.checks.push({firstSpeechCompleted:true});}else{await page.waitForFunction(()=>document.querySelector('.turn.assistant')&&!document.querySelector('.typing')&&![...document.querySelectorAll('button')].some(b=>['Stop response','إيقاف الرد'].includes(b.textContent)),{},{timeout:45000});result.checks.push({voicePlaybackCompleted:true});}
 await page.screenshot({path:`artifacts/screenshots/hosted-${language}-${voiceOnly?'voice':'avatar'}.png`,fullPage:true});
 result.stage='microphone';await page.getByRole('button',{name:ar?'اضغط للتحدث':'Tap to speak',exact:true}).click();
 await page.waitForTimeout(Math.min(8000,pcm.length/48+500));
 await page.locator('.mic-button.enabled').click();
 await page.waitForFunction(()=>document.querySelectorAll('.turn.user').length>0,{},{timeout:12000});
 result.checks.push({microphoneTranscription:await page.locator('.turn.user p').last().innerText()});
 if(!voiceOnly){result.stage='second_speech';await page.waitForFunction(()=>window.avatarEvents.filter(e=>e.type==='agent.speak_started').length>=2,{},{timeout:18000});
 result.stage='interrupt';await page.getByRole('button',{name:ar?'إيقاف الرد':'Stop response',exact:true}).click();
 await page.waitForFunction(()=>window.avatarEvents.filter(e=>e.type==='agent.audio_buffer_cleared').length>=2,{},{timeout:6000});
 result.checks.push({interruptionAcknowledged:true,localPlaybackStopped:await page.locator('video').evaluate(v=>v.paused&&v.muted)});}else{await page.waitForFunction(()=>document.querySelectorAll('.turn.assistant').length>=2&&!document.querySelector('.typing')&&![...document.querySelectorAll('button')].some(b=>['Stop response','إيقاف الرد'].includes(b.textContent)),{},{timeout:45000});result.checks.push({spokenReplyCompleted:true});}
 result.stage='review';await page.getByRole('button',{name:ar?'إنهاء ومراجعة':'Finish & reflect',exact:false}).click();
 await cleanup();clearTimeout(capTimer);
 await page.waitForFunction(()=>!document.querySelector('.review-loading'),{},{timeout:45000});
 result.checks.push({reviewVisible:await page.locator('.review-layout').count()>0,findings:await page.locator('.finding').count(),reviewError:await page.locator('.review-error').count()>0});
 await page.screenshot({path:`artifacts/screenshots/hosted-${language}-${voiceOnly?'voice':'avatar'}-review.png`,fullPage:true});
}catch(e){result.error=result.sessionError||e.name+(e.message?.includes('Timeout')?': timeout':'');console.log(language+': test incomplete ('+result.error+')');if(page&&!page.isClosed())await page.screenshot({path:`artifacts/screenshots/hosted-${language}-${voiceOnly?'voice':'avatar'}-incomplete.png`,fullPage:true}).catch(()=>{});process.exitCode=1;}
finally{clearTimeout(capTimer);await cleanup();await browser?.close();await cleanup();await unlink(wavPath).catch(()=>{});await mkdir('artifacts',{recursive:true});await writeFile(`artifacts/reports/hosted-${voiceOnly?'voice':'avatar'}-${language}.json`,JSON.stringify(result,null,2));console.log(language+': checks='+result.checks.length+', cleanup='+result.cleanup);}
