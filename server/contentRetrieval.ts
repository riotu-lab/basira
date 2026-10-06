import {identifiedQuranReference} from './contentSources.js';
import {ApiError} from './validation.js';
import {upstashConfiguration,queryUpstash} from './upstashRetrieval.js';
import type {ContentStructure} from '../src/contentStructure.js';
import type {ContentRetrieval,RetrievedPassage} from '../src/contentRetrieval.js';
export async function retrieveContent(structure:ContentStructure,env:NodeJS.ProcessEnv,embed:(queries:string[],signal:AbortSignal)=>Promise<number[][]>,signal:AbortSignal,request:typeof fetch=fetch):Promise<ContentRetrieval>{
 const upstash=upstashConfiguration(env);
 if(!upstash&&(!env.CONTENT_RAG_URL||!env.CONTENT_RAG_TOKEN))throw new ApiError('content_retrieval_not_configured',503);
 const url=upstash?.url||new URL(env.CONTENT_RAG_URL!);
 if(url.username||url.password||!(url.protocol==='https:'||(!env.VERCEL&&url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname))))throw new ApiError('content_retrieval_not_configured',503);
 if(!structure.items.length)return {at:new Date().toISOString(),items:[],status:'candidates_only'};
 const queries=structure.items.map(i=>JSON.stringify({evidence:i.evidence,reasoning:i.reasoning,conclusion:i.conclusion,class:i.class}));
 const embeddings=await embed(queries,signal);
 let data:any;
 if(upstash){data=await queryUpstash(upstash,embeddings,structure.items.map(item=>item.class==='fiqh'?'fiqh':item.class==='quran'?'tafsir':null),signal,request);}
 else {
 let response:Response;
 try{response=await request(new URL('/search',url),{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${env.CONTENT_RAG_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({queries:structure.items.map((item,i)=>({embedding:embeddings[i],source:item.class==='fiqh'?'fiqh':item.class==='quran'?'tafsir':null}))}),signal:AbortSignal.any([signal,AbortSignal.timeout(30000)])});}catch{throw new ApiError('content_retrieval_unavailable',502);}
 if(!response.ok)throw new ApiError('content_retrieval_unavailable',502);
 try{data=await response.json();}catch{throw new ApiError('invalid_retrieval_response',502);}
 }
 if(!Array.isArray(data.results)||data.results.length!==queries.length)throw new ApiError('invalid_retrieval_response',502);
 const items=data.results.map((rows:any[],index:number)=>{
  if(!Array.isArray(rows)||rows.length>3)throw new ApiError('invalid_retrieval_response',502);
  const candidates:RetrievedPassage[]=rows.map(row=>{
   const m=row.metadata;
   if(typeof row.id!=='string'||typeof row.text!=='string'||row.text.length>6000||typeof row.truncated!=='boolean'||!Number.isFinite(row.distance)||!m||!['aqeeda','fiqh','tafsir'].includes(m.source))throw new ApiError('invalid_retrieval_response',502);
   // Locators are preserved attribution, not verified URLs or religious authentication.
   const locator=m.source==='tafsir'?[m.surah_name,m.verse_range,m.sections].filter(v=>typeof v==='string').join(' · '):[m.book_part!=null?`ج ${m.book_part}`:'',m.book_page!=null?`ص ${m.book_page}`:'',m.book_page_end!==m.book_page?`– ${m.book_page_end}`:'',m.level_1_title,m.level_2_title].filter(Boolean).join(' · ');
   return {id:row.id,text:row.text,truncated:row.truncated,source:m.source,locator:locator.slice(0,1000),distance:row.distance,provenance:'unverified'};
  });
  const item=structure.items[index];
  const reference=item.class==='quran'&&typeof item.passage==='string'?identifiedQuranReference(item.passage):undefined;
  if(reference)candidates.unshift({id:reference.id,text:reference.excerpt,truncated:false,source:'quran',locator:reference.title,distance:null,provenance:'identified',reference,licenseUrl:'https://tanzil.net/docs/Text_License'});
  return {itemId:structure.items[index].id,query:queries[index],candidates};
 });return {at:new Date().toISOString(),items,status:'candidates_only'};
}
