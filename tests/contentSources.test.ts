// @vitest-environment node
import {describe,it,expect,vi} from 'vitest';
import {normalizeArabic,resolveClaims,validateUnits,mergeExtractions} from '../server/contentSources';
import {groupTranscript} from '../server/contentMedia';
import {ModelProvider} from '../server/model';
import type {ExtractedClaim,ReviewUnit} from '../src/contentReviewTypes';
function review(passage:string,quote:string,citation='',kind:ExtractedClaim['kind']='quran_quote',confirmed=true){
 const units:ReviewUnit[]=[{id:'u',text:passage,originalText:passage,kind:confirmed?'text':'audio',start:0,end:5,confirmed}];
 return resolveClaims(units,[{unitId:'u',passage,quote,citation,kind}],'en')[0];
}
describe('Content source verification with real pinned Quran corpus',()=>{
 it('matches actual Arabic excerpts beyond the previous 16:125 catalog',()=>{
  const f=review('Quran 112:1: «قل هو الله أحد»','قل هو الله أحد','112:1');
  expect(f.category).toBe('textual_match');expect(f.reference?.id).toBe('quran-112-1');
  expect(f.reference?.excerpt).toBe('قُلْ هُوَ اللَّهُ أَحَدٌ');
 });
 it('detects a direct quotation difference and only suggests text present in the cited source',()=>{
  const f=review('القرآن 112:1: «قل هو الله واحد»','قل هو الله واحد','112:1');
  expect(f.category).toBe('textual_mismatch');expect(f.correction).toBe('قُلْ هُوَ اللَّهُ أَحَدٌ');
  expect(f.reference!.excerpt).toContain(f.correction!);
 });
 it.each(['سورة الإخلاص، الآية الأولى','سورة الاخلاص، الاية الاولى','الآية الأولى من سورة الإخلاص','سورة الإخلاص، الآية ١'])('resolves a named Arabic citation: %s',(citation)=>{
  const f=review(`قال الله تعالى في ${citation}: «قل هو الله واحد».`,'قل هو الله واحد',citation);
  expect(f.category).toBe('textual_mismatch');expect(f.reference?.id).toBe('quran-112-1');
  expect(f.correction).toBe('قُلْ هُوَ اللَّهُ أَحَدٌ');
 });
 it.each(['سورة الإخلاص الآية الثانية عشرة','سورة الإخلاص الآية الأولى والعشرون','سورة الإخلاص الآية ٩٩','سورة الإخلاص وسورة الفاتحة الآية الأولى'])('does not guess an ambiguous or unsupported ordinal: %s',(citation)=>{
  expect(review(`${citation}: «قل هو الله واحد»`,'قل هو الله واحد',citation).category).toBe('insufficient_evidence');
 });
 it('distinguishes wrong attribution when another exact source is present',()=>{
  const f=review('Quran 16:125: «قل هو الله أحد»','قل هو الله أحد','16:125');
  expect(f.category).toBe('unsupported_attribution');expect(f.relatedReference?.id).toBe('quran-112-1');
 });
 it('does not infer falsity for unknown hadith, claims or translations',()=>{
  for(const kind of ['hadith_attribution','religious_claim','translation'] as const){
   const f=review('A statement without evidence.','A statement without evidence.','',kind);
   expect(f.category).toBe('insufficient_evidence');expect(f.reference).toBeNull();expect(f.correction).toBeNull();
   expect(f.explanation).toContain('does not establish that it is false');
  }
 });
 it('treats non-prescriptive reflection as a neutral scope note, without invented evidence',()=>{
  const f=review('تدعونا هذه الآية إلى التأمل في وحدانية الله.','','','interpretation');
  expect(f.category).toBe('out_of_scope');expect(f.reference).toBeNull();expect(f.correction).toBeNull();expect(f.practiceEligible).toBe(false);
 });
 it('routes interpretation and omitted quotation text to human expertise',()=>{
  expect(review('This practice is mandatory.','','','interpretation').category).toBe('specialist_review');
  expect(review('Quran 112:1: قل ... أحد','قل ... أحد','112:1').category).toBe('specialist_review');
 });
 it('treats machine transcripts as uncertain until checked and never changes original text',()=>{
  const text='112:1 قل هو الله واحد';const f=review(text,'قل هو الله واحد','112:1','quran_quote',false);
  expect(f.uncertain).toBe(true);expect(f.passage).toBe(text);
 });
 it('rejects invented evidence, missing units, duplicated or ambiguous anchors',()=>{
  const units:ReviewUnit[]=[{id:'u',kind:'text',text:'actual actual',originalText:'actual actual',confirmed:true}];
  for(const passage of ['invented','actual'])expect(()=>resolveClaims(units,[{unitId:'u',passage,quote:'',citation:'',kind:'religious_claim'}],'en')).toThrow();
 });
 it('rejects oversized content and validates timestamp inputs',()=>{
  expect(()=>validateUnits([{id:'u',kind:'text',text:'a'.repeat(20001)}])).toThrow();
  expect(()=>validateUnits([{id:'u',kind:'audio',text:'words',start:-1,end:2}])).toThrow();
 });
 it('does not claim an unresolved citation was verified even when its quotation matches',()=>{
  const f=review('Quran 999:999: «قل هو الله أحد»','قل هو الله أحد','999:999');
  expect(f.category).toBe('insufficient_evidence');expect(f.explanation).toContain('could not be resolved');
 });
 it('recovers an explicitly cited OCR quotation omitted by model extraction, without treating translations as direct quotations',()=>{
  const units:ReviewUnit[]=[{id:'frame-0',kind:'frame',text:'قل هو الله واحد 112:1',originalText:'قل هو الله واحد 112:1',start:0,end:15,confirmed:false}];
  const claims=mergeExtractions(units,[{unitId:'frame-0',passage:units[0].text,quote:'',citation:'112:1',kind:'interpretation'}]);expect(claims).toHaveLength(1);
  const findings=resolveClaims(units,claims,'en');expect(findings[0].category).toBe('textual_mismatch');expect(findings[0].uncertain).toBe(true);
  expect(mergeExtractions([{...units[0],text:'Summary: God is one 112:1'}],[])).toEqual([]);
 });
 it('groups nearby timestamped fragments without losing original transcription or timing bounds',()=>{
  const parts:ReviewUnit[]=[{id:'a',kind:'audio',text:'قل',originalText:'قل',start:0,end:1,confirmed:false},{id:'b',kind:'audio',text:'هو الله أحد',originalText:'هو الله أحد',start:1.2,end:3,confirmed:false}];
  const grouped=groupTranscript(parts);expect(grouped).toHaveLength(1);expect(grouped[0]).toMatchObject({text:'قل هو الله أحد',originalText:'قل هو الله أحد',start:0,end:3,confirmed:false});expect(parts[0].text).toBe('قل');
 });
 it('normalizes an index without modifying reference text and extracts without model-authored citations',async()=>{
  expect(normalizeArabic('قُلْ هُوَ ٱللَّهُ أَحَدٌ')).toBe('قل هو الله أحد');
  const request=vi.fn().mockResolvedValue(new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({claims:[],morePossible:false})}]}]})));
  await new ModelProvider({OPENAI_API_KEY:'fixture'},request).extractContent('en',[],new AbortController().signal);
  const body=JSON.parse(request.mock.calls[0][1].body);
  expect(body.instructions).toContain('never an inferred verse number');expect(body.text.format.strict).toBe(true);
 });
});

