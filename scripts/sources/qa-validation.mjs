export function extractionIssues(q,units){
 const issues=[];
 if(typeof q?.question!=='string'||!q.question.trim())issues.push('empty_question');
 if(typeof q?.answer!=='string'||!q.answer.trim())issues.push('empty_answer');
 if(!Array.isArray(q?.evidence)||q.evidence.length<1||q.evidence.length>12)return [...issues,'evidence_count'];
 for(const e of q.evidence){
  const unit=units.find(u=>u.label===e?.locator);
  if(!unit){issues.push('unknown_locator');continue;}
  if(typeof e.quote!=='string'||e.quote.length<20||e.quote.length>16000){issues.push('quote_length');continue;}
  if(unit.image&&/\.\.\.|…/.test(e.quote))issues.push('ellipsized_quote');
  if(!unit.image&&!unit.text.includes(e.quote))issues.push('quote_not_in_text');
 }
 return [...new Set(issues)];
}
export function sourceOrder(resources,cursors){return [...resources].sort((a,b)=>(cursors[a.id]?.windows||0)-(cursors[b.id]?.windows||0));}

/** Resolve locators to actual text; vision quotations remain explicitly unverified fragments. */
export function groundEvidence(q,units){
 if(!Array.isArray(q?.evidence))return q;
 const evidence=[];
 for(const e of q.evidence){
  const unit=units.find(u=>u.label===e?.locator);
  if(!unit){evidence.push(e);continue;}
  if(typeof unit.text==='string'){
   // The entire cited paragraph is evidence, not the model's potentially altered quotation.
   if(!evidence.some(x=>x.locator===e.locator))evidence.push({locator:e.locator,quote:unit.text});
  }else if(typeof e.quote==='string'){
   // Never pretend a shortened quotation is contiguous. Retain separate fragments.
   for(const quote of e.quote.split(/\.{3,}|…/).map(s=>s.trim()).filter(s=>s.length>=20))evidence.push({locator:e.locator,quote});
  }
 }
 return {...q,evidence,proposedEvidence:q.evidence};
}
