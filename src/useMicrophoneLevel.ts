import {useEffect,useRef,useState} from 'react';
/** Local audio amplitude only: not proof of upload, transcription, or emotion. */
export function useMicrophoneLevel(stream:MediaStream|null,enabled:boolean,onActivity:()=>void){
 const [level,setLevel]=useState(0),activity=useRef(onActivity);activity.current=onActivity;
 useEffect(()=>{setLevel(0);if(!stream||!enabled||!stream.getAudioTracks().length)return;let context:AudioContext|undefined,frame=0,closed=false,last=0;
 try{context=new AudioContext();const analyser=context.createAnalyser();analyser.fftSize=512;const source=context.createMediaStreamSource(stream);source.connect(analyser);void context.resume().catch(()=>{});const values=new Float32Array(analyser.fftSize);
 const tick=(now:number)=>{if(closed)return;if(now-last>80){last=now;analyser.getFloatTimeDomainData(values);const rms=Math.sqrt(values.reduce((n,v)=>n+v*v,0)/values.length);const next=Math.min(1,rms*12);setLevel(next);if(rms>.015)activity.current();}frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);
 }catch{/* The call can continue if local metering is unavailable. */}
 return()=>{closed=true;cancelAnimationFrame(frame);void context?.close().catch(()=>{});};
 },[stream,enabled]);return level;
}
