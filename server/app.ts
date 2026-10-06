import {settleSpokenTurn} from './spokenTurn.js';
import {MEDIA_MAX_MB,IMAGE_MAX_MB,CONTENT_MAX_SECONDS} from '../src/mediaLimits.js';
import {RetainedMedia} from './retainedMedia.js';
import {ContentUploads} from './contentUploads.js';
import type {VideoFrame} from '../src/contentReviewTypes.js';
import {validateVisualFrames} from './visualCoaching.js';
import {auditPolicy} from './auditRetention.js';
import {RequestProtection} from './requestProtection.js';
import {attachContentPractice,openContentPractice} from './contentPractice.js';
import {trainingScope,trainingEnvironment,trainingRuntimeInstance} from './trainingEnvironment.js';
import {TrainingEngine} from './trainingSession.js';
import {TrainingStore} from './trainingStore.js';
import {trainingGatewayAuth,trainingToken,trainingCallId} from './trainingGateway.js';
import {awaitingContinuation,currentTrainingRecord} from '../src/trainingSession.js';
import {retrieveContent} from './contentRetrieval.js';
import {imageDataUrl,validateStructure} from './contentStructure.js';
import {aiRequestContext,AiAudit} from './aiAudit.js';
import {SourceRetrieval} from './sourceRetrieval.js';
import {questionBank,bookQuestion,checkReferenceVersion,referenceTurns,answerFromTurns} from './referencePractice.js';
import {prepareArguments,validateArgumentJudgments} from './argumentReview.js';
import {TavusProvider} from './tavus.js';
import express,{type Request,type Response,type NextFunction} from 'express';
import {randomUUID} from 'node:crypto';
import {sealAvatarToken,openAvatarToken} from './avatarHandle.js';
import {ModelProvider} from './model.js';
import {ApiError,language,text,transcript} from './validation.js';
import {CRITERIA} from '../src/domain.js';
import {resolveClaims,sourceCoverage,validateUnits,mergeExtractions} from './contentSources.js';
import {processMedia} from './contentMedia.js';

