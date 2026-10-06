import {useState,type CSSProperties} from 'react';
import type {Lang} from './content';
export function PortraitGuide({lang,state,level,recording}:{lang:Lang;state:'idle'|'listening'|'thinking'|'speaking';level:number;recording:boolean}){
 const [loaded,setLoaded]=useState(false),[failed,setFailed]=useState(false);
 const ar=lang==='ar';
 return <div className={`portrait-guide ${loaded?'loaded':''} ${state}`} style={{'--voice-level':level} as CSSProperties}>
  <img src="/brand/basira-guide.png" alt={ar?'دليل بصيرة: شخصية خيالية مولّدة بالذكاء الاصطناعي':'Basira guide: a fictional AI-generated person'} onLoad={()=>setLoaded(true)} onError={()=>setFailed(true)}/>
  {!loaded&&<div className="portrait-placeholder" role="status">{failed?(ar?'تعذّر تحميل الصورة. المحادثة الصوتية تظل متاحة.':'The portrait could not load. Voice conversation remains available.'):(ar?'نجهّز مساحة الحوار…':'Preparing your conversation space…')}</div>}
  <div className="portrait-shade"/>
  <div className="portrait-caption"><span className="portrait-name">{ar?'دليل بصيرة':'Your Basira guide'}</span><span>{ar?'صورة متحركة · دون مزامنة شفاه':'Animated portrait · no lip sync'}</span></div>
  <div className="portrait-meter" aria-label={ar?'مؤشر صوت الشخصية':'Guide audio level'}><span className="portrait-meter-dot"/>{Array.from({length:15},(_,i)=><i key={i} style={{height:4+level*(10+20*Math.sin((i+1)*Math.PI/16))}}/>)}</div>
  {recording&&<span className="portrait-recording">{ar?'الميكروفون يعمل':'Microphone on'}</span>}
 </div>;
}
