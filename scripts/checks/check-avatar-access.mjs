import '../lib/output-dirs.mjs';
import {parse} from 'dotenv';import {readFileSync,existsSync,chmodSync} from 'node:fs';
const local=parse(readFileSync('.env'));
const path='/tmp/basira-production-check.env';
if(existsSync(path)){chmodSync(path,0o600);const deployed=parse(readFileSync(path));console.log('Production credential comparison:',deployed.LIVEAVATAR_API_KEY?(local.LIVEAVATAR_API_KEY===deployed.LIVEAVATAR_API_KEY?'matches':'differs'):'unavailable: CLI export did not include secret values');}
try{
 if(process.argv.includes('--credits')){const r=await fetch('https://api.liveavatar.com/v1/users/credits',{headers:{'X-API-KEY':local.LIVEAVATAR_API_KEY},signal:AbortSignal.timeout(15000)});const data=await r.json();console.log(JSON.stringify({stage:'balance',httpStatus:r.status,creditsLeft:data.data?.credits_left}));process.exit(r.ok?0:1);}
 const r=await fetch('https://api.liveavatar.com/v1/sessions/token',{method:'POST',headers:{'Content-Type':'application/json','X-API-KEY':local.LIVEAVATAR_API_KEY},body:JSON.stringify({mode:'LITE',avatar_id:local.LIVEAVATAR_AVATAR_ID,max_session_duration:60,video_settings:{quality:'high',encoding:'H264'}}),signal:AbortSignal.timeout(20000)});
 const body=await r.text();console.log(JSON.stringify({httpStatus:r.status,stage:'create_token_only_no_session_started',category:r.ok?'accepted':/credit|balance|quota/i.test(body)?'credits':r.status===401||r.status===403?'authentication':'session configuration',invalidKeyReported:/invalid.{0,20}(api.key|token)|unauthoriz|authentication/i.test(body),planRestrictionReported:/subscription|plan|tier|upgrade/i.test(body)}));

 if(r.ok&&process.argv.includes('--start-stop')){
  const token=JSON.parse(body).data?.session_token;
  try{const started=await fetch('https://api.liveavatar.com/v1/sessions/start',{method:'POST',headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});const detail=await started.text();console.log(JSON.stringify({stage:'start',httpStatus:started.status,category:started.ok?'accepted':/credit|balance|quota/i.test(detail)?'credits':started.status===401||started.status===403?'authentication':'session configuration'}));}
  finally{const stopped=await fetch('https://api.liveavatar.com/v1/sessions/stop',{method:'POST',headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(8000)});console.log(JSON.stringify({stage:'cleanup',httpStatus:stopped.status,confirmed:stopped.ok}));}
 }
}catch(e){console.log('network/DNS:',e.cause?.code||e.name);process.exitCode=1;}
