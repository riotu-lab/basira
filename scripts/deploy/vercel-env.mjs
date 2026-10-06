import {productionRetrievalValues} from './retrieval-env.mjs';
import {productionTrainingValues} from './training-env.mjs';
import '../lib/output-dirs.mjs';
// Explicit allowlist; values travel only over CLI stdin, never logs/arguments.
import {readFileSync} from 'node:fs';
import {parse} from 'dotenv';
import {spawn} from 'node:child_process';
const values=parse(readFileSync('.env'));
const serviceNames=['CRON_SECRET','BLOB_READ_WRITE_TOKEN','AI_PROVIDER','DEEPSEEK_API_KEY','DEEPSEEK_MODEL','OPENAI_API_KEY','OPENAI_MODEL','OPENAI_TRANSCRIBE_MODEL','OPENAI_AUDIO_ASSESSMENT_MODEL','OPENAI_TTS_MODEL','OPENAI_VOICE_AR','OPENAI_VOICE_EN','LIVEAVATAR_API_KEY','LIVEAVATAR_AVATAR_ID','LIVEAVATAR_LICENSE_CONFIRMED','LIVEAVATAR_ENABLE_LIVE','AVATAR_PROVIDER','TAVUS_API_KEY','TAVUS_FACE_ID','TAVUS_PAL_ID','TAVUS_FULL_PAL_ID'];
const auditNames=['AI_AUDIT_ENABLED','AI_AUDIT_STORE','AI_AUDIT_RETENTION_DAYS','AI_AUDIT_MAX_RECORDS','AI_AUDIT_MAX_BYTES','AI_REQUEST_UNITS_PER_MINUTE','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN'];
// Hosted audit data must use persistent storage, never a function's temporary filesystem.
values.AI_AUDIT_ENABLED='true';values.AI_AUDIT_STORE='redis';
const training=productionTrainingValues(values);Object.assign(values,training);
const trainingNames=Object.keys(training);
const retrieval=productionRetrievalValues(values);Object.assign(values,retrieval);
const retrievalNames=Object.keys(retrieval);
if(process.argv.includes('--retrieval-only')&&!retrievalNames.length)throw Error('Configure Upstash Vector or explicit production Chroma credentials before deploying retrieval configuration.');
const names=process.argv.includes('--retrieval-only')?retrievalNames:process.argv.includes('--training-only')?trainingNames:process.argv.includes('--audit-only')?auditNames.slice(0,2):[...serviceNames,...auditNames,...trainingNames,...retrievalNames];
for(const name of names){
 if(!values[name])continue;
 const code=await new Promise(resolve=>{
  const child=spawn('vercel',['env','add',name,'production','--force',...(process.env.BASIRA_VERCEL_CONFIG?['--global-config',process.env.BASIRA_VERCEL_CONFIG]:[])],{stdio:['pipe','ignore','ignore']});
  child.once('error',()=>resolve(1));child.once('exit',resolve);child.stdin.on('error',()=>{});child.stdin.end(values[name]);
 });
 if(code!==0){console.error(`Could not configure ${name}; no value was logged.`);process.exit(1);}
 console.log(`Configured ${name} for production.`);
}
