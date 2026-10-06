import {spokenText} from './providerSpeech';
import type {Turn} from './content';
/** Only final utterances enter assessment. Provider playback flags do not prove hearing. */
export class VideoTranscript {
 turns:Turn[]=[];
 private typedEchoes=new Set<string>();
 private echoKeys=new Set<string>();
 recordTyped(text:string){if(this.turns.length<60)this.turns.push({id:`typed-${crypto.randomUUID()}`,role:'user',text,at:Date.now(),delivery:'text'});}
 private started=new Set<string>();
 private completed=new Set<string>();
 private interrupted=new Set<string>();
 handle(e:any){
  if(e?.message_type!=='conversation')return;
  const role=e.properties?.role==='user'?'user':['pal','replica'].includes(e.properties?.role)?'assistant':null;
  if(!role)return;
  const id=typeof e.inference_id==='string'?`${role}-${e.inference_id}`:undefined;
  if(role==='assistant'&&id){
   if(e.event_type==='conversation.started_speaking')this.started.add(id);
   if(e.event_type==='conversation.stopped_speaking'){
    if(e.properties.interrupted===false&&this.started.has(id)&&!this.interrupted.has(id))this.completed.add(id);
    else {this.interrupted.add(id);this.completed.delete(id);}
    this.turns=this.turns.map(t=>t.id===id?{...t,delivery:this.completed.has(id)?'complete':'uncertain',interrupted:!this.completed.has(id)}:t);
   }
  }
  if(e.event_type!=='conversation.utterance')return;
  const raw=e.properties?.speech;
  const text=typeof raw==='string'&&role==='user'?spokenText(raw):raw;
  if(typeof text!=='string'||!text.trim()||text.length>2400)return;
  const key=id||`${role}-${e.turn_idx??e.timestamp??e.seq}`;
  if(!id&&e.turn_idx===undefined&&e.timestamp===undefined&&e.seq===undefined)return;
  if(this.echoKeys.has(key))return;
  if(role==='user'){
   const typed=[...this.turns].reverse().find(t=>t.id.startsWith('typed-')&&t.text===text&&!this.typedEchoes.has(t.id));
   if(typed){this.typedEchoes.add(typed.id);this.echoKeys.add(key);return;}
  }
  const turn:Turn={id:key,role,text,at:Date.now(),delivery:role==='user'?'text':this.completed.has(key)?'complete':'uncertain',interrupted:role==='assistant'&&!this.completed.has(key)};
  const index=this.turns.findIndex(t=>t.id===key);
  if(index>=0)this.turns=this.turns.map((t,i)=>i===index?{...turn,at:t.at}:t);
  else if(this.turns.length<60)this.turns=[...this.turns,turn];
 }
 interrupt(){
  for(const id of this.started)if(!this.completed.has(id))this.interrupted.add(id);
 }
}
