import '../lib/output-dirs.mjs';
// Explicit opt-in live test: consumes existing credits. Synthetic user answers,
// real providers; this is not a browser, microphone, or human quality test.
import 'dotenv/config';
import {writeFileSync,mkdirSync} from 'node:fs';
import {ModelProvider} from '../../server/model';
import {AvatarProtocol} from '../../src/live';
import {runtimeIdentity,connectivity} from '../../server/connectivity';
import type {Turn} from '../../src/content';

const report:{[key:string]:unknown}={date:new Date().toISOString(),kind:'real providers with synthetic user answers',runtime:runtimeIdentity(),browserMediaVerified:false};
console.log('Live check runtime:',JSON.stringify(report.runtime));
report.connectivity=await connectivity();console.log('Connectivity:',JSON.stringify(report.connectivity));
const model=new ModelProvider(process.env);
let token:string|undefined,socket:WebSocket|undefined,protocol:AvatarProtocol|undefined;
const deadline=AbortSignal.timeout(50000);
function failure(e:unknown){const err=e as {code?:string|number;status?:number;cause?:{code?:string};name?:string};const code=String(err.code||'');return {category:err.cause?.code?'network/DNS':err.status===401||err.status===403?'authentication':err.status===402?'credits':code.includes('auth')?'authentication':code.includes('credit')?'credits':'session configuration or provider failure',code:err.cause?.code||err.code||err.name,httpStatus:err.status};}
async function avatar(path:string,body?:object,signal=deadline){
  const res=await fetch(`https://api.liveavatar.com/v1/sessions/${path}`,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{'X-API-KEY':process.env.LIVEAVATAR_API_KEY!})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.any([signal,AbortSignal.timeout(10000)])});
  if(!res.ok){const body=await res.text();const code=/credit|balance/i.test(body)?'credits_unavailable':/api.key|unauthorized|authentication/i.test(body)?'authentication_failed':'provider_rejected';throw Object.assign(new Error(),{status:res.status,code});}
  return path==='stop'?{}:res.json();
}
try{
  if(!process.env.LIVEAVATAR_API_KEY||!process.env.LIVEAVATAR_AVATAR_ID||!model.ready||process.env.LIVEAVATAR_ENABLE_LIVE!=='true')throw Object.assign(new Error(),{code:'not_configured'});
  try{
    const created=await avatar('token',{mode:'LITE',avatar_id:process.env.LIVEAVATAR_AVATAR_ID,max_session_duration:60,video_settings:{quality:'high',encoding:'H264'}});
    token=created.data?.session_token;if(!token)throw Object.assign(new Error(),{code:'missing_token'});
    const started=await avatar('start');
    report.avatar={started:true,mediaEndpointsPresent:!!(started.data?.livekit_url&&started.data?.livekit_client_token&&started.data?.ws_url),capSeconds:60};
    if(started.data?.ws_url){
      socket=new WebSocket(started.data.ws_url);protocol=new AvatarProtocol(e=>socket!.send(JSON.stringify(e)));
      socket.onmessage=e=>{try{protocol!.handle(JSON.parse(String(e.data)));}catch{}};
      socket.onerror=()=>{};
    }
  }catch(e){report.avatar=failure(e);}
  if(socket&&protocol){
    const readyDeadline=Date.now()+15000;
    while(!protocol.ready&&socket.readyState!==WebSocket.CLOSED&&Date.now()<readyDeadline&&!deadline.aborted)await new Promise(resolve=>setTimeout(resolve,100));
  }
  if(protocol?.ready){
    try{
      const pcm=await model.speech('en','Welcome to Basira. We practise respectful dialogue.',deadline);
      const audio=pcm.buffer.slice(pcm.byteOffset,pcm.byteOffset+pcm.byteLength) as ArrayBuffer;
      const spoken=protocol.speak(audio,()=>{report.avatarSpeechStarted=true;});
      const aborted=new Promise<never>((_,reject)=>deadline.addEventListener('abort',()=>reject(Object.assign(new Error(),{code:'test_deadline'})),{once:true}));
      report.avatarSpeechCompleted=await Promise.race([spoken,aborted]);
    }catch(e){report.avatarSpeech=failure(e);}
  }else report.avatarSpeech='not tested: avatar websocket not ready';

  // The text loop remains testable if the avatar account is unavailable.
  const loops=[];
  for(const language of ['en','ar'] as const){
    try{
      const question=await model.converse(language,[],deadline);
      const original=language==='ar'?'الإيمان في حياتي يعني أن أحاول مساعدة الناس. لكن من يختلف معي فهو جاهل ولا يستحق أن أستمع إليه.':'Faith in my daily life means trying to help people. But anyone who disagrees with me is ignorant and not worth listening to.';
      const turns:Turn[]=[{id:'q1',role:'assistant',text:question,at:Date.now(),delivery:'text'},{id:'a1',role:'user',text:original,at:Date.now(),delivery:'text'}];
      const feedback=await model.feedback(language,turns,deadline);
      const finding=feedback.findings.find(f=>f.criterion==='respect')||feedback.findings[0];
      if(!finding){loops.push({language,question,feedback,retry:'not run: no supported finding'});continue;}
      const retry:Turn={id:'a2',role:'user',text:language==='ar'?'بالنسبة لي يظهر الإيمان في مساعدة الناس. قد تختلف تجربتك عن تجربتي؛ ما الجانب الذي تريد أن أفهمه؟':'For me, faith shows up in helping people. Your experience may differ; which part would you like me to understand?',at:Date.now(),delivery:'text'};
      const comparison=await model.compare(language,finding.criterion,turns[0],turns[1],retry,deadline);
      loops.push({language,question,original,retry:retry.text,feedback,comparison,evidenceValidation:'passed'});
    }catch(e){loops.push({language,error:failure(e)});}
  }
  report.loops=loops;
} catch(e){report.error=failure(e);}
finally{
  protocol?.close();socket?.close();
  if(token){
    report.cleanup='unconfirmed';
    for(let attempt=0;attempt<2;attempt++){
      try{await avatar('stop',undefined,AbortSignal.timeout(5000));report.cleanup='provider acknowledged stop';break;}
      catch(e){report.cleanupError=failure(e);}
    }
  }else report.cleanup='no session token created';
  mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/reports/live-check.json',JSON.stringify(report,null,2),{mode:0o600});
  // Never print provider tokens, endpoints containing tokens, or response bodies.
  console.log('Live check:',JSON.stringify({avatar:report.avatar,loops:(report.loops as any[])?.map(l=>({language:l.language,evidenceValidation:l.evidenceValidation,error:l.error})),speech:report.avatarSpeechCompleted||report.avatarSpeech,cleanup:report.cleanup,cleanupError:report.cleanupError,error:report.error}));
}