it('source loading failure is an unavailable-service error, never a false-claim verdict',async()=>{
 vi.resetModules();vi.doMock('node:fs',()=>({readFileSync:()=>{throw Error('unavailable');}}));
 try{const sources=await import('../server/contentSources');expect(()=>sources.resolveClaims([],[],'en')).toThrowError(expect.objectContaining({code:'source_collection_unavailable',status:503}));}
 finally{vi.doUnmock('node:fs');vi.resetModules();}
});

it('resolves transcript spacing without changing words or offsets',()=>{
 const text=' قال الله تعالى في سورة الإخلاص  الآية الأولى  قل  هو الله أحب';
 const units:ReviewUnit[]=[{id:'u',kind:'audio',text,originalText:text,start:0,end:6,confirmed:false}];
 const claims:ExtractedClaim[]=[{unitId:'u',passage:'قال الله تعالى في سورة الإخلاص الآية الأولى قل هو الله أحب',quote:'قل هو الله أحب',citation:'سورة الإخلاص الآية الأولى',kind:'quran_quote'}];
 const result=resolveClaims(units,mergeExtractions(units,claims),'ar');
 expect(result).toHaveLength(1);expect(result[0].passage).toBe(text.slice(1));expect(result[0].quote).toBe('قل  هو الله أحب');expect(result[0].uncertain).toBe(true);expect(text.slice(result[0].start,result[0].end)).toBe(result[0].passage);
 expect(()=>mergeExtractions(units,[{...claims[0],quote:'قل هو الله أحد'}])).toThrow('invalid_content_evidence');
});

it('resolves a partial verse label using the chapter in the same original passage',()=>{
 const f=review('قال الله تعالى في سورة الإخلاص، الآية الأولى: «قل هو الله واحد».','قل هو الله واحد','الآية الأولى');
 expect(f.category).toBe('textual_mismatch');expect(f.reference?.id).toBe('quran-112-1');
 const invalid=review('سورة الإخلاص، الآية الأولى، 112:999 «قل هو الله واحد»','قل هو الله واحد','112:999');
 expect(invalid.category).toBe('insufficient_evidence');
});
