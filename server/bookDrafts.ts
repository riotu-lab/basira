import {createHash} from 'node:crypto';
export type BookPages={tradition:'christianity'|'hinduism'|'atheism'|'judaism';title:string;author:string;url:string;permission:string;pages:{label:string;text:string}[]};
export function validateBookPages(value:any):BookPages{
 if(!value||!['christianity','hinduism','atheism','judaism'].includes(value.tradition)||['title','author','url','permission'].some(k=>typeof value[k]!=='string'||!value[k].trim())||!Array.isArray(value.pages)||!value.pages.length||value.pages.length>500)throw Error('Invalid book metadata, permission statement or pages');
 if(!/^https:\/\//.test(value.url)||value.pages.some((p:any)=>typeof p.label!=='string'||!p.label.trim()||typeof p.text!=='string'||!p.text.trim()||p.text.length>24000))throw Error('Each page needs a label and 1–24000 characters of text, with an HTTPS source URL');
 return value;
}
export function validateBookDrafts(raw:any,book:BookPages,page:BookPages['pages'][number]){
 if(!Array.isArray(raw?.items)||raw.items.length>12)throw Error('Invalid question extraction');
 return raw.items.map((q:any)=>{
  if(['question','answer','evidenceQuote'].some(k=>typeof q[k]!=='string'||!q[k].trim())||!page.text.includes(q.evidenceQuote))throw Error('Draft evidence is not an exact passage from the supplied page');
  return {id:createHash('sha256').update(`${book.url}:${page.label}:${q.question}`).digest('hex').slice(0,16),status:'draft',tradition:book.tradition,question:q.question,answer:q.answer,source:{title:book.title,author:book.author,url:book.url,pages:page.label,excerpt:q.evidenceQuote,permission:book.permission,pageSha256:createHash('sha256').update(page.text).digest('hex')},reviewRequired:['Answer completeness and fidelity','English translation','Canonical key points','Suitability and attribution']};
 });
}
