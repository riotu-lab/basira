import type {ReviewUnit} from '../src/contentReviewTypes.js';
import {itemClasses,type ContentStructure} from '../src/contentStructure.js';
import {ApiError} from './validation.js';
// Resolve line-wrap differences only, then return the original verbatim span.
export function locateOriginalSpan(text:string,part:string){
 const escaped=part.trim().split(/\s+/u).map(w=>w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('\\s+');
 const matches=[...text.matchAll(new RegExp(escaped,'gu'))];
 if(matches.length!==1)throw new ApiError('invalid_content_evidence',502);
 return {text:matches[0][0],start:matches[0].index!};
}
// Structural checks only. Exact wording is no longer a gate before retrieval.
export function validateStructure(raw:any,units:ReviewUnit[]):ContentStructure{
 if(!raw||typeof raw.morePossible!=='boolean'||!Array.isArray(raw.items)||raw.items.length>30)throw new ApiError('invalid_content_structure',502);
 const items=raw.items.map((item:any,i:number)=>{
  const unit=units.find(u=>u.id===item?.unitId);
  if(!unit||typeof item.passage!=='string'||!item.passage.trim()||item.passage.length>20000||!Object.hasOwn(itemClasses,item.class))throw new ApiError('invalid_content_structure',502);
  for(const key of ['evidence','reasoning','conclusion'])if(typeof item[key]!=='string'||item[key].length>6000)throw new ApiError('invalid_content_structure',502);
  if(![item.evidence,item.reasoning,item.conclusion].some(v=>v.trim())||item.evidence.length+item.reasoning.length+item.conclusion.length>6000)throw new ApiError('invalid_content_structure',502);
  // Best-effort anchoring for display, never a rejection or an invented offset.
  // If the model paraphrased the enclosing passage, show the actual source unit.
  let located={text:unit.text,start:0};
  try{located=locateOriginalSpan(unit.text,item.passage);}catch{}
  return {id:`item-${i+1}`,unitId:unit.id,passage:located.text,start:located.start,end:located.start+located.text.length,evidence:item.evidence,reasoning:item.reasoning,conclusion:item.conclusion,class:item.class};
 });return {items,morePossible:raw.morePossible};
}
export function imageDataUrl(data:Buffer,mime:string){
 if(!data.length||data.length>4*1024*1024)throw new ApiError('image_size_limit',413);
 const type=mime.split(';')[0];const valid=type==='image/png'?data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):type==='image/jpeg'?data[0]===255&&data[1]===216&&data[2]===255:type==='image/webp'?data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WEBP':false;
 if(!valid)throw new ApiError('unsupported_image',415);
 return `data:${type};base64,${data.toString('base64')}`;
}
