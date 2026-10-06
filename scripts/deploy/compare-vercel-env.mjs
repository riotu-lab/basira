import '../lib/output-dirs.mjs';
// Read-only comparison. Credentials stay in memory; output contains booleans only.
import {readFileSync,writeFileSync} from 'node:fs';import {parse} from 'dotenv';
const local=parse(readFileSync('.env')),project=JSON.parse(readFileSync('.vercel/project.json'));
const auth=JSON.parse(readFileSync('/home/coder/.local/share/com.vercel.cli/auth.json'));
async function get(path){const r=await fetch('https://api.vercel.com'+path,{headers:{Authorization:`Bearer ${auth.token}`},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Vercel HTTP '+r.status);return r.json();}
try{
 const data=await get(`/v9/projects/${project.projectId}/env?teamId=${project.orgId}`);
 const rows=[];
 for(const name of ['LIVEAVATAR_API_KEY','LIVEAVATAR_AVATAR_ID','LIVEAVATAR_ENABLE_LIVE','LIVEAVATAR_LICENSE_CONFIRMED','OPENAI_API_KEY']){
  const env=data.envs?.find(e=>e.key===name&&e.target?.includes('production')&&!e.gitBranch);
  if(!env){rows.push({name,status:'missing in production'});continue;}
  const v=await get(`/v1/projects/${project.projectId}/env/${env.id}?teamId=${project.orgId}`);
  rows.push({name,status:typeof v.value!=='string'||!v.value?'comparison unavailable':v.value===local[name]?'exact match':'DIFFERENT',decrypted:v.decrypted===true,updatedAt:env.updatedAt});
 }
 console.log(JSON.stringify(rows,null,2));writeFileSync('artifacts/reports/environment-comparison.json',JSON.stringify({date:new Date().toISOString(),project:project.projectName,rows},null,2));
}catch(e){console.log('Configuration comparison unavailable:',e.message?.startsWith('Vercel HTTP')?e.message:e.cause?.code||e.name);process.exitCode=1;}
