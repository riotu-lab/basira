import {useEffect,useRef,useState} from 'react';
import {saveReviewClip,type ReviewClip} from './callReviewMedia';
export function useCallCapture({enabled,stream,active,muted,speaking,camera,context,video}:{enabled:boolean;stream:MediaStream|null;active:boolean;muted:boolean;speaking:boolean;camera:boolean;context?:{sessionId:string;recordId:string;attempt:number};video:React.RefObject<HTMLVideoElement|null>}){
 const [error,setError]=useState(false),[capturing,setCapturing]=useState(false);const gain=useRef<GainNode|null>(null),finish=useRef<()=>Promise<void>>(async()=>{}),pending=useRef<Promise<void>>(Promise.resolve());
 const allowed=useRef(false);allowed.current=!muted&&!speaking;
 useEffect(()=>{if(gain.current)gain.current.gain.value=allowed.current?1:0;},[muted,speaking]);
 useEffect(()=>{
  if(!enabled||!active||!stream||!context)return;
  let startedRecorder=false,resolveDone=()=>{};let stopped=false,recorder:MediaRecorder|undefined,timer:ReturnType<typeof setTimeout>,frameTimer:ReturnType<typeof setInterval>,done:Promise<void>=Promise.resolve();let ac:AudioContext|undefined;
  const info={...context};
  function rotate(){if(stopped)return;startedRecorder=false;const chunks:Blob[]=[];const frames:ReviewClip['frames']=[],started=Date.now();
   const sample=()=>{const v=video.current;if(!camera||!v?.videoWidth||v.readyState<2||frames.length>=3||stopped)return;const canvas=document.createElement('canvas');canvas.width=480;canvas.height=Math.round(480*v.videoHeight/v.videoWidth);canvas.getContext('2d')!.drawImage(v,0,0,canvas.width,canvas.height);frames.push({id:'frame-'+frames.length,time:(Date.now()-started)/1000,image:canvas.toDataURL('image/jpeg',.65)});};
   const source=ac!.createMediaStreamSource(new MediaStream(stream!.getAudioTracks())),g=ac!.createGain(),out=ac!.createMediaStreamDestination();gain.current=g;g.gain.value=allowed.current?1:0;source.connect(g);g.connect(out);
   const tracks=[...out.stream.getAudioTracks(),...(camera?stream!.getVideoTracks():[])];const hasVideo=tracks.some(t=>t.kind==='video');const candidates=hasVideo?['video/webm;codecs=vp8,opus','video/mp4']:['audio/webm;codecs=opus','audio/mp4'];const mimeType=candidates.find(m=>MediaRecorder.isTypeSupported(m));if(!mimeType)throw Error('recording_unavailable');
   recorder=new MediaRecorder(new MediaStream(tracks),{mimeType,audioBitsPerSecond:64000,...hasVideo?{videoBitsPerSecond:350000}:{}});
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   done=new Promise(resolve=>{resolveDone=resolve;recorder!.onstop=()=>{clearTimeout(timer);clearInterval(frameTimer);source.disconnect();g.disconnect();out.stream.getTracks().forEach(t=>t.stop());const blob=new Blob(chunks,{type:mimeType}),duration=(Date.now()-started)/1000;
    const write=duration>=2&&blob.size?saveReviewClip({id:crypto.randomUUID(),...info,at:started,duration,blob,frames},resolve):Promise.resolve().then(resolve);pending.current=Promise.all([pending.current,write.catch(()=>{setError(true);resolve();})]).then(()=>{});if(!stopped){try{rotate();}catch{setError(true);setCapturing(false);}}};});
   recorder.onerror=()=>setError(true);recorder.start(1000);startedRecorder=true;setCapturing(true);sample();frameTimer=setInterval(sample,10000);timer=setTimeout(()=>{if(recorder?.state!=='inactive')recorder?.stop();},30000);
  }
  const stop=async()=>{stopped=true;clearTimeout(timer);clearInterval(frameTimer);if(recorder&&recorder.state!=='inactive')recorder.stop();if(!startedRecorder)resolveDone();let timeout:ReturnType<typeof setTimeout>|undefined;await Promise.race([done,new Promise<void>(resolve=>{timeout=setTimeout(()=>{setError(true);resolve();},3000);})]);clearTimeout(timeout);await ac?.close().catch(()=>{});setCapturing(false);};finish.current=stop;
  try{ac=new AudioContext();void ac.resume();rotate();}catch{setError(true);void stop();}
  return()=>{void stop();};
 },[enabled,active,stream,camera,context?.sessionId,context?.recordId,context?.attempt]);
 return {capturing,error,finish:()=>finish.current()};
}
