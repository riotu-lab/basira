// Reads local credentials without printing them. --start-stop explicitly uses a capped live session.
import 'dotenv/config';
const runtimeArg=process.argv.find(arg=>arg.startsWith('--app='));
if(runtimeArg){
 const base=new URL(runtimeArg.slice(6));
 if(!['http:','https:'].includes(base.protocol))throw Error('Use an HTTP(S) app URL');
 try{
  const r=await fetch(new URL('/api/config',base),{signal:AbortSignal.timeout(12000)});
  const data=await r.json();
  console.log(JSON.stringify({stage:'running_app',status:r.status,provider:data.avatar?.provider,configured:data.avatar?.configured,missing:data.avatar?.missing,localConfiguredProvider:process.env.AVATAR_PROVIDER||'liveavatar'}));
 }catch(e){console.log(JSON.stringify({stage:'running_app',error:e.cause?.code||e.name}));process.exitCode=1;}
 process.exit(process.exitCode||0);
}
const key=process.env.TAVUS_API_KEY;
const live=process.argv.includes('--start-stop');
const durationArg=process.argv.find(arg=>arg.startsWith('--seconds='));
const seconds=durationArg?Number(durationArg.split('=')[1]):60;
if(![60,120].includes(seconds)){console.error('Use --seconds=60 or --seconds=120.');process.exit(1);}
const missing=['TAVUS_API_KEY','TAVUS_PAL_ID','TAVUS_FACE_ID'].filter(k=>!process.env[k]);
if(missing.length){console.log(JSON.stringify({stage:'configuration',missing}));process.exit(1);}
const clean=s=>String(s).replaceAll(key,'[redacted]').replace(/https?:\/\/\S+/g,'[URL redacted]').replace(/\b[A-Za-z0-9_-]{28,}\b/g,'[identifier redacted]');
async function request(stage,path,method='GET',body){
 try{
  const r=await fetch('https://tavusapi.com/v2/'+path,{method,headers:{'x-api-key':key,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
  const raw=await r.text();let data;try{data=JSON.parse(raw)}catch{data={};}
  console.log(JSON.stringify({stage,status:r.status,ok:r.ok,...(!r.ok?{providerError:clean(raw).slice(0,1400)}:{})}));
  if(!r.ok)process.exitCode=1;
  return {ok:r.ok,data};
 }catch(e){console.log(JSON.stringify({stage,category:'network/DNS',code:e.cause?.code||e.name}));process.exitCode=1;return {ok:false,data:{}};}
}
let id;
try{
 const pal=await request('persona','pals/'+encodeURIComponent(process.env.TAVUS_PAL_ID));
 if(pal.ok){
  if(pal.data.pipeline_mode!=='echo'||pal.data.greeting||pal.data.dynamic_greeting||pal.data.layers?.transport?.microphone===true){console.log(JSON.stringify({stage:'persona_validation',error:'Not the required Basira echo configuration'}));process.exitCode=1;}
  else {
   const face=await request('avatar','faces/'+encodeURIComponent(process.env.TAVUS_FACE_ID));
   if(face.ok&&live){
    console.log(JSON.stringify({stage:'requested_configuration',maxCallDuration:seconds,participantAbsentTimeout:30}));
    const session=await request('create_session','conversations','POST',{pal_id:process.env.TAVUS_PAL_ID,face_id:process.env.TAVUS_FACE_ID,conversation_name:'Basira connection diagnostic',require_auth:true,max_participants:2,dynamic_greeting:false,properties:{max_call_duration:seconds,participant_left_timeout:0,participant_absent_timeout:30}});
    id=session.data.conversation_id;
    if(session.ok&&!id){console.log(JSON.stringify({stage:'create_session',error:'missing session identifier'}));process.exitCode=1;}
    if(!session.ok&&!id)console.log(`No session ID received. If creation timed out after acceptance, the provider-side ${seconds}-second cap remains the cleanup backstop.`);
   }else if(face.ok)console.log('Read-only checks passed. Use --start-stop to test live session creation (60-second cap; immediate stop).');
  }
 }
}finally{
 if(id){
  let stop=await request('cleanup','conversations/'+encodeURIComponent(id)+'/end','POST');
  if(!stop.ok)stop=await request('cleanup_retry','conversations/'+encodeURIComponent(id)+'/end','POST');
  if(!stop.ok)console.log(`Cleanup not confirmed. Provider-side session cap: ${seconds} seconds.`);
 }
}
