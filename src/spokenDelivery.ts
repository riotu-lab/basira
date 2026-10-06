export type SpokenDelivery={assessment?:import('./audioAssessment').AudioAssessment;assessmentError?:string;version:1;recordingId:string;status:'measured'|'insufficient_signal'|'unavailable';duration:number;windowSeconds:number;gaps:{start:number;end:number}[];wordCount:number;wordsPerMinute:number|null;fillers:{token:string;count:number}[];transcriptEdited?:boolean};
export function measureDelivery(samples:Float32Array,sampleRate:number,transcript:string,recordingId:string):SpokenDelivery{
 const duration=samples.length/sampleRate;
 if(!Number.isFinite(duration)||sampleRate<8000||duration<=0||duration>60)throw Error('invalid_audio_duration');
 const step=Math.max(1,Math.floor(sampleRate*.02)),levels:number[]=[];
 for(let i=0;i<samples.length;i+=step){let sum=0;const end=Math.min(i+step,samples.length);for(let j=i;j<end;j++)sum+=samples[j]*samples[j];levels.push(Math.sqrt(sum/(end-i)));}
 const peak=Math.max(...levels),threshold=Math.max(.01,peak*.08),active=levels.map(x=>x>=threshold),first=active.indexOf(true),last=active.lastIndexOf(true);
 const windowSeconds=first<0?0:Math.min(duration,(last+1)*.02)-first*.02;
 const wordCount=(transcript.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu)||[]).length;
 const normalized=transcript.toLowerCase().normalize('NFKC').replace(/[\u064b-\u065f\u0670]/g,'');
 const tokens=normalized.match(/[\p{L}]+/gu)||[];
 // Avoid ambiguous content words such as "like", "يعني" or "well".
 const fillers=['um','uh','erm','hmm','أمم','أممم','اممم','إمم'].map(token=>({token,count:tokens.filter(t=>t===token).length})).filter(f=>f.count);
 const status=duration>=3&&active.filter(Boolean).length*.02>=.8?'measured':'insufficient_signal';
 const gaps:{start:number;end:number}[]=[];
 if(status==='measured')for(let i=first+1;i<last;i++){if(active[i])continue;const start=i;while(i<last&&!active[i])i++;if((i-start)*.02>=.8)gaps.push({start:Number((start*.02).toFixed(2)),end:Number((i*.02).toFixed(2))});}
 return {version:1,recordingId,status,duration,windowSeconds,gaps,wordCount,wordsPerMinute:status==='measured'&&windowSeconds>=5&&wordCount>=5?Math.round(wordCount*60/windowSeconds):null,fillers};
}
export async function analyzeRecording(blob:Blob,transcript:string):Promise<SpokenDelivery>{
 const recordingId=crypto.randomUUID();let context:AudioContext|undefined;
 try{context=new AudioContext();const audio=await context.decodeAudioData(await blob.arrayBuffer());
  // Peak channel avoids phase cancellation between stereo channels.
  const samples=new Float32Array(audio.length);for(let c=0;c<audio.numberOfChannels;c++){const channel=audio.getChannelData(c);for(let i=0;i<samples.length;i++)if(Math.abs(channel[i])>Math.abs(samples[i]))samples[i]=channel[i];}
  return measureDelivery(samples,audio.sampleRate,transcript,recordingId);
 }catch{return {version:1,recordingId,status:'unavailable',duration:0,windowSeconds:0,gaps:[],wordCount:0,wordsPerMinute:null,fillers:[]};}
 finally{await context?.close().catch(()=>{});}
}
