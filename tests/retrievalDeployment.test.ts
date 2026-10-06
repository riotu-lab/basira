// @vitest-environment node
import {it,expect} from 'vitest';
// @ts-ignore JS deployment boundary
import {productionRetrievalValues} from '../scripts/deploy/retrieval-env.mjs';
it('never promotes a local retrieval URL or token automatically',()=>expect(productionRetrievalValues({CONTENT_RAG_URL:'http://127.0.0.1:8010',CONTENT_RAG_TOKEN:'local-secret'})).toEqual({}));
it('requires complete production configuration without exposing secrets',()=>{expect(()=>productionRetrievalValues({CONTENT_RAG_URL_PROD:'https://retrieval.example.com'})).toThrow();expect(()=>productionRetrievalValues({CONTENT_RAG_URL_PROD:'http://localhost',CONTENT_RAG_TOKEN_PROD:'x'.repeat(32)})).toThrow();});
it('maps only explicitly configured HTTPS production retrieval',()=>expect(productionRetrievalValues({CONTENT_RAG_URL_PROD:'https://retrieval.example.com/',CONTENT_RAG_TOKEN_PROD:'x'.repeat(32)})).toEqual({CONTENT_RAG_URL:'https://retrieval.example.com',CONTENT_RAG_TOKEN:'x'.repeat(32)}));
it('promotes private Upstash configuration and never the local Chroma endpoint',()=>{
 expect(productionRetrievalValues({UPSTASH_VECTOR_REST_URL:'https://fixture.upstash.io',UPSTASH_VECTOR_REST_TOKEN:'secret',CONTENT_RAG_URL:'http://127.0.0.1:8010'})).toEqual({UPSTASH_VECTOR_REST_URL:'https://fixture.upstash.io',UPSTASH_VECTOR_REST_TOKEN:'secret',UPSTASH_VECTOR_NAMESPACE:'basira-content-v1'});
});
it('rejects partial or unsafe Vector configuration',()=>{
 for(const value of [{UPSTASH_VECTOR_REST_TOKEN:'secret'},{UPSTASH_VECTOR_REST_URL:'https://fixture.upstash.io'},{UPSTASH_VECTOR_REST_URL:'https://other.example',UPSTASH_VECTOR_REST_TOKEN:'secret'}])expect(()=>productionRetrievalValues(value)).toThrow();
});
