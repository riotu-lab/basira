export interface AvatarConnection {
 start(video:HTMLVideoElement,signal:AbortSignal):Promise<void>;
 speakText?(text:string,onStart:()=>void):Promise<boolean>;
 speak(pcm:ArrayBuffer,onStart:()=>void):Promise<boolean>;
 listening(on:boolean):void;
 interrupt():Promise<void>;
 stop():Promise<void>;
}
export async function createAvatarConnection(provider:'tavus'|'liveavatar'|undefined,disconnected:(reason?:string)=>void,expired?:()=>void,remaining?:(seconds:number)=>void):Promise<AvatarConnection>{
 if(provider==='tavus'){const {TavusConnection}=await import('./tavus');return new TavusConnection(disconnected,expired,remaining);}
 const {LiveConnection}=await import('./live');return new LiveConnection(disconnected);
}
