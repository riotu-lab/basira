import '../lib/output-dirs.mjs';
import fs from 'node:fs';
import dotenv from 'dotenv';
const local=fs.existsSync('.env')?dotenv.parse(fs.readFileSync('.env')):{};
const settings={...local,...process.env};
for(const name of ['DEEPSEEK_API_KEY','OPENAI_API_KEY','TAVUS_API_KEY','TAVUS_PAL_ID','TAVUS_FACE_ID','LIVEAVATAR_API_KEY','LIVEAVATAR_AVATAR_ID'])console.log(`${name}: ${settings[name]?'configured':'missing'}`);
console.log(`Avatar license confirmation: ${settings.LIVEAVATAR_LICENSE_CONFIRMED==='true'?'yes':'no'}`);
console.log(`Avatar enabled: ${settings.LIVEAVATAR_ENABLE_LIVE==='true'?'yes':'no'}`);
const port=settings.PORT||3000;
try{
 const response=await fetch(`http://127.0.0.1:${port}/api/health`,{signal:AbortSignal.timeout(3000)});
 const body=await response.json();
 console.log(`Basira HTTP health: ${response.ok&&body.service==='basira'?'passed':'unexpected response'}`);
}catch{console.log('Basira HTTP health: not reachable from this process (server stopped or networking restricted).');}
// Read-only process ownership check; no command arguments or environment values.
for(const entry of fs.readdirSync('/proc').filter(v=>/^\d+$/.test(v))){
 try{if(fs.readlinkSync(`/proc/${entry}/cwd`)===process.cwd()&&fs.readFileSync(`/proc/${entry}/comm`,'utf8').trim()==='node')console.log(`Basira workspace Node process: ${entry}${Number(entry)===process.pid?' (doctor)':''}`);}catch{}
}
try{const r=await fetch(`http://127.0.0.1:${port}/api/config`,{signal:AbortSignal.timeout(3000)});const c=await r.json();console.log(JSON.stringify({runningAvatarProvider:c.avatar?.provider||'legacy',avatarConfigured:c.avatar?.configured}));}catch{}
