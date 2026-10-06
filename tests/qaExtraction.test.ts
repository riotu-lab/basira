import {expect,it} from 'vitest';
// @ts-ignore standalone Node CLI helper
import {extractionIssues,sourceOrder} from '../scripts/sources/qa-validation.mjs';
const quote='A complete supporting passage from the source.';
const q={question:'Question?',answer:'Source-supported answer.',evidence:[{locator:'PDF 5',quote}]};
it('accepts matching text and distinguishes fabricated text from image transcription',()=>{
 expect(extractionIssues(q,[{label:'PDF 5',text:quote}])).toEqual([]);
 expect(extractionIssues(q,[{label:'PDF 5',text:'Different source'}])).toEqual(['quote_not_in_text']);
 expect(extractionIssues(q,[{label:'PDF 5',image:'data:image/png;base64,test'}])).toEqual([]);
});
it('reports concrete evidence failures',()=>{
 expect(extractionIssues(q,[])).toEqual(['unknown_locator']);
 expect(extractionIssues({...q,evidence:[]},[])).toEqual(['evidence_count']);
 expect(extractionIssues({...q,evidence:[{locator:'PDF 5',quote:'Incomplete ... supporting quotation'}]},[{label:'PDF 5',image:'test'}])).toEqual(['ellipsized_quote']);
});
it('resumes with least-processed sources so short runs do not starve other backgrounds',()=>{
 const resources=[{id:'hindu-a'},{id:'hindu-b'},{id:'christian'},{id:'jewish'}];
 expect(sourceOrder(resources,{'hindu-a':{windows:2},'hindu-b':{windows:2}}).map((s:any)=>s.id)).toEqual(['christian','jewish','hindu-a','hindu-b']);
 expect(resources[0].id).toBe('hindu-a');
});
// @ts-ignore standalone Node CLI helper
import {groundEvidence} from '../scripts/sources/qa-validation.mjs';
it('uses original paragraph bytes instead of altered model quotes',()=>{
 const resolved=groundEvidence({...q,evidence:[{locator:'PDF 5',quote:'Paraphrased guess'}]},[{label:'PDF 5',text:quote}]);
 expect(resolved.evidence[0].quote).toBe(quote);expect(resolved.proposedEvidence[0].quote).toBe('Paraphrased guess');
});
it('splits vision elisions into separate unverified fragments rather than a false contiguous quote',()=>{
 const resolved=groundEvidence({...q,evidence:[{locator:'PDF 5',quote:quote+' ... '+quote}]},[{label:'PDF 5',image:'test'}]);
 expect(resolved.evidence).toHaveLength(2);expect(extractionIssues(resolved,[{label:'PDF 5',image:'test'}])).toEqual([]);
});
