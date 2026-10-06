import {readFileSync,writeFileSync,existsSync,mkdirSync,chmodSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {parse} from 'dotenv';
import {pathToFileURL} from 'node:url';

// No production URLs, PALs, Redis/Vector/Blob credentials or VITE_* settings enter this environment.
const allowed=['OPENAI_API_KEY','OPENAI_MODEL','OPENAI_TRANSCRIBE_MODEL','OPENAI_TTS_MODEL',
 'OPENAI_AUDIO_ASSESSMENT_MODEL','OPENAI_VOICE_AR','OPENAI_VOICE_EN','TAVUS_API_KEY','TAVUS_FACE_ID','NGROK_AUTHTOKEN'];
export function localEnvironment(credentials,token,avatar=true){
 if(token.length<32)throw Error('Local retrieval setup has not completed.');
 const env={PATH:process.env.PATH,HOME:'/home/basira',NODE_ENV:'production',
  HOST:'0.0.0.0',PORT:'3000',AI_PROVIDER:'openai',AVATAR_PROVIDER:'tavus',
  BASIRA_ENV:'development',BASIRA_DEV_INSTANCE:'docker-local',TRAINING_STORE:'sqlite',AI_AUDIT_STORE:'sqlite',
  CONTENT_RETRIEVAL_ENABLED:'true',CONTENT_RAG_URL:'http://retrieval:8000',CONTENT_RAG_TOKEN:token};
 for(const key of allowed)if(credentials[key])env[key]=credentials[key];
 if(avatar){
  const missing=['OPENAI_API_KEY','TAVUS_API_KEY','TAVUS_FACE_ID','NGROK_AUTHTOKEN'].filter(key=>!env[key]);
  if(missing.length)throw Error('Add these values to .env for avatar mode: '+missing.join(', ')+'. For interface/text-only startup set BASIRA_DOCKER_AVATAR=false.');
 }
 return env;
}
export function run(){
 const avatar=process.env.BASIRA_DOCKER_AVATAR!=='false';
 const credentials=parse(readFileSync('/run/secrets/judge_credentials'));
 const token=readFileSync('/config/retrieval-token','utf8').trim();
 const env=localEnvironment(credentials,token,avatar);
 // Compose file secrets retain host permissions. Read once, then drop root before launching code or network calls.
 if(process.getuid?.()===0){process.setgroups([]);process.setgid(10001);process.setuid(10001);}
 mkdirSync('/app/.local',{recursive:true});
 // Persist only the development PAL and callback URL between container restarts.
 const state='/app/.local/docker.env';
 if(!existsSync(state))writeFileSync(state,'# Container-local avatar configuration\n',{mode:0o600});
 chmodSync(state,0o600);
 const args=['--import','tsx',avatar?'scripts/dev/avatar-dev.ts':'server/index.ts'];
 const child=spawn(process.execPath,args,{cwd:'/app',env,stdio:'inherit'});
 let stopping=false;
 const stop=()=>{if(stopping)return;stopping=true;child.kill('SIGTERM');};
 process.once('SIGTERM',stop);process.once('SIGINT',stop);
 child.on('error',()=>{console.error('Could not start the local application.');process.exitCode=1;});
 child.on('exit',(code)=>{process.exitCode=code??0;});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{run();}catch(error){console.error(error instanceof Error&&error.message.startsWith('Add these values')?error.message:'Local container startup failed. Check the credentials file and completed reference-setup service.');process.exitCode=1;}
}
