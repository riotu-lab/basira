import {useEffect,useRef} from 'react';
export const CONTINUATION_NUDGE_MS=15000;
// At most one invitation per saved silent turn, only while both parties are quiet.
export function useContinuationNudge(enabled:boolean,turnId:string|undefined,busy:boolean,onNudge:()=>void){
 const sent=useRef(new Set<string>()),callback=useRef(onNudge);callback.current=onNudge;
 useEffect(()=>{
  if(!enabled||!turnId||busy||sent.current.has(turnId))return;
  const timer=setTimeout(()=>{sent.current.add(turnId);callback.current();},CONTINUATION_NUDGE_MS);
  return()=>clearTimeout(timer);
 },[enabled,turnId,busy]);
}
