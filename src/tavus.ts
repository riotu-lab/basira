import {AVATAR_MAX_SECONDS,AvatarIdleGuard} from './avatarLimits';
import Daily,{type DailyCall,type DailyParticipant} from '@daily-co/daily-js';
import {api} from './api';
import {TavusProtocol} from './tavusProtocol';

export class TavusConnection {
  private call?:DailyCall;
  private protocol?:TavusProtocol;
  private handle?:string;
  private video?:HTMLVideoElement;
  private remoteId?:string;
  private stopped=false;
  private playbackEpoch=0;
  private lifetime?:ReturnType<typeof setInterval>;
  private deadline=0;
  private idle=new AvatarIdleGuard(()=>{if(this.stopped)return;this.disconnected('avatar_idle_ended');void this.stop();});
  private pageHidden=()=>{if(this.handle)navigator.sendBeacon('/api/avatar/stop',new Blob([JSON.stringify({id:this.handle})],{type:'application/json'}));};
  constructor(private disconnected:(reason?:string)=>void,private expired?:()=>void,private remaining?:(seconds:number)=>void){}
  async start(video:HTMLVideoElement,signal:AbortSignal){
    this.video=video;
    const requestedAt=Date.now();
    const data=await api<{id:string;conversationId:string;url:string;meetingToken:string;maxSessionSeconds?:number}>('/api/avatar/session',{},signal);
    this.handle=data.id;window.addEventListener('pagehide',this.pageHidden);
    if(this.stopped||signal.aborted){await this.stop();return;}
    // Never publish camera or microphone to the rendering room. Basira owns capture.
    const call=Daily.createCallObject({audioSource:false,videoSource:false});this.call=call;
    const protocol=new TavusProtocol(data.conversationId,e=>call.sendAppMessage(e,this.remoteId));this.protocol=protocol;
    let ready!:()=>void,rejectReady!:(e:Error)=>void;
    const media=new Promise<void>((resolve,reject)=>{ready=resolve;rejectReady=reject;});
    const expire=()=>{if(this.stopped)return;rejectReady(new Error('avatar_time_ended'));(this.expired||this.disconnected)();void this.stop();};
    // Include setup time: stop before the server/provider cap, not a fresh five minutes after joining.
    this.deadline=requestedAt+(Math.min(data.maxSessionSeconds||AVATAR_MAX_SECONDS,AVATAR_MAX_SECONDS)-5)*1000;
    const tick=()=>{const seconds=Math.max(0,Math.ceil((this.deadline-Date.now())/1000));this.remaining?.(seconds);if(seconds===0)expire();};
    this.lifetime=setInterval(tick,250);tick();
    const lost=(reason='avatar_connection_failed')=>{if(Date.now()>=this.deadline){expire();return;}if(this.stopped)return;video.muted=true;video.pause();console.warn('Basira avatar disconnected',{reason});rejectReady(new Error(reason));this.disconnected(reason);void this.stop();};
    const update=(participant:DailyParticipant)=>{
      if(this.stopped||participant.local||(this.remoteId&&participant.session_id!==this.remoteId))return;
      const audio=participant.tracks.audio.track,track=participant.tracks.video.track;
      if(!audio||!track)return;
      this.remoteId=participant.session_id;
      const existing=video.srcObject as MediaStream|null;
      if(!existing||existing.getVideoTracks()[0]!==track||existing.getAudioTracks()[0]!==audio)video.srcObject=new MediaStream([track,audio]);
      ready();
    };
    call.on('participant-joined',e=>{if(e)update(e.participant);});
    call.on('participant-updated',e=>{if(e)update(e.participant);});
    call.on('participant-left',e=>{if(e?.participant.session_id===this.remoteId)lost('avatar_participant_left');});
    call.on('left-meeting',()=>lost('avatar_room_left'));call.on('error',()=>lost('avatar_transport_error'));
    call.on('network-connection',e=>{if(e?.event==='interrupted')lost('avatar_network_interrupted');});
    call.on('app-message',e=>{if(e?.fromId===this.remoteId&&!this.stopped)protocol.handle(e.data);});
    const abort=()=>{rejectReady(new Error('cancelled'));void this.stop();};
    signal.addEventListener('abort',abort,{once:true});let timeout:ReturnType<typeof setTimeout>|undefined;
    try{
      const joined=call.join({url:data.url,token:data.meetingToken,audioSource:false,videoSource:false}).then(()=>{for(const p of Object.values(call.participants()))update(p);});
      await Promise.race([Promise.all([joined,media]),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('avatar_timeout')),35000);})]);
      if(this.stopped||signal.aborted)throw new Error('cancelled');
      video.muted=true;await video.play();protocol.ready=true;this.idle.start();

    }catch(error){await this.stop();throw error;}finally{clearTimeout(timeout);signal.removeEventListener('abort',abort);}
  }
  speakText(text:string,onStart:()=>void){return this.speak(text,onStart);}
  async speak(pcm:ArrayBuffer|string,onStart:()=>void){
    if(!this.protocol||this.stopped)throw new Error('avatar_not_ready');
    const epoch=++this.playbackEpoch;
    let playback:Promise<boolean>=Promise.resolve(false);
    try{
      const completed=await this.protocol.speak(pcm,()=>{
        if(this.stopped||epoch!==this.playbackEpoch||!this.video)return;
        this.video.muted=false;
        playback=this.video.play().then(()=>{
          if(this.stopped||epoch!==this.playbackEpoch)return false;
          onStart();return true;
        }).catch(()=>{console.warn('Basira avatar disconnected',{reason:'avatar_playback_blocked'});this.disconnected('avatar_playback_blocked');void this.stop();return false;});
      });
      return completed&&await playback&&!this.stopped&&epoch===this.playbackEpoch;
    }catch(error){const reason=error instanceof Error&&['avatar_speech_timeout','avatar_not_ready'].includes(error.message)?error.message:'avatar_connection_failed';const wasStopped=this.stopped;await this.stop();if(!wasStopped){console.warn('Basira avatar disconnected',{reason});this.disconnected(reason);}throw error;}
  }
  listening(on:boolean){if(on)this.idle.touch();if(on&&this.video&&!this.stopped){this.video.muted=true;void this.video.play().catch(()=>{});}}
  async interrupt(){this.playbackEpoch++;if(this.video){this.video.muted=true;this.video.pause();}await this.protocol?.interrupt();}
  async stop(){
    this.stopped=true;this.idle.stop();this.playbackEpoch++;clearInterval(this.lifetime);window.removeEventListener('pagehide',this.pageHidden);this.protocol?.close();
    if(this.video){this.video.muted=true;this.video.pause();this.video.srcObject=null;}
    const call=this.call;this.call=undefined;
    const handle=this.handle;this.handle=undefined;
    // Stop billing in parallel with media teardown, even if Daily leave fails.
    await Promise.allSettled([(async()=>{try{await call?.leave();}finally{await call?.destroy();}})(),handle?api('/api/avatar/stop',{id:handle}).catch(()=>{navigator.sendBeacon('/api/avatar/stop',new Blob([JSON.stringify({id:handle})],{type:'application/json'}));}):Promise.resolve()]);
  }
}
