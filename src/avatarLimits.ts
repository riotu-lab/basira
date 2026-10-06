/** Provider hard cap; inactivity is separate from an empty/unjoined room. */
export const AVATAR_MAX_SECONDS=300;
export const AVATAR_IDLE_SECONDS=150;
export class AvatarIdleGuard {
 private timer?:ReturnType<typeof setTimeout>;
 private active=false;
 private input=(event:Event)=>{if(event.isTrusted)this.touch();};
 constructor(private expire:()=>void){}
 start(){this.stop();this.active=true;for(const name of ['pointerdown','keydown','input'])window.addEventListener(name,this.input);this.touch();}
 touch(){if(!this.active)return;clearTimeout(this.timer);this.timer=setTimeout(()=>{this.stop();this.expire();},AVATAR_IDLE_SECONDS*1000);}
 stop(){this.active=false;clearTimeout(this.timer);for(const name of ['pointerdown','keydown','input'])window.removeEventListener(name,this.input);}
}
