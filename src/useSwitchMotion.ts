import {useLayoutEffect,useRef} from 'react';

/** Animate a mode change in place: preserve focus, component state and media nodes. */
export function useSwitchMotion(key:string,enabled:boolean,resize=false) {
  const ref=useRef<HTMLDivElement>(null);
  const previous=useRef<{key:string;height:number}|null>(null);
  useLayoutEffect(()=>{
    const el=ref.current;
    if(!el){previous.current=null;return;}
    const height=el.getBoundingClientRect().height;
    const old=previous.current;
    previous.current=enabled?{key,height}:null;
    if(!enabled||!old||old.key===key||typeof el.animate!=='function'||
      matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const timing={duration:260,easing:'cubic-bezier(.22, 1, .36, 1)'};
    const animations=[el.animate([
      {opacity:.45,transform:'translateY(3px)'},
      {opacity:1,transform:'translateY(0)'},
    ],timing)];
    if(resize&&Math.abs(old.height-height)>1){
      animations.push(el.animate([
        {height:`${old.height}px`,overflow:'clip'},
        {height:`${height}px`,overflow:'clip'},
      ],timing));
    }
    return()=>animations.forEach(animation=>animation.cancel());
  },[key,enabled,resize]);
  return ref;
}
