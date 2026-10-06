import {useCallback,useEffect,useRef,useState} from 'react';
import {SPOKEN_TURN_SETTLE_MS} from './conversationTiming';
export type ConversationActivity='idle'|'listening'|'settling'|'thinking'|'delayed'|'speaking';
export function useConversationActivity(active:boolean,waitingForContinuation:boolean){
 const [phase,setPhase]=useState<ConversationActivity>('idle'),current=useRef<ConversationActivity>('idle');
 const settle=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),slow=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const clear=useCallback(()=>{clearTimeout(settle.current);clearTimeout(slow.current);},[]);
 const change=useCallback((next:ConversationActivity)=>{current.current=next;setPhase(next);},[]);
 const listen=useCallback(()=>{clear();change('listening');},[clear,change]);
 const reset=useCallback(()=>{clear();change('idle');},[clear,change]);
 const pending=useCallback(()=>{if(['settling','thinking','delayed'].includes(current.current))return;clear();change('settling');settle.current=setTimeout(()=>{change('thinking');slow.current=setTimeout(()=>change('delayed'),20000);},SPOKEN_TURN_SETTLE_MS);},[clear,change]);
 const event=useCallback((data:any)=>{
  const {role,final,interrupted}=data?.properties||{},type=data?.event_type;
  if(role==='user'){
   if(type==='conversation.started_speaking'||(type==='conversation.utterance.streaming'&&final!==true))listen();
   if(type==='conversation.stopped_speaking'){if(interrupted)listen();else pending();}
   if(type==='conversation.utterance'||(type==='conversation.utterance.streaming'&&final===true))pending();
  }else if(['pal','replica'].includes(role)){
   if(type==='conversation.started_speaking'){clear();change('speaking');}
   if(type==='conversation.stopped_speaking'&&current.current==='speaking')reset();
  }
 },[listen,pending,clear,change,reset]);
 useEffect(()=>{if(!active)reset();else if(waitingForContinuation)listen();},[active,waitingForContinuation,reset,listen]);
 useEffect(()=>clear,[clear]);
 return {phase,event,pending,reset,listen};
}
