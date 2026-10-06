import type {ContentTuple} from '../src/contentStructure.js';
import type {ContentRetrieval} from '../src/contentRetrieval.js';
import {assessmentParts,type AssessedItem,type JudgmentCitation,type JudgmentPart} from '../src/contentAssessment.js';
import {ApiError} from './validation.js';
export function judgmentPassages(retrieval:ContentRetrieval):JudgmentCitation[]{
 const seen=new Set<string>();const packets:JudgmentCitation[]=[];
 for(const candidate of retrieval.items.flatMap(i=>i.candidates)){
  if(seen.has(candidate.id))continue;seen.add(candidate.id);
  // Quote by passage ID, never ask the model to reproduce source text.
  const pieces=candidate.text.match(/[^\n]+(?:\n|$)/g)||[candidate.text];
  for(const piece of pieces){const quote=piece.trim();if(!quote)continue;
   for(let offset=0;offset<quote.length;offset+=2000){packets.push({id:`p${packets.length+1}`,sourceId:candidate.id,source:candidate.source,locator:candidate.locator,quote:quote.slice(offset,offset+2000),provenance:candidate.provenance,reference:candidate.reference,licenseUrl:candidate.licenseUrl});}
  }
 }return packets;
}
export function validateContentJudgment(raw:any,item:ContentTuple,passages:JudgmentCitation[],uncertain:boolean):AssessedItem{
 const parts={} as AssessedItem['parts'];
 for(const key of assessmentParts){const p=raw?.[key];
  if(!p||!['supported_in_excerpt','inconsistent_with_excerpt','insufficient_evidence','specialist_review','not_stated'].includes(p.status)||typeof p.explanation!=='string'||!p.explanation.trim()||p.explanation.length>1500||typeof p.suggestion!=='string'||p.suggestion.length>1000||!Array.isArray(p.passageIds)||p.passageIds.length>6||new Set(p.passageIds).size!==p.passageIds.length||p.passageIds.some((id:unknown)=>!passages.some(v=>v.id===id)))throw new ApiError('invalid_content_judgment',502);
  if((!item[key]&&(p.status!=='not_stated'||p.passageIds.length||p.suggestion))||(item[key]&&p.status==='not_stated'))throw new ApiError('invalid_content_judgment',502);
  if(['supported_in_excerpt','inconsistent_with_excerpt'].includes(p.status)&&!p.passageIds.length)throw new ApiError('invalid_content_judgment',502);
  if(!passages.length&&!['insufficient_evidence','not_stated','specialist_review'].includes(p.status))throw new ApiError('invalid_content_judgment',502);
  // Any proposed factual correction must have source evidence. Do not auto-rewrite content.
  if(p.suggestion&&!p.passageIds.length)throw new ApiError('invalid_content_judgment',502);
  parts[key]={status:p.status,explanation:p.explanation,suggestion:p.suggestion,citations:p.passageIds.map((id:string)=>passages.find(v=>v.id===id)!)} as JudgmentPart;
 }
 return {item,parts,uncertain,decision:'pending',reviewerNote:'',editedCorrection:''};
}
