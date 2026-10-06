type SpeakingEvent={message_type?:string;conversation_id?:string;event_type?:string;inference_id?:string;properties?:{role?:string;interrupted?:boolean}};
/** Text/audio echo protocol. Correlated completion is not proof of which words a person heard. */
export class TavusProtocol {
  private retired=new Set<string>();
  private active?:{id:string;providerId?:string;started:boolean;onStart:()=>void;resolve:(v:boolean)=>void;reject:(e:Error)=>void;timeout:ReturnType<typeof setTimeout>;queue?:ReturnType<typeof setTimeout>};
  private clearing?:{id:string;providerId?:string;resolve:()=>void;reject:(e:Error)=>void;timeout:ReturnType<typeof setTimeout>};
  ready=false;
  constructor(private conversationId:string,private send:(event:object)=>void){}
  handle(e:SpeakingEvent){
    // Live echo events omit conversation_id and assign a fresh inference_id.
    // The connection authenticates the Daily room and renderer sender. Serialize
    // utterances and bind their first speaking event; never reuse a retired ID.
    if(!e||e.message_type!=='conversation'||(e.conversation_id&&e.conversation_id!==this.conversationId)||!['pal','replica'].includes(e.properties?.role||'')||!e.inference_id||this.retired.has(e.inference_id))return;
    const clearing=this.clearing;
    if(clearing){
      if(!clearing.providerId&&e.event_type==='conversation.started_speaking')clearing.providerId=e.inference_id;
      if(e.event_type==='conversation.stopped_speaking'&&e.inference_id===(clearing.providerId||clearing.id)){
        this.retired.add(e.inference_id);clearTimeout(clearing.timeout);clearing.resolve();this.clearing=undefined;
      }
      return;
    }
    const a=this.active;if(!a)return;
    if(e.event_type==='conversation.started_speaking'){
      if(!a.providerId)a.providerId=e.inference_id;
      if(a.providerId!==e.inference_id||a.started)return;
      a.started=true;a.onStart();
    }
    if(e.event_type==='conversation.stopped_speaking'&&e.inference_id===(a.providerId||a.id)){
      this.retired.add(e.inference_id);clearTimeout(a.timeout);clearTimeout(a.queue);this.active=undefined;
      a.resolve(a.started&&e.properties?.interrupted===false);
    }
  }
  speak(pcm:ArrayBuffer|string,onStart:()=>void):Promise<boolean>{
    if(!this.ready||this.active||this.clearing)return Promise.reject(new Error('avatar_not_ready'));
    if(typeof pcm==='string'){
      if(!pcm.trim())return Promise.reject(new Error('invalid_text'));
      // Fail explicitly instead of truncating a reply or exceeding Daily’s 4KB limit.
      if(new TextEncoder().encode(JSON.stringify({message_type:'conversation',event_type:'conversation.echo',conversation_id:this.conversationId,properties:{modality:'text',text:pcm,inference_id:'0'.repeat(36),done:true}})).byteLength>=4096)return Promise.reject(new Error('avatar_text_too_long'));
    }else if(!pcm.byteLength||pcm.byteLength%2)return Promise.reject(new Error('invalid_audio'));
    return new Promise((resolve,reject)=>{
      const id=crypto.randomUUID();
      const a={id,started:false,onStart,resolve,reject,timeout:setTimeout(()=>{clearTimeout(this.active?.queue);this.active=undefined;this.ready=false;reject(new Error('avatar_speech_timeout'));},55000),queue:undefined as ReturnType<typeof setTimeout>|undefined};
      this.active=a;
      if(typeof pcm==='string'){
        try{this.send({message_type:'conversation',event_type:'conversation.echo',conversation_id:this.conversationId,properties:{modality:'text',text:pcm,inference_id:id,done:true}});}
        catch{clearTimeout(a.timeout);this.active=undefined;this.ready=false;reject(new Error('avatar_connection_failed'));}
        return;
      }
      const bytes=new Uint8Array(pcm);let offset=0;
      const pump=()=>{
        if(this.active!==a||!this.ready)return;
        try{
          // Daily app messages have a 4KB JSON limit. PCM16/24kHz mono, 37.5ms chunks.
          const chunk=bytes.subarray(offset,offset+1800);offset+=chunk.length;
          let binary='';for(const byte of chunk)binary+=String.fromCharCode(byte);
          this.send({message_type:'conversation',event_type:'conversation.echo',conversation_id:this.conversationId,properties:{modality:'audio',audio:btoa(binary),sample_rate:24000,inference_id:id,done:offset===bytes.length}});
          if(offset<bytes.length)a.queue=setTimeout(pump,20);
        }catch{clearTimeout(a.timeout);this.active=undefined;this.ready=false;reject(new Error('avatar_connection_failed'));}
      };pump();
    });
  }
  interrupt():Promise<void>{
    if(this.clearing)return Promise.reject(new Error('interrupt_pending'));
    const a=this.active;if(!a)return Promise.resolve();
    this.active=undefined;clearTimeout(a.timeout);clearTimeout(a.queue);a.resolve(false);
    return new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>{this.clearing=undefined;this.ready=false;reject(new Error('interrupt_not_acknowledged'));},5000);
      this.clearing={id:a.id,providerId:a.providerId,resolve,reject,timeout};
      try{this.send({message_type:'conversation',event_type:'conversation.interrupt',conversation_id:this.conversationId});}
      catch{clearTimeout(timeout);this.clearing=undefined;this.ready=false;reject(new Error('avatar_connection_failed'));}
    });
  }
  close(){
    this.ready=false;
    if(this.active){clearTimeout(this.active.timeout);clearTimeout(this.active.queue);this.active.resolve(false);this.active=undefined;}
    if(this.clearing){clearTimeout(this.clearing.timeout);this.clearing.reject(new Error('avatar_closed'));this.clearing=undefined;}
  }
}
