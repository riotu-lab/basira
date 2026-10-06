import {useEffect,useRef} from 'react';

/** Follow incoming turns only while the reader is already near the latest turn. */
export function useTranscriptScroll(turnCount:number,status:string,visible:boolean) {
  const transcript=useRef<HTMLDivElement>(null);
  const follow=useRef(true);
  const onScroll=()=>{
    const el=transcript.current;
    if(el)follow.current=el.scrollHeight-el.scrollTop-el.clientHeight<56;
  };
  useEffect(()=>{
    if(visible)follow.current=true;
  },[visible]);
  useEffect(()=>{
    const el=transcript.current;
    if(!el||!visible||!follow.current)return;
    el.scrollTo({
      top:el.scrollHeight,
      behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',
    });
  },[turnCount,status,visible]);
  return {transcript,onScroll};
}
