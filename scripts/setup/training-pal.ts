import {readFileSync,writeFileSync} from 'node:fs';
import {trainingGatewayKey} from '../../server/trainingGateway.js';
import {trainingRouting} from '../../server/trainingEnvironment.js';
import {rules} from '../../server/model.js';
export function saveEnvValues(values:Record<string,string>,path='.env'){
  let content=readFileSync(path,'utf8');
  for(const [name,value] of Object.entries(values)){
    if(!/^[A-Z0-9_]+$/.test(name)||/[\r\n]/.test(value))throw Error('Invalid environment entry.');
    const pattern=new RegExp(`^${name}=.*$`,'m'),line=`${name}=${value}`;
    content=pattern.test(content)?content.replace(pattern,()=>line):content.replace(/\n?$/,`\n${line}\n`);
  }
  writeFileSync(path,content,{mode:0o600});
}
export async function configureTrainingPal(env:NodeJS.ProcessEnv,update=false,request:typeof fetch=fetch){
  const route=trainingRouting(env);
  if(!env.TAVUS_API_KEY||!env.TAVUS_FACE_ID||!route.publicUrl)throw Error('Configure Tavus credentials and the public callback URL for this environment in .env.');
  const suffix=route.environment==='development'?'DEV':route.environment==='production'?'PROD':'PREVIEW';
  const conversational_flow={turn_detection_model:'sparrow-2',turn_taking_patience:'high',pal_interruptibility:'high',idle_engagement:'off'};
  const llm={model:`basira-training-${route.scope}`,base_url:new URL('/api/training-llm',route.publicUrl).toString(),api_key:trainingGatewayKey(env),speculative_inference:false};
  async function call(path:string,method='GET',body?:unknown){
    let r:Response;try{r=await request('https://tavusapi.com/v2/'+path,{method,headers:{'x-api-key':env.TAVUS_API_KEY!,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});}catch{throw Error('Tavus configuration network request failed.');}
    if(!r.ok)throw Error(`Tavus configuration failed: HTTP ${r.status}. No subscription changed. Maker conflicts are not overwritten.`);
    const raw=await r.text();return raw?JSON.parse(raw):{};
  }
  let palId=route.palId;
  if(palId){
    const current=await call(`pals/${encodeURIComponent(palId)}`);
    const name=`Basira source-guided training (${route.environment})`;
    const normalizedName=(value:unknown)=>typeof value==='string'?value.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim():'';
    if(current.pipeline_mode!=='full'||!current.system_prompt?.includes(rules)||(normalizedName(current.pal_name)!==normalizedName(name)&&!(route.environment==='production'&&normalizedName(current.pal_name)===normalizedName('Basira source-guided training'))))throw Error('Refusing to modify a PAL that does not belong to this training environment.');
    if(!update){if(current.layers?.llm?.base_url!==llm.base_url||current.layers?.llm?.model!==llm.model||current.layers?.llm?.speculative_inference!==false)throw Error('Callback URL changed or configuration is outdated. Stop calls for this environment, then rerun setup with --update.');return {palId,key:`TAVUS_TRAINING_PAL_ID_${suffix}`,environment:route.environment};}
    await call(`pals/${encodeURIComponent(palId)}`,'PATCH',[
      {op:'add',path:'/layers/llm',value:llm},
      {op:'add',path:'/layers/conversational_flow',value:conversational_flow},
      {op:'replace',path:'/pal_name',value:name},
    ]);
  }else{
    const data=await call('pals','POST',{
      pal_name:`Basira source-guided training (${route.environment})`,pipeline_mode:'full',default_face_id:env.TAVUS_FACE_ID,
      system_prompt:rules+' Deliver the custom LLM response exactly. The endpoint controls the source-guided discussion. Do not add independent answers or infer personal attributes from camera or voice.',
      greeting:'',dynamic_greeting:false,languages:['ar','en'],layers:{llm,conversational_flow,perception:{emotion_recognition:'limited'}},
    });
    if(typeof data.pal_id!=='string')throw Error('Provider returned no PAL ID.');palId=data.pal_id;
  }
  return {palId:palId!,key:`TAVUS_TRAINING_PAL_ID_${suffix}`,environment:route.environment};
}
