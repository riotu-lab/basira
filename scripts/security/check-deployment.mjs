// Never log secret values or matching text. Fails closed before deployment.
import {existsSync,readdirSync,readFileSync} from 'node:fs';
import {join,relative} from 'node:path';
import {parse} from 'dotenv';
const root=process.cwd(),env={...process.env};
for(const file of ['.env','.env.local','.env.production','.env.production.local'])if(existsSync(file))Object.assign(env,parse(readFileSync(file)));
const errors=[];
const secretName=/(?:API_KEY|SECRET|PASSWORD|PRIVATE_KEY|ACCESS_TOKEN|AUTH_TOKEN|REST_TOKEN|READ_WRITE_TOKEN|RAG_TOKEN|NGROK_AUTHTOKEN|REDIS_URL|DATABASE_URL)(?:_PROD|_DEV)?$/i;
const values=Object.entries(env).filter(([name,value])=>secretName.test(name)&&typeof value==='string'&&value.length>=12);
// Vercel supplies public deployment metadata automatically for Vite projects.
// Keep this exact: never permit arbitrary VITE_VERCEL_* names or credentials.
const publicClientNames=new Set([
 'VITE_VERCEL_DEPLOYMENT',
 ...['GIT_REPO_ID','ENV','GIT_PULL_REQUEST_ID','OBSERVABILITY_CLIENT_CONFIG',
 'GIT_COMMIT_SHA','URL','GIT_COMMIT_AUTHOR_NAME','GIT_PREVIOUS_SHA','PROJECT_ID',
 'PROJECT_PRODUCTION_URL','DEPLOYMENT_ID','GIT_REPO_OWNER','GIT_COMMIT_AUTHOR_LOGIN',
 'TARGET_ENV','GIT_PROVIDER','GIT_COMMIT_REF','GIT_REPO_SLUG','GIT_COMMIT_MESSAGE']
 .map(name=>`VITE_VERCEL_${name}`),
]);
for(const name of Object.keys(env))if(name.startsWith('VITE_')&&!publicClientNames.has(name))errors.push(`Unapproved client-visible environment variable: ${name}`);
function* files(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){const p=join(dir,entry.name);if(entry.isSymbolicLink()){errors.push(`Unexpected symlink in deployment output: ${relative(root,p)}`);continue;}if(entry.isDirectory())yield* files(p);else if(entry.isFile())yield p;}}
function scan(dir,frontend){
 let count=0;
 for(const path of files(dir)){
  count++;const name=relative(dir,path).replaceAll('\\','/');
  if(/(?:^|\/)(?:\.env(?:\.[^/]*)?|docs|deliverables|\.local|\.aws|\.codex|\.agents|\.git)(?:\/|$)/i.test(name)||/\.(?:pem|key|p12|pfx|pptx?|docx?|sqlite(?:-wal|-shm)?)$/i.test(name)||(frontend&&/\.(?:md|map)$/i.test(name)))errors.push(`Private or development file in deployment output: ${name}`);
  const bytes=readFileSync(path);
  for(const [key,value] of values){const forms=[value,encodeURIComponent(value),JSON.stringify(value).slice(1,-1)];if(forms.some(v=>bytes.includes(Buffer.from(v))))errors.push(`Credential value (${key}) detected in ${frontend?'frontend':'function'} output: ${name}`);}
  // Detect common embedded credentials even when absent from the local environment.
  if(/(?:sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----(?:\\n|\s)+[A-Za-z0-9+/]{32,})/.test(bytes.toString('utf8')))errors.push(`Credential-like material detected in output: ${name}`);
 }
 return count;
}
if(!existsSync('dist')){console.error('Deployment safety check requires a completed frontend build.');process.exit(1);}
const frontendFiles=scan('dist',true);
let functionFiles=null;
if(process.argv.includes('--functions')){if(!existsSync('.vercel/output/functions'))errors.push('Function output is missing; build the Vercel bundle before checking it.');else functionFiles=scan('.vercel/output/functions',false);}
if(errors.length){for(const message of [...new Set(errors)])console.error(message);process.exit(1);}
console.log(JSON.stringify({deploymentSafety:'passed',frontendFiles,functionFiles,credentialValuesChecked:values.length,scope:functionFiles===null?'local frontend output; hosted function bundle not inspected':'local frontend and function output'}));
