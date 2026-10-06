// Synthetic speech + real existing TTS/STT services; local deterministic measurement, not a physical microphone test.
import 'dotenv/config';
import {mkdir,writeFile} from 'node:fs/promises';
import {ModelProvider} from '../../server/model';
import {measureDelivery} from '../../src/spokenDelivery';
const model=new ModelProvider(process.env);const report:{checks:unknown[];error?:string}={checks:[]};
try{for(const language of ['ar','en'] as const){
 const pcm=await model.speech(language,language==='ar'?'أريد أن أوضح فكرة الكاتب بكلمات بسيطة، ثم أستمع إلى السؤال قبل أن أجيب عنه باحترام.':'I want to explain the author’s idea in simple words, then listen to the question before answering respectfully.',AbortSignal.timeout(60000));
 const wav=Buffer.alloc(44+pcm.length);wav.write('RIFF');wav.writeUInt32LE(36+pcm.length,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(24000,24);wav.writeUInt32LE(48000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(pcm.length,40);pcm.copy(wav,44);
 const transcript=await model.transcribe(language,wav,'audio/wav',AbortSignal.timeout(60000));
 const samples=new Float32Array(pcm.length/2);for(let i=0;i<samples.length;i++)samples[i]=pcm.readInt16LE(i*2)/32768;
 const result=measureDelivery(samples,24000,transcript,`synthetic-${language}`);
 if(result.status!=='measured'||result.wordCount<5)throw Error('delivery_measurement_failed');
 report.checks.push({language,realTranscription:true,syntheticSpeech:true,duration:result.duration,wordCount:result.wordCount,approximateRate:result.wordsPerMinute,lowVolumeIntervals:result.gaps.length,extraAnalysisApiCalls:0});
}}catch(e){report.error=e instanceof Error&&/^[a-z_]+$/.test(e.message)?e.message:'verification_failed';process.exitCode=1;}
await mkdir('artifacts/reports',{recursive:true});await writeFile('artifacts/reports/spoken-delivery-live.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
