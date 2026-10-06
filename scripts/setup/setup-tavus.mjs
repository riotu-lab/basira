import '../lib/output-dirs.mjs';
// Credentials stay in .env; only stock names/IDs and configuration status are printed.
import {readFileSync,writeFileSync} from 'node:fs';
import {parse} from 'dotenv';
const env=parse(readFileSync('.env','utf8'));
if(!env.TAVUS_API_KEY){console.error('Add TAVUS_API_KEY to local .env, then rerun. Never paste it into chat.');process.exit(1);}
async function call(path,method='GET',body){
 let r;try{r=await fetch(`https://tavusapi.com/v2/${path}`,{method,headers:{'x-api-key':env.TAVUS_API_KEY,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});}catch{throw Error('network/DNS: could not reach Tavus');}
 if(!r.ok){const detail=await r.text();throw Error(`${r.status===402||/credit|quota|balance/i.test(detail)?'credits':r.status===401||r.status===403?'authentication':'session configuration'}: HTTP ${r.status}`);}
 const raw=await r.text();return raw?JSON.parse(raw):{};
}
function save(values){
 // Reread to preserve any other credentials edited while requests were running.
 let content=readFileSync('.env','utf8');
 for(const [name,value] of Object.entries(values)){
  const line=new RegExp(`^${name}=.*$`,'m');const replacement=`${name}=${value}`;
  content=line.test(content)?content.replace(line,()=>replacement):content.replace(/\n?$/,`\n${replacement}\n`);
 }
 writeFileSync('.env',content,{mode:0o600});
}
try{
 if(!env.TAVUS_FACE_ID){
  const data=await call('faces?face_type=system');
  const faces=Array.isArray(data)?data:data.data||data.faces||[];
  console.log('Choose a stock face in the developer portal and save its ID as TAVUS_FACE_ID.');
  for(const face of faces.slice(0,30))console.log(JSON.stringify({name:face.face_name||face.replica_name,id:face.face_id||face.replica_id,status:face.status}));
  process.exitCode=1;
 }else{
  let palId=env.TAVUS_PAL_ID;
  if(palId){const pal=await call(`pals/${encodeURIComponent(palId)}`);if(pal.pipeline_mode!=='echo'||pal.greeting||pal.dynamic_greeting)throw Error('session configuration: choose a silent echo PAL, not a full agent');}
  else{
   // Creates configuration only; no live conversation, custom face training or billing change.
   const data=await call('pals','POST',{pal_name:'Basira video renderer',pipeline_mode:'echo',default_face_id:env.TAVUS_FACE_ID,greeting:'',dynamic_greeting:false});
   palId=data.pal_id;if(typeof palId!=='string'||!palId)throw Error('session configuration: no PAL ID returned');
  }
  save({TAVUS_PAL_ID:palId,AVATAR_PROVIDER:'tavus'});
  console.log('Echo renderer configured in local .env.');
  if(process.argv.includes('--check-session')){
   let id;const evidence={date:new Date().toISOString(),kind:'Real provider session creation/end; no browser, audio or video verification',capSeconds:60,started:false,cleanup:'not_started'};
   try{
    const data=await call('conversations','POST',{pal_id:palId,face_id:env.TAVUS_FACE_ID,conversation_name:'Basira capped connectivity check',require_auth:true,max_participants:2,dynamic_greeting:false,properties:{max_call_duration:60,participant_left_timeout:0,participant_absent_timeout:30}});
    id=data.conversation_id;evidence.started=typeof id==='string'&&!!id;
    evidence.roomReturned=typeof data.conversation_url==='string';evidence.privateTokenReturned=typeof data.meeting_token==='string';
    if(!evidence.started)throw Error('session configuration: missing conversation ID');
   }catch(error){evidence.error=error.message;process.exitCode=1;}
   finally{
    if(id){try{await call(`conversations/${encodeURIComponent(id)}/end`,'POST');evidence.cleanup='confirmed';}catch(error){evidence.cleanup='unconfirmed';evidence.cleanupError=error.message;process.exitCode=1;}}
    writeFileSync('artifacts/reports/tavus-session-check.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
   }
  }else console.log('Restart Basira and choose Voice + avatar. Sessions are capped at 60 seconds. No live session was started.');
 }
}catch(error){console.error(error.message);process.exitCode=1;}