export function createApp(env:NodeJS.ProcessEnv=process.env,request:typeof fetch=fetch){
  const app=express();
  const uploads=new ContentUploads(env.BLOB_READ_WRITE_TOKEN);
  const retained=new RetainedMedia(env,request);
  const protection=new RequestProtection(env,request);
  const audit=new AiAudit(env);
  const model=new ModelProvider(env,request,audit);
  const retrieval=new SourceRetrieval(env,model,request);
  const trainingStore=new TrainingStore(env,request),training=new TrainingEngine(trainingStore,model);
  const sessions=new Map<string,{token:string;timer:ReturnType<typeof setTimeout>;stopping?:Promise<void>}>();
  app.disable('x-powered-by');
  app.use('/api',(req,res,next)=>{
    res.setHeader('Cache-Control','no-store');
    const origin=req.get('origin');
    try{if(origin&&new URL(origin).host!==req.get('host'))throw new Error();}catch{res.status(403).json({error:'origin_rejected'});return;}
    next();
  });
  // Content requests include original/corrected text plus exact extracted passages.
  // Keep the larger bounded envelope scoped to review routes; semantic limits remain enforced.
  const contentJson=express.json({limit:'1mb'}),defaultJson=express.json({limit:'100kb'});
  const expandedJsonPaths=new Set(['/api/content/media-retention/metadata','/api/training/visual-review','/api/content/structure','/api/content/retrieve','/api/content/assess-item','/api/content/summary','/api/content/review']);
  app.use((req,res,next)=>(expandedJsonPaths.has(req.path)?contentJson:defaultJson)(req,res,next));
  app.use(protection.middleware);
  app.use('/api',(req,res,next)=>{
    const requestId=randomUUID();res.setHeader('X-Request-Id',requestId);
    const session=req.get('X-Basira-Session')||(typeof req.body?.sessionId==='string'?req.body.sessionId:undefined);
    aiRequestContext.run({requestId,route:req.path,...(session&&/^[a-zA-Z0-9_-]{1,100}$/.test(session)?{sessionId:session}:{}),...(typeof req.body?.questionId==='string'?{questionId:req.body.questionId}:{}),...(typeof req.body?.referenceVersion==='string'?{referenceVersion:req.body.referenceVersion}:{}),...(typeof req.body?.language==='string'?{language:req.body.language}:{})},next);
  });
  app.get('/api/health',(_req,res)=>res.json({service:'basira',status:'ok'}));
  const tavus=new TavusProvider(env,request);
  const useTavus=env.AVATAR_PROVIDER==='tavus';
  const avatarMissing=()=>['LIVEAVATAR_API_KEY','LIVEAVATAR_AVATAR_ID'].filter(k=>!env[k]);
  const avatarReady=()=>model.ready&&model.speechReady&&!avatarMissing().length&&env.LIVEAVATAR_LICENSE_CONFIRMED==='true'&&env.LIVEAVATAR_ENABLE_LIVE==='true';
  app.get('/api/config',(_req,res)=>res.json({
    audit:{retentionDays:auditPolicy(env).days,enabled:audit.enabled,backend:env.AI_AUDIT_STORE||(env.VERCEL?'redis':'sqlite'),configured:env.AI_AUDIT_STORE==='sqlite'? !env.VERCEL:!env.VERCEL&&!env.AI_AUDIT_STORE||!!((env.UPSTASH_REDIS_REST_URL||env.KV_REST_API_URL)&&(env.UPSTASH_REDIS_REST_TOKEN||env.KV_REST_API_TOKEN)),mediaStored:false},
    ai:{configured:model.ready,provider:model.provider==='deepseek'?'DeepSeek':model.provider==='openai'?'OpenAI':'unsupported',missing:model.missing},
    voice:{configured:model.ready&&model.speechReady,transcriptionConfigured:model.speechReady,audioAssessmentConfigured:model.speechReady,languages:['ar','en']},
    avatar:useTavus?{provider:'tavus',configured:model.ready&&tavus.ready,missing:tavus.missing}:{provider:'liveavatar',configured:avatarReady(),missing:avatarMissing(),licenseConfirmed:env.LIVEAVATAR_LICENSE_CONFIRMED==='true',enabled:env.LIVEAVATAR_ENABLE_LIVE==='true'},
    training:{environment:trainingEnvironment(env),scope:trainingScope(env),configured:model.ready,avatarConfigured:useTavus&&tavus.trainingReady},
    videoCall:{configured:useTavus&&tavus.fullReady,reviewConfigured:model.ready},
    languages:['ar','en'],
  }));
  let inflight=0;
  function endpoint(handler:(req:Request,res:Response,signal:AbortSignal)=>Promise<void>){
    return async(req:Request,res:Response,next:NextFunction)=>{
      if(inflight>=4){res.status(429).json({error:'busy'});return;}
      inflight++;
      const controller=new AbortController();
      const closed=()=>{if(!res.writableEnded)controller.abort();};
      res.once('close',closed);
      try{await handler(req,res,controller.signal);}catch(error){if(!res.destroyed)next(error);}finally{inflight--;res.off('close',closed);}
    };
  }
  // Only the public source catalog is CDN-cacheable. User/model responses remain no-store.
  let publicQuestionCatalog:string|undefined;
  app.get('/api/training/questions',(_req,res,next)=>{try{
    publicQuestionCatalog??=JSON.stringify({questions:questionBank()});
    res.setHeader('Cache-Control','public, max-age=0, must-revalidate');
    res.setHeader('Vercel-CDN-Cache-Control','public, s-maxage=3600, stale-while-revalidate=86400');
    res.type('json').send(publicQuestionCatalog);
  }catch(e){next(e);}});
  app.post('/api/training/session',endpoint(async(req,res)=>{
    if(!['hinduism','christianity','judaism','atheism'].includes(req.body.tradition))throw new ApiError('invalid_tradition');
    res.json(await training.create(language(req.body.language),req.body.tradition));
  }));
  app.post('/api/content/practice',endpoint(async(req,res)=>{const seed=openContentPractice(req.body.ticket,env);res.json(await training.create(seed.language,seed.question.tradition,{question:seed.question,origin:seed.origin}));}));
  app.post('/api/training/session/read',endpoint(async(req,res)=>{res.json(await trainingStore.get(text(req.body.token,64)));}));
  app.post('/api/training/session/action',endpoint(async(req,res,signal)=>{
    if(!['answer','finish','retry','recover'].includes(req.body.action))throw new ApiError('invalid_action');
    const token=text(req.body.token,64),id=text(req.body.id,100);
    const current=await trainingStore.get(token);
    await aiRequestContext.run({...aiRequestContext.getStore(),sessionId:current.id,questionId:currentTrainingRecord(current).question.id},async()=>{
      const deadline=Date.now()+90000;
      for(;;){try{res.json(await training.act(token,{...req.body,id},signal));return;}catch(e){if(!['recover','finish'].includes(req.body.action)||!(e instanceof ApiError)||e.code!=='training_busy'||signal.aborted||Date.now()>=deadline)throw e;await new Promise(resolve=>setTimeout(resolve,250));}}
    });
  }));
  app.post('/api/training/session/delete',endpoint(async(req,res)=>{const token=text(req.body.token,64);await trainingStore.exclusive(token,async()=>{const s=await trainingStore.get(token);if(s.live&&s.live.expires>Date.now())await tavus.stop(s.live.handle);await trainingStore.remove(token);});res.json({deleted:true});}));
  app.post('/api/training/video-session',endpoint(async(req,res,signal)=>{
    if(!useTavus||!tavus.trainingReady)throw new ApiError('training_avatar_not_configured',503);
    const token=text(req.body.token,64);
    await trainingStore.exclusive(token,async()=>{
      const session=await trainingStore.get(token);
      if(session.live&&session.live.expires>Date.now())throw new ApiError('avatar_session_exists',409);
      if(session.ended||session.error)throw new ApiError('training_pending',409);
      const opening=awaitingContinuation(session)?{role:'assistant',text:session.language==='ar'?'تفضل، أكمل فكرتك.':'Please continue your thought.'}:currentTrainingRecord(session).turns?.at(-1);
      if(opening?.role!=='assistant')throw new ApiError('training_pending',409);
      const callId=randomUUID();
      const data=await tavus.start(signal,session.language,[],{token,opening:opening.text,callId});
      try{session.live={handle:data.id,callId,expires:Date.now()+data.maxSessionSeconds*1000};await trainingStore.put(token,session);}catch(e){await tavus.stop(data.id);throw e;}
      res.json(data);
    });
  }));
  app.post('/api/training/video-stop',endpoint(async(req,res)=>{
    const token=text(req.body.token,64),session=await trainingStore.get(token);
    if(session.live){await tavus.stop(session.live.handle);await trainingStore.revokeCall(token,session.live.callId);}
    res.json({stopped:true});
  }));
  app.post('/api/training-llm/health',endpoint(async(req,res)=>{trainingGatewayAuth(req.get('authorization'),env);res.json({gateway:'basira-source-training-v1',scope:trainingScope(env),instance:trainingRuntimeInstance});}));
  // Tavus keeps STT, turn-taking, TTS and video. Only response decisions enter this endpoint.
  app.post('/api/training-llm/chat/completions',endpoint(async(req,res,signal)=>{
    trainingGatewayAuth(req.get('authorization'),env);
    const retry=await protection.consume(trainingToken(req.body.messages),'authenticated-avatar',2);if(retry){res.setHeader('Retry-After',String(retry));res.status(429).json({error:'request_limit',retryAfterSeconds:retry});return;}
    const token=trainingToken(req.body.messages);
    if(req.body.messages.some((m:any)=>m?.role==='user'&&typeof m.content==='string'&&m.content.trim()))await settleSpokenTurn(signal);
    const session=await trainingStore.get(token);
    const result=await aiRequestContext.run({...aiRequestContext.getStore(),sessionId:session.id,questionId:currentTrainingRecord(session).question.id},()=>training.completion(token,req.body.messages,signal,trainingCallId(req.body.messages)));
    // Silence is intentional while a learner is still forming their answer.
    const reply=result.text||(result.session.ended?(session.language==='ar'?'انتهى التدريب. يمكنك الآن مراجعة إجاباتك.':'Practice has ended. You can now review your answers.'):'');
    const id='chatcmpl-'+randomUUID(),created=Math.floor(Date.now()/1000);
    if(req.body.stream===false){res.json({id,object:'chat.completion',created,model:'basira-training',choices:[{index:0,message:{role:'assistant',content:reply},finish_reason:'stop'}]});return;}
    res.setHeader('Content-Type','text/event-stream');res.setHeader('X-Accel-Buffering','no');
    res.write('data: '+JSON.stringify({id,object:'chat.completion.chunk',created,model:'basira-training',choices:[{index:0,delta:{role:'assistant',content:reply},finish_reason:null}]})+'\n\n');
    res.write('data: '+JSON.stringify({id,object:'chat.completion.chunk',created,model:'basira-training',choices:[{index:0,delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n');res.end();
  }));
  app.post('/api/training/assess',endpoint(async(req,res,signal)=>{
    const question=bookQuestion(req.body.questionId);
    checkReferenceVersion(question,req.body.referenceVersion);
    const turns=req.body.turns===undefined?undefined:referenceTurns(req.body.turns,question);
    const answer=turns?answerFromTurns(turns):text(req.body.answer,2400);
    res.json(await model.assessReference(language(req.body.language),question,answer,signal,turns));
  }));
  app.post('/api/training/followup',endpoint(async(req,res,signal)=>{
    const question=bookQuestion(req.body.questionId);
    checkReferenceVersion(question,req.body.referenceVersion);
    const turns=referenceTurns(req.body.turns,question);
    if(turns.length>=24){res.json({text:'',pointIds:[],readyForReview:true,questionId:question.id,referenceVersion:question.referenceVersion});return;}
    const focusPointId=req.body.focusPointId;
    if(focusPointId!==undefined&&!question.points.some(p=>p.id===focusPointId))throw new ApiError('invalid_transcript');
    res.json(await model.referenceFollowup(language(req.body.language),question,turns,signal,focusPointId));
  }));
  app.post('/api/content/structure',endpoint(async(req,res,signal)=>{
    res.json(await model.structureContent(language(req.body.language),validateUnits(req.body.units),signal));
  }));
  app.post('/api/content/retrieve',endpoint(async(req,res,signal)=>{
    const units=validateUnits(req.body.units);
    const structure=validateStructure(req.body.structure,units);
    res.json(await retrieveContent(structure,env,(queries,s)=>model.embedContentQueries(queries,s),signal,request));
  }));
  app.post('/api/content/assess-item',endpoint(async(req,res,signal)=>{
    const lang=language(req.body.language),units=validateUnits(req.body.units);
    const structure=validateStructure(req.body.structure,units),index=req.body.itemIndex;
    if(!Number.isInteger(index)||index<0||index>=structure.items.length)throw new ApiError('invalid_content');
    const item=structure.items[index],unit=units.find(u=>u.id===item.unitId)!;
    // Always retrieve server-side: never trust client-supplied references or verdicts.
    const candidates=await retrieveContent({items:[item],morePossible:false},env,(queries,s)=>model.embedContentQueries(queries,s),signal,request);
    const assessment=await model.judgeRetrievedContent(lang,item,candidates,unit.kind!=='text'&&!unit.confirmed,signal);
    res.json({assessment:attachContentPractice(assessment,lang,env),retrieval:candidates});
  }));
  app.post('/api/content/summary',endpoint(async(req,res,signal)=>{
    if(!['text','image','audio','video'].includes(req.body.kind))throw new ApiError('invalid_content');
    const counts:Record<string,number>={};for(const key of ['supported_in_excerpt','inconsistent_with_excerpt','insufficient_evidence','specialist_review','not_stated']){const n=req.body.counts?.[key];if(!Number.isInteger(n)||n<0||n>90)throw new ApiError('invalid_content');counts[key]=n;}
    res.json(await model.summarizeContentReview(language(req.body.language),req.body.kind,counts,signal));
  }));
  app.get('/api/media/policy',(_req,res)=>res.json({enabled:retained.configured,retentionDays:7}));
  app.post('/api/content/media-retention/prepare',endpoint(async(req,res)=>{res.json(await retained.prepare(req.body.mime,req.body.size,req.body.scope));}));
  app.post('/api/content/media-retention/token',endpoint(async(req,res)=>{res.json(await retained.authorize(req));}));
  app.post('/api/content/media-retention/complete',endpoint(async(req,res)=>{res.json(await retained.complete(req.body.handle));}));
  app.post('/api/content/media-retention/metadata',endpoint(async(req,res)=>{res.json(await retained.metadata(req.body.handle,req.body.metadata));}));
  app.post('/api/content/media-retention/delete',endpoint(async(req,res)=>{await retained.remove(req.body.handle);res.json({deleted:true});}));
  app.get('/api/media/play',endpoint(async(req,res,signal)=>{const v=await retained.playback(req.query.handle,req.get('range'),signal);res.status(206).set({'Content-Type':v.mime,'Content-Length':String(v.bytes.length),'Content-Range':`bytes ${v.start}-${v.end}/${v.total}`,'Accept-Ranges':'bytes','Referrer-Policy':'no-referrer'}).send(v.bytes);}));
  app.get('/api/media/cleanup',endpoint(async(req,res)=>{if(!env.CRON_SECRET||req.get('authorization')!==`Bearer ${env.CRON_SECRET}`)throw new ApiError('unauthorized',401);res.json({removed:await retained.cleanup(),temporaryRemoved:await uploads.cleanup()});}));
  app.post('/api/content/media-retention/process/:operation',endpoint(async(req,res,signal)=>{const op=String(req.params.operation);if(!['audio','frames','visual','speech'].includes(op))throw new ApiError('invalid_media');const lang=language(req.query.language),audience=String(req.query.audience||''),purpose=String(req.query.purpose||'');if(audience.length>400||purpose.length>600)throw new ApiError('invalid_visual_context');const v=await retained.bytes(req.body.handle,signal);if(op==='speech'){res.json(await model.assessSpeech(lang,v.data,v.mime,signal));return;}const result=await processMedia(v.data,v.mime,lang,op as 'audio'|'frames'|'visual',model,signal);res.json(op==='visual'?await model.reviewVisualContent(lang,result.frames!,'video',{audience,purpose},signal,result.duration):result);}));
  app.get('/api/content/upload-policy',(_req,res)=>res.json({mediaMB:uploads.configured||!env.VERCEL?MEDIA_MAX_MB:4,imageMB:IMAGE_MAX_MB,durationSeconds:CONTENT_MAX_SECONDS,largeUploads:uploads.configured}));
  app.post('/api/content/uploads/prepare',endpoint(async(req,res)=>{const grant=uploads.prepare(req.body.mime,req.body.size);await uploads.cleanup().catch(()=>{});res.json(grant);}));
  app.post('/api/content/uploads/token',endpoint(async(req,res)=>{res.json(await uploads.authorize(req));}));
  app.post('/api/content/uploads/cleanup',endpoint(async(_req,res)=>{res.json({removed:await uploads.cleanup()});}));
  app.post('/api/content/stored/:operation',endpoint(async(req,res,signal)=>{
    const op=String(req.params.operation);if(!['audio','frames','visual'].includes(op))throw new ApiError('invalid_media');
    const lang=language(req.query.language),audience=String(req.query.audience||''),purpose=String(req.query.purpose||'');if(audience.length>400||purpose.length>600)throw new ApiError('invalid_visual_context');
    res.json(await uploads.consume(req.body.ticket,signal,async(data,mime)=>{const result=await processMedia(data,mime,lang,op as 'audio'|'frames'|'visual',model,signal);return op==='visual'?model.reviewVisualContent(lang,result.frames!, 'video',{audience,purpose},signal,result.duration):result;}));
  }));
  app.post('/api/content/visual/:kind',express.raw({type:()=>true,limit:env.VERCEL?'4mb':`${MEDIA_MAX_MB}mb`}),endpoint(async(req,res,signal)=>{
    const kind=req.params.kind;if(!['image','video'].includes(String(kind))||!Buffer.isBuffer(req.body))throw new ApiError('invalid_media');
    const lang=language(req.query.language),audience=typeof req.query.audience==='string'?req.query.audience:'',purpose=typeof req.query.purpose==='string'?req.query.purpose:'';
    if(audience.length>400||purpose.length>600)throw new ApiError('invalid_visual_context');
    let frames:VideoFrame[],duration:number|undefined;
    if(kind==='image')frames=[{id:'image-1',at:0,image:imageDataUrl(req.body,req.get('content-type')||''),text:''}];
    else{const sampled=await processMedia(req.body,req.get('content-type')||'',lang,'visual',model,signal);frames=sampled.frames!;duration=sampled.duration;}
    res.json(await model.reviewVisualContent(lang,frames,kind as 'image'|'video',{audience,purpose},signal,duration));
  }));
  app.post('/api/content/image',express.raw({type:()=>true,limit:'4mb'}),endpoint(async(req,res,signal)=>{
    if(!Buffer.isBuffer(req.body))throw new ApiError('unsupported_image',415);
    const image=imageDataUrl(req.body,req.get('content-type')||'');
    const frames=await model.readFrames([{id:'image-1',at:0,image,text:''}],signal);
    res.json({units:frames.filter(f=>f.text.trim()).map(f=>({id:f.id,kind:'frame',frameId:f.id,start:0,end:0,text:f.text,originalText:f.text,confirmed:false}))});
  }));
  app.post('/api/content/review',endpoint(async(req,res,signal)=>{
    const lang=language(req.body.language),units=validateUnits(req.body.units);
    let extracted:any,claims:ReturnType<typeof mergeExtractions>=[],findings:ReturnType<typeof resolveClaims>=[];
    for(let attempt=0;attempt<2;attempt++){
      try{extracted=await model.extractContent(lang,units,signal);
        if(typeof extracted.morePossible!=='boolean'||!Array.isArray(extracted.claims))throw new ApiError('invalid_content_evidence',502);
        claims=mergeExtractions(units,extracted.claims);findings=resolveClaims(units,claims.slice(0,30),lang);break;
      }catch(e){if(attempt||!(e instanceof ApiError)||e.code!=='invalid_content_evidence'||signal.aborted)throw e;}
    }
    const structure=req.body.includeArguments===true?await model.extractArguments(lang,units,signal):null;
    let argumentsReport;
    if(req.body.includeArguments===true){
      const prepared=prepareArguments(structure.items,units,findings,lang);
      const {items,statuses}=await retrieval.enrich(prepared,signal);
      const judgments=items.some(i=>i.references.length)?await model.judgeArguments(lang,items,signal):{items:items.map(i=>({id:i.id,evidence:i.evidence,reasoning:i.reasoning,conclusion:i.conclusion}))};
      argumentsReport=validateArgumentJudgments(judgments,items,lang,statuses);
    }
    res.json({findings,coverage:sourceCoverage(lang),incomplete:extracted.morePossible||claims.length>30,...(argumentsReport?{arguments:argumentsReport}:{})});
  }));
  app.post('/api/content/media/:stage',express.raw({type:()=>true,limit:env.VERCEL?'4mb':`${MEDIA_MAX_MB}mb`}),endpoint(async(req,res,signal)=>{
    if(!['audio','frames'].includes(String(req.params.stage))||!Buffer.isBuffer(req.body))throw new ApiError('invalid_media');
    res.json(await processMedia(req.body,req.get('content-type')||'',language(req.query.language),req.params.stage as 'audio'|'frames',model,signal));
  }));
  app.post('/api/avatar/video-session',endpoint(async(req,res,signal)=>{if(!useTavus)throw new ApiError('avatar_not_configured',503);res.json(await tavus.start(signal,language(req.body.language),transcript(req.body.history??[],60)));}));
  app.post('/api/ai-audit/avatar-utterance',endpoint(async(req,res)=>{
    if(!useTavus||!env.TAVUS_API_KEY)throw new ApiError('avatar_not_configured',503);
    const conversationId=openAvatarToken(text(req.body.handle,4096),env.TAVUS_API_KEY);
    const turns=transcript(req.body.turns,60),last=turns.at(-1);
    if(!last||last.role!=='assistant')throw new ApiError('invalid_transcript');
    await audit.run('tavus.full.utterance',{conversationId,observation:'client_reported_unverified',language:language(req.body.language),history:turns.slice(0,-1)},async()=>({turn:last,provider:'tavus',model:'provider_managed_unknown',observation:'client_reported_unverified'}));
    res.json({saved:true});
  }));
  app.post('/api/conversation',endpoint(async(req,res,signal)=>{
    const lang=language(req.body.language),turns=transcript(req.body.turns,60);
    const started=performance.now();
    const result=await model.converse(lang,turns,signal);
    res.json({text:result,latencyMs:Math.round(performance.now()-started)});
  }));
  app.post('/api/feedback',endpoint(async(req,res,signal)=>{
    res.json(await model.feedback(language(req.body.language),transcript(req.body.turns,60),signal));
  }));
  app.post('/api/compare',endpoint(async(req,res,signal)=>{
    const lang=language(req.body.language),criterion=req.body.criterion;
    if(!CRITERIA.includes(criterion))throw new ApiError('invalid_criterion');
    const original=transcript(req.body.original,60),retry=transcript(req.body.retry,60);
    const question=original.find(t=>t.id===req.body.questionTurnId&&t.role==='assistant'&&!t.interrupted&&!['pending','uncertain'].includes(t.delivery||''));
    const answer=original.find(t=>t.id===req.body.answerTurnId&&t.role==='user');
    const retryAnswer=retry.find(t=>t.role==='user');
    const retryQuestion=retry.find(t=>t.role==='assistant');
    if(!question||!answer||!retryAnswer||retryQuestion?.text!==question.text||original.indexOf(answer)<=original.indexOf(question))throw new ApiError('invalid_comparison');
    res.json(await model.compare(lang,criterion,question,answer,retryAnswer,signal));
  }));
  app.post('/api/transcribe',express.raw({type:['audio/*','video/webm'],limit:env.VERCEL?'4mb':'5mb'}),endpoint(async(req,res,signal)=>{
    if(!Buffer.isBuffer(req.body)||!req.body.length)throw new ApiError('empty_audio');
    res.json({text:await model.transcribe(language(req.query.language),req.body,req.get('content-type')||'',signal)});
  }));
  app.post('/api/training/visual-review',endpoint(async(req,res,signal)=>{res.json(await model.assessPresentation(language(req.body.language),validateVisualFrames(req.body.frames),signal));}));
  app.post('/api/training/speech-review',express.raw({type:['audio/*','video/webm','video/mp4'],limit:'4mb'}),endpoint(async(req,res,signal)=>{
    if(!Buffer.isBuffer(req.body)||!req.body.length)throw new ApiError('empty_audio');
    res.json(await model.assessSpeech(language(req.query.language),req.body,req.get('content-type')||'',signal));
  }));
  app.post('/api/speech',endpoint(async(req,res,signal)=>{
    const pcm=await model.speech(language(req.body.language),text(req.body.text),signal);
    res.type('application/octet-stream').set('X-Audio-Format','pcm_s16le_24000_mono').send(pcm);
  }));
  async function provider(path:string,token?:string,body?:object,signal?:AbortSignal){
    let response:Awaited<ReturnType<typeof fetch>>;
    try{response=await request(`https://api.liveavatar.com/v1/sessions/${path}`,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{'X-API-KEY':env.LIVEAVATAR_API_KEY!})},body:body?JSON.stringify(body):undefined,signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(8000)});}
    catch{throw new ApiError(signal?.aborted?'request_cancelled':'avatar_connection_failed',502);}
    if(!response.ok){
      const detail=await response.text();
      // LiveAvatar also uses HTTP 403 for exhausted credits. Classify the
      // documented reason before the generic authorization status.
      if(path==='stop'&&response.status===404&&/session.*not found|not found.*session/i.test(detail))return {};
      const code=response.status===402||/credit|balance|quota/i.test(detail)?'avatar_credits_unavailable':response.status===401||response.status===403?'avatar_auth_failed':'avatar_session_configuration';
      console.warn('LiveAvatar request rejected',JSON.stringify({stage:path,status:response.status,category:code,invalidKey:/invalid.{0,20}(api.key|token)|unauthoriz/i.test(detail),credits:/credit|balance|quota/i.test(detail),accessRestriction:/plan|subscription|tier|permission|allowlist|whitelist|region|country/i.test(detail)}));
      throw new ApiError(code,502);
    }
    return path==='stop'?{}:response.json();
  }
  async function stopSession(id:string){
    const entry=sessions.get(id);if(!entry)return;
    if(entry.stopping)return entry.stopping;
    clearTimeout(entry.timer);
    entry.stopping=(async()=>{
      try{
        await provider('stop',entry.token);
        sessions.delete(id);
      }catch{
        // Keep ownership until a stop is acknowledged; the provider duration cap
        // remains the backstop. A transient failure must not become fake success.
        entry.timer=setTimeout(()=>void stopSession(id).catch(()=>{}),5000);entry.timer.unref();
        throw new ApiError('avatar_stop_unconfirmed',502);
      }finally{entry.stopping=undefined;}
    })();
    return entry.stopping;
  }
  let startingAvatar=false;
  app.post('/api/avatar/session',endpoint(async(req,res,signal)=>{
    if(useTavus){if(!model.ready)throw new ApiError('model_not_configured',503);if(!tavus.ready)throw new ApiError('avatar_not_configured',503);if(signal.aborted)throw new ApiError('request_cancelled',499);res.json(await tavus.start(signal));return;}
    const maxSeconds=req.body?.maxSessionSeconds??120;
    if(!Number.isInteger(maxSeconds)||maxSeconds<30||maxSeconds>120)throw new ApiError('invalid_session_duration');
    if(!avatarReady())throw new ApiError('avatar_not_configured',503);
    if(sessions.size>=1||startingAvatar)throw new ApiError('avatar_session_exists',409);
    startingAvatar=true;
    let id:string|undefined;
    try{
      const created=await provider('token',undefined,{mode:'LITE',avatar_id:env.LIVEAVATAR_AVATAR_ID,max_session_duration:maxSeconds,video_settings:{quality:'high',encoding:'H264'}},signal);
      const token=created.data?.session_token;
      if(typeof token!=='string')throw new ApiError('avatar_invalid_response',502);
      id=env.VERCEL?sealAvatarToken(token,env.LIVEAVATAR_API_KEY!):randomUUID();const sessionId=id;
      const timer=setTimeout(()=>void stopSession(sessionId).catch(()=>{}),(maxSeconds-5)*1000);timer.unref();
      sessions.set(id,{token,timer});
      const started=await provider('start',token,undefined,signal);
      const data=started.data;
      if(!data?.livekit_url||!data?.livekit_client_token||!data?.ws_url)throw new ApiError('avatar_invalid_response',502);
      if(signal.aborted)throw new ApiError('request_cancelled',499);
      res.json({id,livekitUrl:data.livekit_url,livekitToken:data.livekit_client_token,websocketUrl:data.ws_url});
    }catch(error){if(id)await stopSession(id).catch(()=>{});throw error;}finally{startingAvatar=false;}
  }));
  app.post('/api/avatar/stop',endpoint(async(req,res)=>{const id=text(req.body.id,12000);if(useTavus){await tavus.stop(id);res.json({stopped:true});return;}if(env.VERCEL&&!sessions.has(id)){const token=openAvatarToken(id,env.LIVEAVATAR_API_KEY||'');try{await provider('stop',token);}catch{throw new ApiError('avatar_stop_unconfirmed',502);}}else await stopSession(id);res.json({stopped:true});}));
  app.use('/api',(_req,res)=>res.status(404).json({error:'not_found'}));
  app.use((error:unknown,_req:Request,res:Response,_next:NextFunction)=>{
    if(res.headersSent)return;
    const e=error as {type?:string};
    if(e.type==='entity.too.large'){res.status(413).json({error:'payload_too_large'});return;}
    if(error instanceof ApiError){if(error.retryAfterSeconds)res.setHeader('Retry-After',String(error.retryAfterSeconds));res.status(error.status).json({error:error.code,...(error.retryAfterSeconds?{retryAfterSeconds:error.retryAfterSeconds}:{})});return;}
    res.status(error instanceof SyntaxError?400:500).json({error:error instanceof SyntaxError?'invalid_json':'internal_error'});
  });
  return {app,dispose:async()=>{trainingStore.close();await tavus.dispose();await Promise.allSettled([...sessions.keys()].map(stopSession));}};
}
