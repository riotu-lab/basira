// Creates a separate full-pipeline configuration; never modifies the Echo PAL.
import 'dotenv/config';
import {readFileSync,writeFileSync} from 'node:fs';
import {rules,evidenceScope} from '../../server/model.js';
const key=process.env.TAVUS_API_KEY,face=process.env.TAVUS_FACE_ID;
if(!key||!face)throw Error('Add TAVUS_API_KEY and TAVUS_FACE_ID to local .env first.');
if(process.env.TAVUS_FULL_PAL_ID){console.log('Video PAL already configured; no change made.');process.exit(0);}
const response=await fetch('https://tavusapi.com/v2/pals',{method:'POST',headers:{'x-api-key':key,'Content-Type':'application/json'},body:JSON.stringify({
 pal_name:'Basira camera and voice practice',pipeline_mode:'full',default_face_id:face,
 system_prompt:`${rules} ${evidenceScope} Only describe visible objects when relevant to an explicit user request. Never identify a person, infer emotions, beliefs, personality or other sensitive attributes from their camera or voice. Do not score the user; Basira performs evidence-based review separately.`,
 languages:['ar','en'],greeting:'',dynamic_greeting:false,
 layers:{perception:{perception_model:'raven-1',emotion_recognition:'limited',visual_awareness_queries:['Describe only objects or text deliberately shown by the user when relevant. Do not infer personal traits, identity, emotion or religion.']}}
}),signal:AbortSignal.timeout(20000)});
if(!response.ok)throw Error(`Video PAL configuration failed: HTTP ${response.status}. No subscription was changed.`);
const data=await response.json();if(typeof data.pal_id!=='string')throw Error('Missing PAL identifier');
let content=readFileSync('.env','utf8');const line=`TAVUS_FULL_PAL_ID=${data.pal_id}`;
content=/^TAVUS_FULL_PAL_ID=.*$/m.test(content)?content.replace(/^TAVUS_FULL_PAL_ID=.*$/m,()=>line):content.replace(/\n?$/,`\n${line}\n`);
writeFileSync('.env',content,{mode:0o600});console.log('Separate video-call PAL configured. No live session started; restart the backend.');
