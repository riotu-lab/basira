import {isSocialAcknowledgment,WITHHELD_TRAINING_QUESTIONS} from '../src/trainingEligibility.js';
import {trainingOpening} from './trainingOpening.js';
import {AUDIO_CRITERIA,type AudioCriterion} from '../src/audioAssessment.js';
import {spokenText} from '../src/providerSpeech.js';
import {QUALITY_CRITERIA,type QualityCriterion} from '../src/trainingQuality.js';
import {randomBytes,randomUUID,randomInt,createHash} from 'node:crypto';
import {awaitingContinuation,currentTrainingRecord,type TrainingSession} from '../src/trainingSession.js';
import type {Lang} from '../src/content.js';
import type {BookQuestion,ReferenceRecord,ReferenceTurn,ReferenceAssessment,Tradition} from '../src/referencePracticeTypes.js';
import {questionBank,answerFromTurns} from './referencePractice.js';
import {ApiError} from './validation.js';
type TrainingModel={referenceFollowup:(language:Lang,question:BookQuestion,turns:ReferenceTurn[],signal:AbortSignal,focusPointId?:string)=>Promise<{text:string;pointIds:string[];readyForReview:boolean}>;assessReference:(language:Lang,question:BookQuestion,answer:string,signal:AbortSignal,turns?:ReferenceTurn[])=>Promise<ReferenceAssessment>};
import {TrainingStore} from './trainingStore.js';
export class TrainingEngine{
 constructor(readonly store:TrainingStore,private model:TrainingModel){}
 private pick(tradition:Tradition,asked=new Set<string>()){const available=questionBank().filter(q=>q.tradition===tradition&&!asked.has(q.id));const evidenced=available.filter(q=>q.evidence?.length);const pool=evidenced.length?evidenced:available;return pool.length?pool[randomInt(pool.length)]:undefined;}
 private initial(q:BookQuestion,language:Lang,greet=false):ReferenceTurn{return {id:randomUUID(),role:'assistant',text:greet?trainingOpening(language,q.tradition,q.question[language],q.context==='content_review'):q.question[language],pointIds:q.points.map(p=>p.id),delivery:'uncertain'};}
 async create(language:Lang,tradition:Tradition,content?:{question:BookQuestion;origin:TrainingSession['contentOrigin']}){const q=content?.question||this.pick(tradition);if(!q)throw new ApiError('question_not_available',404);const id=randomUUID(),record:ReferenceRecord={id:randomUUID(),sessionId:id,question:q,language,attempts:[],turns:[this.initial(q,language,true)]};const session:TrainingSession={contentOrigin:content?.origin,id,language,tradition,revision:0,createdAt:Date.now(),records:[record],currentId:record.id,ended:false};const token=randomBytes(32).toString('hex');await this.store.put(token,session);return {token,session};}
 async act(token:string,event:{id:string;action:'answer'|'finish'|'retry'|'recover';text?:string;inputKind?:ReferenceTurn['inputKind'];recordId?:string;focusPointId?:string;focusQualityId?:string;focusAudioCriterion?:string},signal:AbortSignal,avatarCallId?:string){return this.store.exclusive(token,async()=>{
  const s=await this.store.get(token);if(avatarCallId&&(!s.live||s.live.expires<Date.now()||s.live.callId!==avatarCallId))throw new ApiError('training_call_ended',409);if(!avatarCallId&&s.live&&s.live.expires>Date.now())throw new ApiError('training_end_first',409);const previous=s.events?.find(e=>e.id===event.id)|| (s.lastEvent?.id===event.id?s.lastEvent:undefined);if(previous)return {session:s,text:previous.text};
  let r=currentTrainingRecord(s);let output='';
  if(event.action==='retry'){
   if(!s.ended)throw new ApiError('training_end_first',409);
   const target=s.records.find(v=>v.id===event.recordId);if(!target?.completed||!target.attempts.length)throw new ApiError('invalid_transcript');
   if(WITHHELD_TRAINING_QUESTIONS.has(target.question.id))throw new ApiError('question_not_available',409);
   if(event.focusPointId&&!target.question.points.some(p=>p.id===event.focusPointId))throw new ApiError('invalid_transcript');
   if(event.focusQualityId&&!Object.hasOwn(QUALITY_CRITERIA,event.focusQualityId))throw new ApiError('invalid_transcript');
   if(event.focusAudioCriterion&&!Object.hasOwn(AUDIO_CRITERIA,event.focusAudioCriterion))throw new ApiError('invalid_transcript');
   r=target;r.focusAudioCriterion=event.focusAudioCriterion as AudioCriterion|undefined;r.focusQualityId=event.focusQualityId as QualityCriterion|undefined;s.currentId=r.id;r.completed=false;delete r.exhausted;r.retrying=true;r.focusPointId=event.focusPointId;r.turns=[this.initial(r.question,s.language)];s.ended=false;output=r.turns[0].text;
  }else{
   if(s.ended)return {session:s,text:''};
   if(event.action==='answer'||(event.action==='finish'&&event.text?.trim()&&r.turns?.at(-1)?.text!==event.text.trim())){
    if(!event.text?.trim()||event.text.length>2400)throw new ApiError('invalid_text');
    if(!r.turns?.length||(!avatarCallId&&r.turns.at(-1)?.role!=='assistant'&&!awaitingContinuation(s)))throw new ApiError('training_pending',409);
    r.turns.push({id:event.id,role:'user',text:event.text.trim(),pointIds:r.turns.at(-1)!.pointIds,inputKind:event.inputKind||'unknown',delivery:'text'});
    // Persist actual input before any model request so provider failure never loses it.
    s.revision++;await this.store.put(token,s);
   }
   try{
    const turns=r.turns||[];
    if(r.exhausted){
     if(event.action==='finish')s.ended=true;
     else{output=s.language==='ar'?'ناقشنا جميع الأسئلة المتاحة لهذا الموضوع. يمكنك إنهاء الحوار ومراجعة إجاباتك عندما تكون مستعدًا.':'We have discussed all available questions for this topic. You can end the discussion and review your answers when you are ready.';if(turns.at(-1)?.role==='user')turns.push({id:randomUUID(),role:'assistant',text:output,pointIds:[],delivery:'uncertain'});}
    }else if(event.action!=='finish'&&turns.at(-1)?.role==='user'&&isSocialAcknowledgment(turns.at(-1)!.text)){
     // Thanks/acknowledgments are not theological answers or permission to advance.
     output='';
    }else if(turns.at(-1)?.role==='user'){
     let followup=event.action==='finish'||turns.length>=24?{readyForReview:true,text:'',pointIds:[]}:await this.retryValidation(()=>this.model.referenceFollowup(s.language,r.question,turns,signal,r.focusPointId),signal);
     // A retry is one focused answer, with at most one substantive clarification.
     // Silent incomplete-speech responses must still wait for the learner.
     if((r.retrying||s.contentOrigin)&&!followup.readyForReview&&followup.text&&turns.filter(t=>t.role==='assistant').length>=2)followup={readyForReview:true,text:'',pointIds:[]};
     if(!followup.readyForReview&&followup.text){const next:ReferenceTurn={id:randomUUID(),role:'assistant',text:followup.text,pointIds:followup.pointIds,delivery:'uncertain'};turns.push(next);output=next.text;}
     else if(followup.readyForReview){await this.assess(s,r,turns,signal);if(event.action==='finish'||r.retrying||s.contentOrigin){s.ended=true;}else{const asked=new Set(s.records.map(v=>v.question.id));const next=this.pick(s.tradition,asked);if(next){const record:ReferenceRecord={id:randomUUID(),sessionId:s.id,question:next,language:s.language,attempts:[],turns:[this.initial(next,s.language)]};s.records.push(record);s.currentId=record.id;if(followup.text)record.turns![0].text=followup.text+' '+record.turns![0].text;output=record.turns![0].text;}else{r.exhausted=true;output=s.language==='ar'?'ناقشنا جميع الأسئلة المتاحة لهذا الموضوع. يمكنك إنهاء الحوار ومراجعة إجاباتك عندما تكون مستعدًا.':'We have discussed all available questions for this topic. You can end the discussion and review your answers when you are ready.';turns.push({id:randomUUID(),role:'assistant',text:output,pointIds:[],delivery:'uncertain'});}}}
    }else if(event.action==='finish'){
     const answered=turns.slice(0,-1);if(answered.some(t=>t.role==='user'))await this.assess(s,r,answered,signal);s.ended=true;
    }else output=turns.at(-1)?.text||'';
   }catch(e){s.error=e instanceof ApiError?e.code:'connection_failed';s.revision++;await this.store.put(token,s);throw e;}
  }
  delete s.error;s.revision++;s.lastEvent={id:event.id,text:output};s.events=[...(s.events||[]),s.lastEvent].slice(-256);await this.store.put(token,s);return {session:s,text:output};
 });}
 private async retryValidation<T>(work:()=>Promise<T>,signal:AbortSignal):Promise<T>{try{return await work();}catch(e){if(!(e instanceof ApiError)||e.code!=='invalid_model_evidence'||signal.aborted)throw e;return work();}}
 private async assess(s:TrainingSession,r:ReferenceRecord,turns:ReferenceTurn[],signal:AbortSignal){const answer=answerFromTurns(turns);if(WITHHELD_TRAINING_QUESTIONS.has(r.question.id)||!turns.some(t=>t.role==='user'&&!isSocialAcknowledgment(t.text)))return;const assessment=await this.retryValidation(()=>this.model.assessReference(s.language,r.question,answer,signal,turns),signal);r.attempts.push({id:randomUUID(),at:Date.now(),answer,assessment,turns:structuredClone(turns),focusPointId:r.focusPointId,focusQualityId:r.focusQualityId,focusAudioCriterion:r.focusAudioCriterion});r.completed=true;}
 async completion(token:string,messages:unknown,signal:AbortSignal,callId:string){
  if(!Array.isArray(messages)||messages.length>100)throw new ApiError('invalid_transcript');
  // Only final user messages can become learner evidence. Ignore perception/system text.
  const users=messages.filter(m=>m?.role==='user'&&typeof m.content==='string').map(m=>m.content as string);
  const last=spokenText(users.at(-1)||'');const s=await this.store.get(token);if(!s.live||s.live.expires<Date.now()||s.live.callId!==callId)throw new ApiError('training_call_ended',409);if(!last)return {session:s,text:[...(currentTrainingRecord(s).turns||[])].reverse().find(t=>t.role==='assistant')?.text||''};
  const id=createHash('sha256').update(callId+JSON.stringify(users)).digest('hex');
  // Failed requests retry the saved answer rather than adding it twice.
  const pending=currentTrainingRecord(s).turns?.at(-1);
  const deadline=Date.now()+90000;
  for(;;){
   if(signal.aborted)throw new ApiError('request_cancelled',499);
   try{return await this.act(token,{id,action:pending?.role==='user'&&pending.id===id?'recover':'answer',text:last,inputKind:'transcribed'},signal,callId);}
   catch(e){if(!(e instanceof ApiError)||e.code!=='training_busy'||Date.now()>=deadline)throw e;await new Promise(resolve=>setTimeout(resolve,250));}
  }
 }
}
