// @vitest-environment node
import {it,expect,vi} from 'vitest';
import {validateStructure,imageDataUrl} from '../server/contentStructure';
import {ModelProvider} from '../server/model';
const units=[{id:'t',kind:'text' as const,text:'The author quotes X. Because Y. Therefore Z.',originalText:'The author quotes X. Because Y. Therefore Z.',confirmed:true}];
const raw=()=>({morePossible:false,items:[{unitId:'t',passage:units[0].text,evidence:'The author quotes X.',reasoning:'Because Y.',conclusion:'Therefore Z.',class:'other'}]});
it('preserves the four fields and exact source offsets',()=>{expect(validateStructure(raw(),units).items[0]).toMatchObject({start:0,end:units[0].text.length,evidence:'The author quotes X.',class:'other'});});
it('preserves missing parts rather than filling them',()=>{const r=raw();r.items[0].reasoning='';r.items[0].conclusion='';expect(validateStructure(r,units).items[0].conclusion).toBe('');});
it.each(['unknown-class','unknown-unit'])('rejects %s',kind=>{const r=raw();if(kind==='invented')r.items[0].reasoning='Made up';if(kind==='unknown-class')r.items[0].class='religion';if(kind==='unknown-unit')r.items[0].unitId='missing';if(kind==='duplicate')r.items.push(r.items[0]);expect(()=>validateStructure(r,units)).toThrow('invalid_content_structure');});
it('accepts an empty list without fabricating claims',()=>{expect(validateStructure({items:[],morePossible:false},units).items).toEqual([]);});
it('rejects mismatched image signatures and unsupported/oversized files',()=>{expect(()=>imageDataUrl(Buffer.from('not png'),'image/png')).toThrow('unsupported_image');expect(()=>imageDataUrl(Buffer.from('<svg/>'),'image/svg+xml')).toThrow('unsupported_image');expect(()=>imageDataUrl(Buffer.alloc(4*1024*1024+1),'image/png')).toThrow('image_size_limit');});
it('performs one model extraction call, with no retrieval calls',async()=>{const request=vi.fn().mockResolvedValue(new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(raw())}]}]})));const model=new ModelProvider({OPENAI_API_KEY:'test',AI_AUDIT_ENABLED:'false'},request);expect((await model.structureContent('en',units,AbortSignal.timeout(10000))).items).toHaveLength(1);expect(request).toHaveBeenCalledTimes(1);expect(request.mock.calls[0][0]).toBe('https://api.openai.com/v1/responses');});
it('resolves whitespace-only wrapping to the original exact passage',()=>{const text='The author quotes X.\nBecause Y.\nTherefore Z.';const r=validateStructure(raw(),[{...units[0],text}]);expect(r.items[0].passage).toBe(text);expect(r.items[0].end).toBe(text.length);});
it('passes non-exact extracted wording directly onward',()=>{const r=raw();r.items[0].evidence='The author quotes X!';expect(validateStructure(r,units).items[0].evidence).toBe(r.items[0].evidence);});
it('keeps separate tuples from the same original passage',()=>{const r=raw();r.items.push({...r.items[0],conclusion:'Another interpretation'});expect(validateStructure(r,units).items).toHaveLength(2);});
it.each(['quran','hadith','fiqh','other'])('retains the requested %s classification',classification=>{const r=raw();r.items[0].class=classification;expect(validateStructure(r,units).items[0].class).toBe(classification);});
it('uses Luna once and does not retry non-exact extracted fields',async()=>{
 const extracted=raw();extracted.items[0].reasoning='A paraphrased explanation';
 const request=vi.fn(async(_url:any,_init:any)=>new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(extracted)}]}]})));
 const model=new ModelProvider({OPENAI_API_KEY:'test',OPENAI_MODEL:'gpt-4.1-mini',AI_AUDIT_ENABLED:'false'},request);
 expect((await model.structureContent('en',units,AbortSignal.timeout(10000))).items[0].reasoning).toBe('A paraphrased explanation');
 expect(request).toHaveBeenCalledTimes(1);
 expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({model:'gpt-5.6-luna',reasoning:{effort:'low'}});
});
it('uses the real original unit when a model passage cannot be located',()=>{const r=raw();r.items[0].passage='Paraphrased passage';expect(validateStructure(r,units).items[0]).toMatchObject({passage:units[0].text,start:0,end:units[0].text.length});});
it('keeps structural bounds on extracted tuples',()=>{const r=raw();r.items[0].evidence='x'.repeat(6001);expect(()=>validateStructure(r,units)).toThrow('invalid_content_structure');});

it('allows a repeated exact field within a uniquely located source passage',()=>{const text='X supports Y. X is cited again.';const result=validateStructure({morePossible:false,items:[{unitId:'t',passage:text,evidence:'X',reasoning:'',conclusion:'',class:'other'}]},[{...units[0],text}]);expect(result.items[0].evidence).toBe('X');});

it('constrains extraction unit IDs to supplied source IDs even for many items',async()=>{
 const r=raw();r.items.push({...r.items[0],conclusion:'Another claim'});
 const request=vi.fn(async(_url:any,_init:any)=>new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(r)}]}]})));
 const model=new ModelProvider({OPENAI_API_KEY:'test',AI_AUDIT_ENABLED:'false'},request);
 const result=await model.structureContent('en',units,AbortSignal.timeout(10000));
 expect(result.items.map(i=>i.unitId)).toEqual(['t','t']);
 const body=JSON.parse(request.mock.calls[0][1].body);
 expect(body.text.format.schema.properties.items.items.properties.unitId.enum).toEqual(['t']);
});
it('retries a temporary provider outage once without reintroducing text-matching validation',async()=>{
 const request=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({error:{type:'server_error'}}),{status:503})).mockResolvedValueOnce(new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(raw())}]}]})));
 const result=await new ModelProvider({OPENAI_API_KEY:'test',AI_AUDIT_ENABLED:'false'},request).structureContent('en',units,AbortSignal.timeout(10000));
 expect(result.items).toHaveLength(1);expect(request).toHaveBeenCalledTimes(2);
});
