// @vitest-environment node
import {it,expect,vi} from 'vitest';
import {judgmentPassages,validateContentJudgment} from '../server/contentAssessment';
import {ModelProvider} from '../server/model';
import {reportText,type ContentReport} from '../src/contentReviewTypes';
const item:any={id:'item-1',unitId:'u',passage:'A claim.',start:0,end:8,evidence:'',reasoning:'',conclusion:'A claim.',class:'fiqh'};
const retrieval:any={status:'candidates_only',at:'now',items:[{itemId:'item-1',query:'claim',candidates:[{id:'c1',source:'fiqh',text:'A reference passage.\nAnother condition.',locator:'p 5',distance:.2,provenance:'unverified',truncated:false}]}]};
const absent={status:'not_stated',explanation:'Not stated.',passageIds:[],suggestion:''};
const raw={evidence:absent,reasoning:absent,conclusion:{status:'supported_in_excerpt',explanation:'Consistent with the excerpt.',passageIds:['p1'],suggestion:''}};
const reply=(v:unknown)=>new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(v)}]}]}));
it('inserts original excerpts for IDs; never trusts model-produced source quotes',()=>{const packets=judgmentPassages(retrieval);const result=validateContentJudgment(raw,item,packets,true);expect(result.parts.conclusion.citations[0].quote).toBe('A reference passage.');expect(result.uncertain).toBe(true);expect(result.decision).toBe('pending');});
it.each([
 {...raw,conclusion:{...raw.conclusion,passageIds:['invented']}},
 {...raw,conclusion:{...raw.conclusion,passageIds:[]}},
 {...raw,conclusion:{...raw.conclusion,passageIds:['p1','p1']}},
 {...raw,evidence:raw.conclusion},
 {...raw,conclusion:{...raw.conclusion,status:'not_stated'}},
 {...raw,conclusion:{...raw.conclusion,status:'insufficient_evidence',passageIds:[],suggestion:'Invented correction'}},
])('rejects invalid evidence and corrections %#',value=>{expect(()=>validateContentJudgment(value,item,judgmentPassages(retrieval),false)).toThrow();});
it('independent semantic rejection removes the unsupported finding and correction',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(reply(raw)).mockResolvedValueOnce(reply({evidence:true,reasoning:true,conclusion:false}));
 const result=await new ModelProvider({OPENAI_API_KEY:'fixture'},fetcher).judgeRetrievedContent('en',item,retrieval,false,new AbortController().signal);
 expect(result.parts.conclusion).toMatchObject({status:'insufficient_evidence',citations:[],suggestion:''});expect(fetcher).toHaveBeenCalledTimes(2);const schema=JSON.parse(fetcher.mock.calls[0][1].body).text.format.schema.properties.conclusion;expect(schema.properties.passageIds).toMatchObject({maxItems:2,items:{enum:['p1','p2']}});
});
it('keeps unavailable evidence as insufficient, never false',()=>{
 const result=validateContentJudgment({...raw,conclusion:{status:'insufficient_evidence',explanation:'No relevant evidence.',passageIds:[],suggestion:''}},item,[],false);
 expect(result.parts.conclusion.status).toBe('insufficient_evidence');
});
it('exports original content, exact citations and the human decision separately',()=>{
 const assessed=validateContentJudgment(raw,item,judgmentPassages(retrieval),false);assessed.decision='edited';assessed.editedCorrection='Human wording';
 const report:ContentReport={version:1,id:'r',title:'Review',language:'en',kind:'text',createdAt:0,originalText:'Original.',units:[],findings:[],frames:[],coverage:'limited',analysisStatus:'complete',assessment:{version:1,at:'now',items:[assessed],total:1,complete:true}};
 const exported=reportText(report);expect(exported).toContain('Original.');expect(exported).toContain('A reference passage.');expect(exported).toContain('Human wording');expect(exported).toContain('edited');expect(exported).toContain('not religious approval');
});
