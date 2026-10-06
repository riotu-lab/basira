import {flushSync} from 'react-dom';

// Snapshot only the setup-to-call boundary, never individual transcript updates.
export async function enterMeeting(update:()=>void){
 if(!document.startViewTransition||window.matchMedia('(prefers-reduced-motion: reduce)').matches){update();return;}
 let applied=false;
 const transition=document.startViewTransition(()=>{applied=true;flushSync(update);});
 try{await transition.updateCallbackDone;}catch{if(!applied)update();}
 // Unsupported snapshot conditions should never prevent a call from starting.
 void transition.finished.catch(()=>{});
}
