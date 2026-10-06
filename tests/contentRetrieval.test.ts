// @vitest-environment node
import {it,expect,vi} from 'vitest';
import {retrieveContent} from '../server/contentRetrieval';
import {ModelProvider} from '../server/model';
const structure:any={items:[{id:'item-1',class:'fiqh',evidence:'نص المصدر',reasoning:'',conclusion:'الحكم'}],morePossible:false};
const env={CONTENT_RAG_URL:'http://127.0.0.1:8010',CONTENT_RAG_TOKEN:'fixture'};
const signal=()=>new AbortController().signal;
it('maps exact candidate passages and source locators without inventing verification or URLs',async()=>{
 const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({results:[[{id:'fiqh-1',text:'النص المرجعي كما ورد',truncated:false,distance:.3,metadata:{source:'fiqh',book_part:1,book_page:5,book_page_end:5}}]]})));
 const result=await retrieveContent(structure,env,async()=>[[1]],signal(),fetcher);
 expect(JSON.parse(fetcher.mock.calls[0][1].body).queries[0].source).toBe('fiqh');
 expect(result.status).toBe('candidates_only');expect(result.items[0].candidates[0]).toMatchObject({text:'النص المرجعي كما ورد',provenance:'unverified',locator:'ج 1 · ص 5'});
 expect(JSON.stringify(result)).not.toContain('http');
});
it('does not spend embedding requests before missing configuration is resolved',async()=>{const embed=vi.fn();await expect(retrieveContent(structure,{},embed,signal())).rejects.toMatchObject({code:'content_retrieval_not_configured'});expect(embed).not.toHaveBeenCalled();});
it('fails explicitly on unavailable retrieval without substituting examples',async()=>{await expect(retrieveContent(structure,env,async()=>[[1]],signal(),vi.fn().mockResolvedValue(new Response('',{status:503})))).rejects.toMatchObject({code:'content_retrieval_unavailable'});});
it('rejects malformed candidate packets',async()=>{await expect(retrieveContent(structure,env,async()=>[[1]],signal(),vi.fn().mockResolvedValue(new Response(JSON.stringify({results:[[{id:'fake',text:'x',truncated:false,distance:0,metadata:{source:'hadith'}}]]}))))).rejects.toMatchObject({code:'invalid_retrieval_response'});});
it('pins the embedding model and restores input order from indexed responses',async()=>{
 const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({data:[{index:1,embedding:Array(3072).fill(.2)},{index:0,embedding:Array(3072).fill(.1)}]})));
 const result=await new ModelProvider({OPENAI_API_KEY:'fixture'},fetcher).embedContentQueries(['first','second'],signal());
 expect(result[0][0]).toBe(.1);expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({model:'text-embedding-3-large',dimensions:3072});
});
it('does not accept embeddings from a different dimensional space',async()=>{const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({data:[{index:0,embedding:[1,2]}]})));await expect(new ModelProvider({OPENAI_API_KEY:'fixture'},fetcher).embedContentQueries(['query'],signal())).rejects.toMatchObject({code:'invalid_retrieval_response'});});
const vectorEnv={UPSTASH_VECTOR_REST_URL:'https://fixture.upstash.io',UPSTASH_VECTOR_REST_TOKEN:'fixture'};
const vector=()=>Array(3072).fill(.01);
const packet=(overrides={})=>({id:'fiqh-1',data:'النص كما ورد',score:.85,metadata:{source:'fiqh',basira_corpus:'islamthon-v1',book_page:5,book_page_end:5},...overrides});
it('uses Upstash ahead of local Chroma and preserves passages, filters and cosine distance',async()=>{
 const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({result:[packet()]})));
 const result=await retrieveContent(structure,{...env,...vectorEnv},async()=>[vector()],signal(),fetcher);
 expect(String(fetcher.mock.calls[0][0])).toBe('https://fixture.upstash.io/query/basira-content-v1');
 expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({topK:3,includeData:true,filter:"source = 'fiqh'"});
 expect(result.items[0].candidates[0]).toMatchObject({text:'النص كما ورد',provenance:'unverified'});
 expect(result.items[0].candidates[0].distance).toBeCloseTo(.3);
});
it('fails closed on partial Upstash config instead of falling back to Chroma',async()=>{
 const embed=vi.fn();await expect(retrieveContent(structure,{...env,UPSTASH_VECTOR_REST_TOKEN:'fixture'},embed,signal())).rejects.toMatchObject({code:'content_retrieval_not_configured'});expect(embed).not.toHaveBeenCalled();
});
it('rejects wrong corpus and wrong category metadata',async()=>{
 for(const metadata of [{source:'fiqh'},{source:'tafsir',basira_corpus:'islamthon-v1'}])await expect(retrieveContent(structure,vectorEnv,async()=>[vector()],signal(),vi.fn().mockResolvedValue(new Response(JSON.stringify({result:[packet({metadata})]}))))).rejects.toMatchObject({code:'invalid_retrieval_response'});
});
it('does not turn provider failure into no evidence',async()=>{
 await expect(retrieveContent(structure,vectorEnv,async()=>[vector()],signal(),vi.fn().mockResolvedValue(new Response('',{status:401})))).rejects.toMatchObject({code:'content_retrieval_unavailable'});
});
it('keeps multiple results associated with their input despite concurrent completion',async()=>{
 const items=[{...structure.items[0],id:'a'},{...structure.items[0],id:'b',class:'quran'}];
 const fetcher=vi.fn(async(_url:any,init:any)=>{const q=JSON.parse(init.body);if(q.filter.includes('fiqh'))await new Promise(r=>setTimeout(r,10));return new Response(JSON.stringify({result:[packet({id:q.filter,metadata:{source:q.filter.includes('fiqh')?'fiqh':'tafsir',basira_corpus:'islamthon-v1'}})]}));});
 const result=await retrieveContent({...structure,items},vectorEnv,async()=>[vector(),vector()],signal(),fetcher);
 expect(result.items.map(i=>[i.itemId,i.candidates[0].source])).toEqual([['a','fiqh'],['b','tafsir']]);
});

it('embeds each complete tuple as exactly one query, including its class',async()=>{
 const items=[{...structure.items[0],id:'first'},{...structure.items[0],id:'second',conclusion:'A different conclusion'}];
 const embed=vi.fn(async(_queries:string[],_signal:AbortSignal)=>[vector(),vector()]);
 const request=vi.fn(async()=>new Response(JSON.stringify({result:[packet()]})));
 await retrieveContent({items,morePossible:false},vectorEnv,embed,signal(),request);
 expect(embed).toHaveBeenCalledTimes(1);
 expect(embed.mock.calls[0][0].map((q:string)=>JSON.parse(q))).toEqual(items.map(({evidence,reasoning,conclusion,class:classification})=>({evidence,reasoning,conclusion,class:classification})));
 expect(request).toHaveBeenCalledTimes(2);
});
