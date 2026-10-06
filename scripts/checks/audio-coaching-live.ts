// Real audio model requests with synthetic TTS fixtures, NOT human quality validation.
import 'dotenv/config';
import {mkdir,writeFile} from 'node:fs/promises';
import {ModelProvider} from '../../server/model';
import {createApp} from '../../server/app';
import {pcmWav} from '../../server/audioAssessment';
const model=new ModelProvider(process.env),checks:unknown[]=[];
const hosted=process.env.AUDIO_CHECK_URL;
const server=process.env.AUDIO_CHECK_HTTP==='1'?createApp().app.listen(0,'127.0.0.1'):undefined;
if(server)await new Promise<void>(resolve=>server.listening?resolve():server.once('listening',()=>resolve()));
async function assess(language:'ar'|'en',audio:Buffer){
 if(!server&&!hosted)return model.assessSpeech(language,audio,'audio/wav',AbortSignal.timeout(70000));
 const address=server?.address();if(!hosted&&(!address||typeof address==='string'))throw Error('server_not_ready');
 const base=hosted||`http://127.0.0.1:${(address as {port:number}).port}`;
 const response=await fetch(`${base}/api/training/speech-review?language=${language}`,{method:'POST',headers:{'Content-Type':'audio/wav','X-Basira-Session':'audio-coaching-live-check'},body:new Uint8Array(audio),signal:AbortSignal.timeout(70000)});const result=await response.json();if(!response.ok)throw Error(result.error||'http_check_failed');return result as Awaited<ReturnType<ModelProvider['assessSpeech']>>;
}
try{for(const language of ['ar','en'] as const){
 const pcm24=await model.speech(language,language==='ar'?'أريد أن أفهم سؤالك أولًا. ثم أوضح الفكرة بكلمات بسيطة، وأترك لك فرصة للتعليق.':'I want to understand your question first. Then I can explain the idea clearly and give you a chance to respond.',AbortSignal.timeout(60000));
 // Resample synthetic PCM for the 16 kHz WAV fixture.
 const pcm16=Buffer.alloc(Math.floor(pcm24.length/2*2/3)*2);for(let i=0;i<pcm16.length/2;i++)pcm16.writeInt16LE(pcm24.readInt16LE(Math.floor(i*1.5)*2),i*2);
 const start=Date.now();const result=await assess(language,pcmWav(pcm16));
 checks.push({language,syntheticSpeech:true,liveAudioModel:true,elapsedMs:Date.now()-start,result});
 }
 const silent=await assess('en',pcmWav(Buffer.alloc(32000*4)));
 checks.push({fixture:'silence',allAbstained:silent.findings.every(f=>f.status==='insufficient_evidence'),result:silent});
 if(silent.findings.some(f=>f.status!=='insufficient_evidence'))throw Error('silence_abstention_failed');
}catch(e){checks.push({error:e instanceof Error&&/^[a-z_]+$/.test(e.message)?e.message:'verification_failed'});process.exitCode=1;}
if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));
await mkdir('artifacts/reports',{recursive:true});await writeFile(`artifacts/reports/audio-coaching-${hosted?'hosted-':server?'http-':''}live.json`,JSON.stringify(checks,null,2));console.log(JSON.stringify(checks.map((c:any)=>({language:c.language,fixture:c.fixture,liveAudioModel:c.liveAudioModel,elapsedMs:c.elapsedMs,allAbstained:c.allAbstained,error:c.error}))));
