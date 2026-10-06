import {useEffect,useRef,useState} from 'react';
import {Video,VideoOff} from 'lucide-react';
import type {Lang} from './content';
/** Local-only preview. Never attaches camera tracks to the avatar transport. */
export function CameraPreview({lang}:{lang:Lang}){
 const [stream,setStream]=useState<MediaStream|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(false);
 const current=useRef<MediaStream|null>(null),epoch=useRef(0),video=useRef<HTMLVideoElement>(null);
 const stop=()=>{epoch.current++;current.current?.getTracks().forEach(t=>t.stop());current.current=null;setStream(null);setBusy(false);};
 useEffect(()=>()=>{epoch.current++;current.current?.getTracks().forEach(t=>t.stop());},[]);
 useEffect(()=>{if(video.current)video.current.srcObject=stream;},[stream]);
 async function toggle(){
  if(current.current||busy){stop();return;}
  const id=++epoch.current;setBusy(true);setError(false);
  try{
   const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});
   if(id!==epoch.current){media.getTracks().forEach(t=>t.stop());return;}
   current.current=media;setStream(media);
  }catch{if(id===epoch.current)setError(true);}
  finally{if(id===epoch.current)setBusy(false);}
 }
 return <div className="camera-widget"><button type="button" className={`mic-button camera-toggle ${stream?'enabled':''}`} aria-pressed={!!stream} aria-label={lang==='ar'?(stream?'إيقاف الكاميرا':'تشغيل الكاميرا'):(stream?'Turn camera off':'Turn camera on')} onClick={()=>void toggle()}>{stream?<Video size={18}/>:<VideoOff size={18}/>}</button>
 {busy&&<span role="status">{lang==='ar'?'بانتظار إذن الكاميرا…':'Waiting for camera permission…'}</span>}
 {stream&&<div className="self-preview"><video ref={video} autoPlay muted playsInline/><span>{lang==='ar'?'معاينة الكاميرا فقط · لا تُرسل للمحادثة':'Camera preview only · not sent to the conversation'}</span></div>}
 {error&&<span role="status">{lang==='ar'?'تعذّر فتح الكاميرا. تحقق من إذن المتصفح.':'Could not open the camera. Check your browser permission.'}</span>}
 </div>;
}
