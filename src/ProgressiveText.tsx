import {useEffect,useState} from 'react';
/** A brief reveal of already-received text, not simulated model tokens or speech. */
export function ProgressiveText({text,animate=false,onProgress,onComplete}:{text:string;animate?:boolean;onProgress?:()=>void;onComplete?:()=>void}){
 const [visible,setVisible]=useState(animate?'':text);
 useEffect(()=>{
  if(!animate||typeof window.matchMedia!=='function'||window.matchMedia('(prefers-reduced-motion: reduce)').matches){setVisible(text);onComplete?.();return;}
  const parts=Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text),s=>s.segment);let frame=0,start=0;
  const tick=(now:number)=>{start||=now;const count=Math.min(parts.length,Math.max(1,Math.ceil((now-start)/Math.min(12,900/Math.max(1,parts.length)))));setVisible(parts.slice(0,count).join(''));onProgress?.();if(count<parts.length)frame=requestAnimationFrame(tick);else onComplete?.();};
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
 },[text,animate]);
 return <><span aria-hidden={animate||undefined}>{animate?visible:text}</span>{animate&&<span className="sr-only">{text}</span>}</>;
}
