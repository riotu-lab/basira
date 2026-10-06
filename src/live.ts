import {Room,RoomEvent} from 'livekit-client';
import {api} from './api';

/** Correlate provider events by utterance ID; stale speech cannot restart playback. */
export class AvatarProtocol {
  private active?:{id:string;resolve:(completed:boolean)=>void;reject:(e:Error)=>void;started:()=>void;timer:ReturnType<typeof setTimeout>};
  private clearing?:{id:string;resolve:()=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>};
  ready=false;
  constructor(private send:(event:object)=>void){}
  handle(event:{type:string;source_event_id?:string;state?:string}){
    if(event.type==='session.state_updated')this.ready=event.state==='connected';
    const clearing=this.clearing;
    if(clearing&&event.type==='agent.audio_buffer_cleared'&&event.source_event_id===clearing.id){clearTimeout(clearing.timer);clearing.resolve();this.clearing=undefined;}
    if(!this.active||event.source_event_id!==this.active.id)return;
    if(event.type==='agent.speak_started')this.active.started();
    if(event.type==='agent.speak_ended'||event.type==='agent.speak_interrupted'){
      const active=this.active;this.active=undefined;clearTimeout(active.timer);active.resolve(event.type==='agent.speak_ended');
    }
  }
  speak(pcm:ArrayBuffer,started:()=>void):Promise<boolean>{
    if(!this.ready||this.active||this.clearing)return Promise.reject(new Error('avatar_not_ready'));
    const id=crypto.randomUUID();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.active=undefined;reject(new Error('avatar_speech_timeout'));},90000);
      this.active={id,resolve,reject,started,timer};
      try{
        const bytes=new Uint8Array(pcm);
        // 24kHz PCM16 mono: one second = 48,000 bytes, well below the 1MB frame limit.
        for(let offset=0;offset<bytes.length;offset+=48000){
          let binary='';for(const byte of bytes.subarray(offset,offset+48000))binary+=String.fromCharCode(byte);
          this.send({type:'agent.speak',event_id:id,audio:btoa(binary)});
        }
        this.send({type:'agent.speak_end',event_id:id});
      }catch(error){clearTimeout(timer);this.active=undefined;reject(error);}
    });
  }
  interrupt():Promise<void>{
    if(this.active){clearTimeout(this.active.timer);this.active.resolve(false);this.active=undefined;}
    if(!this.ready)return Promise.resolve();
    if(this.clearing)return Promise.reject(new Error('interrupt_pending'));
    const id=crypto.randomUUID();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.clearing=undefined;reject(new Error('interrupt_not_acknowledged'));},5000);
      this.clearing={id,resolve,reject,timer};
      this.send({type:'agent.interrupt',event_id:id});
    });
  }
  close(){
    this.ready=false;
    if(this.active){clearTimeout(this.active.timer);this.active.resolve(false);this.active=undefined;}
    if(this.clearing){clearTimeout(this.clearing.timer);this.clearing.reject(new Error('avatar_closed'));this.clearing=undefined;}
  }
}

export class LiveConnection {
  private room?:Room;
  private socket?:WebSocket;
  private id?:string;
  private stopped=false;
  private pageHidden=()=>{if(this.id)navigator.sendBeacon('/api/avatar/stop',new Blob([JSON.stringify({id:this.id})],{type:'application/json'}));};
  private heartbeat?:ReturnType<typeof setInterval>;
  private video?:HTMLVideoElement;
  private protocol=new AvatarProtocol(event=>this.socket!.send(JSON.stringify(event)));
  constructor(private disconnected:()=>void){}
  async start(video:HTMLVideoElement,signal:AbortSignal){
    this.video=video;
    const data=await api<{id:string;livekitUrl:string;livekitToken:string;websocketUrl:string}>('/api/avatar/session',{},signal);
    this.id=data.id;window.addEventListener('pagehide',this.pageHidden);
    if(this.stopped||signal.aborted){await this.stop();return;}
    const room=new Room();this.room=room;
    const stream=new MediaStream();
    let mediaReady!:()=>void;
    const media=new Promise<void>(resolve=>{mediaReady=resolve;});
    room.on(RoomEvent.TrackSubscribed,track=>{
      if(this.stopped||!['audio','video'].includes(track.kind))return;
      stream.addTrack(track.mediaStreamTrack);video.srcObject=stream;
      if(stream.getAudioTracks().length&&stream.getVideoTracks().length)mediaReady();
    });
    const lost=()=>{if(this.stopped)return;video.muted=true;video.pause();this.disconnected();void this.stop();};
    room.on(RoomEvent.Disconnected,lost);
    // Recovery is explicit: no uncertain speech is replayed during a hidden reconnect.
    room.on(RoomEvent.Reconnecting,lost);
    const socket=new WebSocket(data.websocketUrl);this.socket=socket;
    let connected!:()=>void,rejectConnection!:(e:Error)=>void;
    const ready=new Promise<void>((resolve,reject)=>{connected=resolve;rejectConnection=reject;});
    socket.onmessage=event=>{
      if(this.stopped)return;
      try{const data=JSON.parse(event.data);this.protocol.handle(data);if(this.protocol.ready)connected();if(data.type==='error'){rejectConnection(new Error('avatar_error'));lost();}}catch{rejectConnection(new Error('invalid_avatar_event'));lost();}
    };
    socket.onerror=()=>{rejectConnection(new Error('avatar_connection_failed'));lost();};
    socket.onclose=()=>{rejectConnection(new Error('avatar_closed'));lost();};
    let timer:ReturnType<typeof setTimeout>|undefined;
    const abort=()=>{rejectConnection(new Error('cancelled'));void this.stop();};signal.addEventListener('abort',abort,{once:true});
    try{
      await Promise.race([Promise.all([ready,room.connect(data.livekitUrl,data.livekitToken),media]),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('avatar_timeout')),25000);})]);
      if(this.stopped)throw new Error('avatar_closed');
      video.muted=false;await video.play();
      this.heartbeat=setInterval(()=>{if(this.protocol.ready&&socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'session.keep_alive'}));},60000);
    }catch(error){await this.stop();throw error;}finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}
  }
  async speak(pcm:ArrayBuffer,onStart:()=>void){
    return this.protocol.speak(pcm,()=>{
      if(this.stopped)return;
      if(this.video){this.video.muted=false;void this.video.play().then(onStart).catch(()=>{this.disconnected();void this.stop();});}
    });
  }
  listening(on:boolean){if(on&&this.video&&!this.stopped){this.video.muted=true;void this.video.play().catch(()=>{});}if(this.protocol.ready&&!this.stopped)this.socket?.send(JSON.stringify({type:on?'agent.start_listening':'agent.stop_listening',event_id:crypto.randomUUID()}));}
  async interrupt(){if(this.video){this.video.muted=true;this.video.pause();}await this.protocol.interrupt();}
  async stop(){
    window.removeEventListener('pagehide',this.pageHidden);
    this.stopped=true;clearInterval(this.heartbeat);this.protocol.close();
    this.socket?.close();this.socket=undefined;
    if(this.video){this.video.muted=true;this.video.pause();this.video.srcObject=null;}
    await this.room?.disconnect();this.room=undefined;
    const id=this.id;this.id=undefined;
    if(id)await api('/api/avatar/stop',{id}).catch(()=>{});
  }
}
