import {spokenText} from './providerSpeech';
import type {Turn} from './content';
export type LiveUtterance={id:string;role:'user'|'assistant';text:string;final:boolean;interrupted:boolean;index:number;base:number;canonicalId?:string};
/** Display-only provider hypotheses. Never passed to assessment or durable session storage. */
export class LiveUtterances {
 entries:LiveUtterance[]=[];
 update(event:any,turns:Turn[]){
  if(!['conversation.utterance.streaming','conversation.utterance'].includes(event?.event_type))return false;
  const p=event.properties,role=p?.role==='user'?'user':['pal','replica'].includes(p?.role)?'assistant':null;
  if(!role||typeof p.speech!=='string'||p.speech.length>12000)return false;
  const key=typeof event.inference_id==='string'?event.inference_id:Number.isInteger(event.turn_idx)?String(event.turn_idx):undefined;
  if(!key)return false;
  const id=`live-${role}-${key}`,previous=this.entries.find(v=>v.id===id);
  const legacy=event.event_type==='conversation.utterance';
  if(legacy&&(!previous||role==='assistant'))return false;
  const final=legacy||p.final===true;
  const index=Number.isInteger(p.content_index)?p.content_index:Number.isInteger(event.seq)?event.seq:0;
  // Legacy final duplicates must not overwrite a precise interrupted streaming completion.
  if(previous&&(previous.final||(!legacy&&index<previous.index)))return false;
  const text=spokenText(p.speech);if(!text)return false;
  const last=turns.at(-1);
  const canonicalId=previous?.canonicalId||(last?.role===role&&last.text.startsWith(text)?last.id:undefined);
  const entry:LiveUtterance={id,role,text,final,interrupted:p.is_interrupted===true,index,base:previous?.base??turns.length,canonicalId};
  this.entries=previous?this.entries.map(v=>v.id===id?entry:v):[...this.entries,entry].slice(-12);return true;
 }
 interruptAssistant(){this.entries=this.entries.map(e=>e.role==='assistant'&&!e.final?{...e,final:true,interrupted:true}:e);}
 clear(){this.entries=[];}
}
export function displayUtterances(turns:Turn[],entries:LiveUtterance[]){
 const result=turns.map(t=>({...t,partial:false,streamed:false,provisional:false}));
 for(const e of entries){
  const match=result.findIndex((t,i)=>t.id===e.canonicalId||(i>=e.base&&t.role===e.role&&(t.text===e.text||(e.role==='assistant'&&t.text.startsWith(e.text)))));
  if(match>=0){
   // A final server record is authoritative, including corrected STT. Partial text cannot replace it.
   if(e.final)result[match]={...result[match],...(e.interrupted?{interrupted:true}:{}),streamed:true};
   else if(e.role==='assistant')result[match]={...result[match],text:e.text,partial:true,streamed:true};
  }else if(!e.final||!turns.slice(e.base).some(t=>t.role===e.role&&t.text===e.text))result.push({id:e.id,role:e.role,text:e.text,at:0,delivery:'uncertain',partial:!e.final,streamed:true,provisional:true});
 }
 return result;
}
