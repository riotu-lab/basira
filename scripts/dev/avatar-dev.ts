import 'dotenv/config';
import {spawn,type ChildProcess} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import * as ngrok from '@ngrok/ngrok';
import {createCallbackProxy} from './callback-proxy.js';
import {configureTrainingPal,saveEnvValues} from '../setup/training-pal.js';
import {trainingGatewayKey} from '../../server/trainingGateway.js';
import {trainingScope} from '../../server/trainingEnvironment.js';

async function portAvailable(port:number){
  const probe=createServer();
  try{await new Promise<void>((resolve,reject)=>{probe.once('error',reject);probe.listen(port,'127.0.0.1',resolve);});}
  catch{throw Error(`Port ${port} is occupied or unavailable. Stop your own previous dev server or choose PORT=<free port>; no process was terminated.`);}
  finally{if(probe.listening)await new Promise<void>(resolve=>probe.close(()=>resolve()));}
}
async function main(){
  if(process.env.VERCEL)throw Error('The development tunnel cannot run in a hosted deployment.');
  if(!process.env.NGROK_AUTHTOKEN)throw Error('Local voice setup needs NGROK_AUTHTOKEN in .env. Obtain it from https://dashboard.ngrok.com/get-started/your-authtoken. Do not paste it into chat.');
  const port=Number(process.env.PORT||3000);
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT must be between 1 and 65535.');
  const env={...process.env,BASIRA_ENV:'development',TRAINING_STORE:'sqlite',AI_AUDIT_STORE:'sqlite'};
  await portAvailable(port);
  const proxy=createCallbackProxy(port,env);
  let listener:ngrok.Listener|undefined,child:ChildProcess|undefined,closing=false;
  async function cleanup(){
    if(closing)return;closing=true;
    if(child&&child.exitCode===null&&child.signalCode===null){const exited=once(child,'exit');child.kill('SIGTERM');await Promise.race([exited,new Promise(resolve=>setTimeout(resolve,8000))]);if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');}
    await listener?.close().catch(()=>{});proxy.closeAllConnections();if(proxy.listening)await new Promise<void>(resolve=>proxy.close(()=>resolve()));
  }
  const stop=()=>void cleanup();process.once('SIGINT',stop);process.once('SIGTERM',stop);
  try{
    await new Promise<void>((resolve,reject)=>{proxy.once('error',reject);proxy.listen(0,'127.0.0.1',resolve);});
    const address=proxy.address();if(!address||typeof address==='string')throw Error('Callback proxy could not listen.');
    listener=await ngrok.forward({addr:`127.0.0.1:${address.port}`,authtoken:process.env.NGROK_AUTHTOKEN,inspect:'false'});
    if(closing){await listener.close();return;}
    const publicUrl=listener.url();if(!publicUrl?.startsWith('https://'))throw Error('The tunnel did not provide an HTTPS endpoint.');
    const runtime={...env,BASIRA_PUBLIC_URL_DEV:publicUrl};
    // Only the DEV PAL may be updated, including when the tunnel URL changes.
    const configured=await configureTrainingPal(runtime,true);
    const settings={BASIRA_PUBLIC_URL_DEV:publicUrl,TAVUS_TRAINING_PAL_ID_DEV:configured.palId,TRAINING_STORE:'sqlite',BASIRA_ENV:'development'};
    saveEnvValues(settings);
    if(closing)return;
    child=spawn(process.execPath,['--import','tsx','server/index.ts'],{env:{...runtime,...settings,PORT:String(port)},stdio:'inherit'});
    child.on('exit',()=>void cleanup());
    child.on('error',()=>{console.error('Could not launch the local backend.');void cleanup();});
    let local:{instance:string;scope:string}|undefined;
    const headers={Authorization:`Bearer ${trainingGatewayKey(runtime)}`};
    for(let i=0;i<60&&!closing;i++){
      try{const r=await fetch(`http://127.0.0.1:${port}/api/training-llm/health`,{method:'POST',headers,signal:AbortSignal.timeout(1000)});if(r.ok){local=await r.json();break;}}catch{}
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    if(!local)throw Error('Local callback did not become ready.');
    const remote=await fetch(new URL('/api/training-llm/health',publicUrl),{method:'POST',headers,signal:AbortSignal.timeout(15000)});
    const checked=await remote.json();
    if(!remote.ok||checked.instance!==local.instance||checked.scope!==trainingScope(runtime))throw Error('The public callback does not reach this local backend.');
    console.log(`Local avatar development ready: http://localhost:${port}/?app=training`);
    console.log('Tavus callbacks reach this exact local backend. Session data is local and isolated from production. No avatar session has been started. Keep this terminal open; Ctrl+C stops the owned backend and tunnel.');
    await once(child,'exit');
  }finally{await cleanup();process.off('SIGINT',stop);process.off('SIGTERM',stop);}
}
main().catch(error=>{
  // ngrok/provider errors may embed connection metadata. Print only our own safe messages.
  const message=error instanceof Error?error.message:'';
  const safe=['Local voice setup needs','Port ','PORT must','The development tunnel','The public callback','Local callback','The tunnel did not','Configure Tavus','Refusing to modify','Tavus configuration','Callback URL changed','Provider returned no'];
  console.error(safe.some(prefix=>message.startsWith(prefix))?message:'Local avatar setup failed. Check the ngrok account/token and outbound connectivity; no credentials were logged.');process.exitCode=1;
});
