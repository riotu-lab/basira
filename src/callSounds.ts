export type CallCue='calling'|'connected'|'ended'|'micOn'|'micOff'|'cameraOn'|'cameraOff'|'reconnect'|'interrupt';
const notes:Record<CallCue,number[]>={calling:[392,523],connected:[523,659],ended:[440,330],micOn:[660],micOff:[440],cameraOn:[587,784],cameraOff:[587,392],reconnect:[392,494,587],interrupt:[350]};
/** Local earcons with a soft attack and a short decay: no media downloads, model calls or audio recording. */
class CallSounds{
 private context?:AudioContext;private sources=new Set<OscillatorNode>();
 enabled(){try{return localStorage.getItem('basira.call-sounds.v1')!=='off';}catch{return true;}}
 setEnabled(value:boolean){try{localStorage.setItem('basira.call-sounds.v1',value?'on':'off');}catch{}if(!value)this.stop();}
 unlock(){if(!this.enabled())return;try{this.context??=new AudioContext();void this.context.resume().catch(()=>{});}catch{}}
 play(cue:CallCue){if(!this.enabled())return;this.unlock();const c=this.context;if(!c||c.state!=='running')return;this.stop();const start=c.currentTime;
 for(const [i,hz] of notes[cue].entries()){const oscillator=c.createOscillator(),gain=c.createGain();oscillator.type='sine';oscillator.frequency.value=hz;const at=start+i*.10;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.07,at+.012);gain.gain.exponentialRampToValueAtTime(.0001,at+.13);oscillator.connect(gain);gain.connect(c.destination);this.sources.add(oscillator);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();this.sources.delete(oscillator);};oscillator.start(at);oscillator.stop(at+.15);}
 }
 stop(){for(const source of this.sources){try{source.stop();}catch{}}this.sources.clear();}
}
export const callSounds=new CallSounds();
