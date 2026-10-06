import {ApiError} from './validation.js';
import {VISUAL_ASPECTS,type VisualEditorial} from '../src/visualEditorial.js';
import type {VideoFrame} from '../src/contentReviewTypes.js';
export function validateVisualEditorial(raw:any,frames:VideoFrame[],kind:'image'|'video',duration?:number):VisualEditorial{
 const fail=()=>{throw new ApiError('invalid_visual_editorial',502);};const text=(v:any,n:number)=>typeof v==='string'&&v.length<=n;
 if(!text(raw?.summary,1000)||!raw.summary.trim()||!Array.isArray(raw.descriptions)||raw.descriptions.length!==frames.length||new Set(raw.descriptions.map((d:any)=>d.frameId)).size!==frames.length||!Array.isArray(raw.findings)||raw.findings.length>10)fail();
 for(const d of raw.descriptions)if(!frames.some(f=>f.id===d.frameId)||!text(d.description,1000)||!d.description.trim())fail();
 const findings=raw.findings.map((f:any,i:number)=>{if(!Object.hasOwn(VISUAL_ASPECTS,f.aspect)||!['strength','attention','uncertain'].includes(f.status)||!text(f.observation,1000)||!f.observation.trim()||!text(f.reasoning,1000)||!f.reasoning.trim()||!text(f.suggestion,800)||f.status==='attention'&&!f.suggestion.trim()||!Array.isArray(f.frameIds)||!f.frameIds.length||f.frameIds.length>frames.length||new Set(f.frameIds).size!==f.frameIds.length||f.frameIds.some((id:string)=>!frames.some(g=>g.id===id)))fail();return {...f,id:'visual-'+i,decision:'pending',reviewerNote:'',editedSuggestion:''};});
 return {version:1,kind,frames,duration,summary:raw.summary,descriptions:raw.descriptions,findings};
}
