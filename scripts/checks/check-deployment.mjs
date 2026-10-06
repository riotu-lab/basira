import '../lib/output-dirs.mjs';
// Real HTTP smoke check. Synthetic input; no browser or microphone assertions.
import {writeFile,mkdir} from 'node:fs/promises';
const base=process.argv[2];if(!base?.startsWith('https://'))throw Error('Supply deployment HTTPS URL');
const report={url:base,date:new Date().toISOString(),browserVerified:false,checks:[]};
async function call(path,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(60000)});const json=await r.json();if(!r.ok)throw Error(`${path}: HTTP ${r.status} ${json.error||'request failed'}`);return json;}
try{
 const page=await fetch(base);if(!page.ok||!(await page.text()).includes('id="root"'))throw Error('Application HTML unavailable');report.checks.push({html:true});
 report.checks.push({health:await call('/api/health')});report.checks.push({config:await call('/api/config')});
 for(const language of ['ar','en']){const response=await call('/api/conversation',{language,turns:[]});if(!response.text)throw Error('Empty conversation');report.checks.push({conversation:language,text:response.text,latencyMs:response.latencyMs});}
 const review=await call('/api/content/review',{language:'en',units:[{id:'text-1',kind:'text',text:'Quran 112:1 says: «قل هو الله واحد».',confirmed:true}]});
 if(!review.findings.some(f=>f.category==='textual_mismatch'&&f.reference?.id==='quran-112-1'))throw Error('Expected source-backed finding missing');report.checks.push({review});

 const speech=await fetch(base+'/api/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language:'en',text:'Welcome to Basira. We practise respectful conversation.'}),signal:AbortSignal.timeout(60000)});
 if(!speech.ok)throw Error('Speech synthesis HTTP '+speech.status);
 const pcm=Buffer.from(await speech.arrayBuffer()),wav=Buffer.alloc(44+pcm.length);
 wav.write('RIFF');wav.writeUInt32LE(36+pcm.length,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(24000,24);wav.writeUInt32LE(48000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(pcm.length,40);pcm.copy(wav,44);
 const media=await fetch(base+'/api/content/media/audio?language=en',{method:'POST',headers:{'Content-Type':'audio/wav'},body:wav,signal:AbortSignal.timeout(120000)});const transcription=await media.json();
 if(!media.ok)throw Error('Hosted media: '+(transcription.error||media.status));report.checks.push({speechBytes:pcm.length,hostedMedia:transcription});
}catch(e){report.error=e.message;process.exitCode=1;console.log('Deployment check failed:',e.message);}
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/reports/vercel-check.json',JSON.stringify(report,null,2));console.log('Deployment checks:',report.checks.length,report.error?'FAILED':'PASSED');
