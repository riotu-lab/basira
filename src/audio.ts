export class Microphone {
  private recorder?:MediaRecorder;
  private stream?:MediaStream;
  private chunks:Blob[]=[];
  private timer?:ReturnType<typeof setTimeout>;
  private epoch=0;
  private rejectFinish?: (error:Error)=>void;
  async start(onLimit:()=>void){
    this.cancel();const epoch=this.epoch;
    if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')throw new Error('microphone_unsupported');
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
    if(epoch!==this.epoch){stream.getTracks().forEach(t=>t.stop());throw new Error('cancelled');}
    this.stream=stream;this.chunks=[];
    const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));
    try{
      this.recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);
      this.recorder.ondataavailable=e=>{if(e.data.size)this.chunks.push(e.data);};
      this.recorder.start(250);
      this.timer=setTimeout(onLimit,45000);
    }catch(error){
      // A granted microphone must not remain live if encoding cannot start.
      this.cancel();throw error;
    }
  }
  async finish():Promise<Blob>{
    const recorder=this.recorder;if(!recorder||recorder.state==='inactive')throw new Error('not_recording');
    clearTimeout(this.timer);
    return new Promise((resolve,reject)=>{
      this.rejectFinish=reject;
      recorder.onstop=()=>{this.rejectFinish=undefined;this.stream?.getTracks().forEach(t=>t.stop());this.stream=undefined;this.recorder=undefined;resolve(new Blob(this.chunks,{type:recorder.mimeType}));this.chunks=[];};
      recorder.onerror=()=>{this.cancel();reject(new Error('recording_failed'));};
      recorder.stop();
    });
  }
  cancel(){this.epoch++;clearTimeout(this.timer);this.rejectFinish?.(new Error('cancelled'));this.rejectFinish=undefined;if(this.recorder){this.recorder.ondataavailable=null;this.recorder.onstop=null;if(this.recorder.state!=='inactive')this.recorder.stop();}this.stream?.getTracks().forEach(t=>t.stop());this.stream=undefined;this.recorder=undefined;this.chunks=[];}
}

export class PcmPlayer {
  private context?:AudioContext;
  private source?:AudioBufferSourceNode;
  private finish?:()=>void;
  private meterFrame?:number;
  private clearMeter?:()=>void;
  private epoch=0;
  async prepare(){this.context??=new AudioContext();await this.context.resume();}
  async play(pcm:ArrayBuffer,onStart:()=>void,onLevel?:(level:number)=>void):Promise<boolean>{
    this.stop();const epoch=this.epoch;await this.prepare();
    if(epoch!==this.epoch)return false;
    const context=this.context!;
    if(pcm.byteLength%2||!pcm.byteLength)throw new Error('invalid_audio');
    const view=new DataView(pcm),buffer=context.createBuffer(1,pcm.byteLength/2,24000);
    const channel=buffer.getChannelData(0);for(let i=0;i<channel.length;i++)channel[i]=view.getInt16(i*2,true)/32768;
    return new Promise(resolve=>{const source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);
      if(onLevel){
        const analyser=context.createAnalyser();analyser.fftSize=256;source.connect(analyser);
        const samples=new Uint8Array(analyser.fftSize);let last=0;
        const meter=(now:number)=>{if(this.source!==source)return;if(now-last>=50){analyser.getByteTimeDomainData(samples);let sum=0;for(const v of samples)sum+=((v-128)/128)**2;onLevel(Math.min(1,Math.sqrt(sum/samples.length)*5));last=now;}this.meterFrame=requestAnimationFrame(meter);};
        this.clearMeter=()=>{if(this.meterFrame!==undefined)cancelAnimationFrame(this.meterFrame);this.meterFrame=undefined;analyser.disconnect();onLevel(0);};
        this.meterFrame=requestAnimationFrame(meter);
      }
      this.source=source;this.finish=()=>resolve(false);source.onended=()=>{if(this.source!==source)return;this.clearMeter?.();this.clearMeter=undefined;source.disconnect();this.source=undefined;this.finish=undefined;resolve(true);};source.start();onStart();});
  }
  stop(){this.epoch++;this.clearMeter?.();this.clearMeter=undefined;if(this.source){this.source.onended=null;this.source.stop();this.source.disconnect();this.source=undefined;}this.finish?.();this.finish=undefined;}
  async close(){this.stop();await this.context?.close();this.context=undefined;}
}
