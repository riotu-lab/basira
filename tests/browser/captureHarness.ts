// Browser-only integration harness; excluded from deployment.
import React from 'react';import ReactDOM from 'react-dom/client';
import {useCallCapture} from '../../src/useCallCapture';
import {getReviewClips,deleteSessionMedia,type ReviewClip} from '../../src/callReviewMedia';
import {CallMediaReview} from '../../src/CallMediaReview';
import '../../src/styles.css';import '../../src/studio.css';
const controls=window as unknown as {start:()=>Promise<void>;finish:()=>Promise<void>;clean:()=>Promise<void>;show:()=>void;tracksLive:boolean;clips:ReviewClip[]};
function Harness(){
 const [stream,setStream]=React.useState<MediaStream|null>(null),[active,setActive]=React.useState(false),[show,setShow]=React.useState(false);const video=React.useRef<HTMLVideoElement|null>(null);
 const capture=useCallCapture({enabled:true,stream,active,muted:false,speaking:false,camera:true,context:{sessionId:'capture-test',recordId:'question',attempt:1},video});
 controls.start=async()=>{await deleteSessionMedia('capture-test');const s=await navigator.mediaDevices.getUserMedia({audio:true,video:true});video.current!.srcObject=s;await video.current!.play();setStream(s);setActive(true);};
 controls.finish=async()=>{await capture.finish();controls.tracksLive=stream!.getTracks().every(t=>t.readyState==='live');setActive(false);controls.clips=await getReviewClips();stream!.getTracks().forEach(t=>t.stop());};controls.clean=()=>deleteSessionMedia('capture-test');controls.show=()=>setShow(true);
 return show?React.createElement(CallMediaReview,{sessionId:'capture-test',recordId:'question',attempt:1,lang:'en'}):React.createElement('video',{ref:video,muted:true,autoPlay:true});
}
ReactDOM.createRoot(document.getElementById('root')!).render(React.createElement(Harness));
