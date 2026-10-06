// Paid acceptance check: real Tavus/custom-LLM transport, scripted typed answer,
// synthetic browser microphone/camera. Each avatar session is stopped at 55 seconds.
import {chromium,devices} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const base=process.env.BASIRA_TEST_URL||'http://127.0.0.1:3005',language=process.argv.includes('--en')?'en':'ar',mobile=process.argv.includes('--mobile');
let token,timer,started=false,browser,page;
const report={language,mobile,realProvider:true,scriptedTypedInput:true,physicalMedia:false,checks:[]};
async function post(path,body){const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(120000)});const d=await r.json();if(!r.ok)throw Error(d.error||`http_${r.status}`);return d;}
async function stop(){if(!token||!started)return;try{await post('/api/training/video-stop',{token});started=false;report.cleanup=true;}catch{report.cleanup=false;}}
try{
 const config=await (await fetch(base+'/api/config')).json();if(!config.training?.avatarConfigured)throw Error('training_avatar_not_configured');
 browser=await chromium.launch({headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 const context=await browser.newContext({...mobile?devices['iPhone 13']:{viewport:{width:1440,height:1000}},permissions:['microphone','camera']});page=await context.newPage();
 page.on('response',async response=>{if(response.url().endsWith('/api/training/session')&&response.ok())token=(await response.json()).token;if(response.url().endsWith('/api/training/video-session')){const data=await response.json().catch(()=>({}));if(response.ok()){started=true;timer=setTimeout(()=>void stop(),55000);}else report.providerError=data.error;}});
 await page.goto(base+'/?app=training&lang='+language);if(process.argv.includes('--capture')){await page.locator('.review-recording-consent input').check();await page.getByRole('checkbox',{name:language==='ar'?'ابدأ والكاميرا مفعّلة':'Start with camera on',exact:true}).check();}await page.getByRole('button',{name:language==='ar'?'ابدأ الحوار':'Begin conversation',exact:true}).click();
 if(process.argv.includes('--streaming'))await page.waitForFunction(()=>performance.getEntriesByType('resource').some(e=>e.name.includes('@daily-co_daily-js.js')),null,{timeout:15000});
 if(process.argv.includes('--streaming'))await page.evaluate(async()=>{
  const url=performance.getEntriesByType('resource').map(e=>e.name).find(url=>url.includes('@daily-co_daily-js.js'));
  if(!url)throw Error('daily_module_not_found');const sdk=await import(url);
  window.__basiraStreaming={user:0,assistant:0,partial:0};
  for(let i=0;i<100;i++){const call=sdk.default.getCallInstance();if(call){call.on('app-message',event=>{const d=event.data;if(d?.event_type!=='conversation.utterance.streaming')return;const p=d.properties;if(p.role==='user')window.__basiraStreaming.user++;else if(p.role==='pal')window.__basiraStreaming.assistant++;if(p.final===false)window.__basiraStreaming.partial++;});return;}await new Promise(r=>setTimeout(r,150));}
  throw Error('daily_observer_unavailable');
 });
 await page.waitForFunction(()=>{const v=document.querySelector('.video-call-stage>video');return v?.videoWidth>0&&v.currentTime>0;},null,{timeout:35000});report.checks.push('real_source_guided_avatar_video');
 await page.getByRole('button',{name:language==='ar'?'كتم الميكروفون':'Mute',exact:true}).click();
 const before=await post('/api/training/session/read',{token}),original=before.records.find(r=>r.id===before.currentId),answer=original.question.answer[language].slice(0,750);
 await page.locator('.meeting-composer input').fill(answer);await page.locator('.meeting-composer button').click();
 let state;const until=Date.now()+25000;
 do{state=await post('/api/training/session/read',{token});if(state.error)throw Error(state.error);if(state.records.some(r=>r.turns?.some(t=>t.role==='user'&&t.text===answer))&&state.lastEvent)break;await new Promise(r=>setTimeout(r,500));}while(Date.now()<until);
 if(!state.lastEvent)throw Error('custom_gateway_response_timeout');report.checks.push('tavus_answer_reached_source_engine');report.questionId=original.question.id;
 await stop();clearTimeout(timer);if(!report.cleanup)throw Error('avatar_stop_unconfirmed');
 if(process.argv.includes('--capture')){await page.waitForFunction(()=>new Promise(resolve=>{const r=indexedDB.open('basira-call-review-v1',1);r.onsuccess=()=>{if(!r.result.objectStoreNames.contains('clips')){r.result.close();resolve(false);return;}const q=r.result.transaction('clips').objectStore('clips').getAll();q.onsuccess=()=>{r.result.close();resolve(q.result.some(c=>c.blob?.size>100&&c.frames?.length>0));};};r.onerror=()=>resolve(false);}),null,{timeout:15000});report.checks.push('opt_in_local_video_audio_capture_and_frames');}

 const reviewed=(await post('/api/training/session/action',{token,id:randomUUID(),action:'finish'})).session;
 const record=reviewed.records.find(r=>r.id===original.id);if(!record.attempts.length)throw Error('missing_reference_review');report.checks.push('reference_review');
 await post('/api/training/session/action',{token,id:randomUUID(),action:'retry',recordId:record.id,focusPointId:record.question.points[0].id});
 await post('/api/training/session/action',{token,id:randomUUID(),action:'answer',text:original.question.answer[language],inputKind:'typed'});
 const final=(await post('/api/training/session/action',{token,id:randomUUID(),action:'finish'})).session;const retried=final.records.find(r=>r.id===record.id);
 if(retried.attempts.length!==2||retried.attempts[0].id!==record.attempts[0].id)throw Error('original_attempt_changed');report.checks.push('targeted_text_retry_same_reference');
 report.originalVerdict=retried.attempts[0].assessment.verdict;report.retryVerdict=retried.attempts[1].assessment.verdict;
}catch(e){report.error=e.message;process.exitCode=1;}
finally{clearTimeout(timer);await stop();if(page&&process.argv.includes('--streaming'))report.streamingEvents=await page.evaluate(()=>window.__basiraStreaming).catch(()=>null);await browser?.close();await stop();if(token&&!started)await post('/api/training/session/delete',{token}).catch(()=>{report.recordDeletion=false;process.exitCode=1;});await mkdir('artifacts/reports',{recursive:true});await writeFile(`artifacts/reports/training-avatar-${language}-${mobile?'mobile':'desktop'}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
