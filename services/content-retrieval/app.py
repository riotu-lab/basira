"""Private retrieval only. Embeddings are supplied by Basira's audited backend."""
import os
import secrets
from contextlib import asynccontextmanager
from functools import lru_cache
from typing import Literal
import chromadb
from fastapi import FastAPI, Depends, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field

@lru_cache
def collection():
    path = os.environ['CONTENT_RAG_DB_PATH']
    if not os.path.isfile(os.path.join(path, 'chroma.sqlite3')):
        raise RuntimeError('Index missing; refusing to create an empty database')
    client = chromadb.PersistentClient(path=path, settings=chromadb.Settings(anonymized_telemetry=False))
    c = client.get_collection('islamthon', embedding_function=None)
    if c.count() != 38742:
        raise RuntimeError('Unexpected corpus count')
    return c

@asynccontextmanager
async def lifespan(app):
    if len(os.environ.get('CONTENT_RAG_TOKEN', '')) < 32:
        raise RuntimeError('Configure a private retrieval token of at least 32 characters')
    collection()
    yield

app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

def authenticate(authorization: str = Header(default='')):
    token = os.environ.get('CONTENT_RAG_TOKEN', '')
    if not token or not secrets.compare_digest(authorization, 'Bearer ' + token):
        raise HTTPException(401, 'unauthorized')

class Query(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    embedding: list[float] = Field(min_length=3072, max_length=3072)
    source: Literal['aqeeda', 'fiqh', 'tafsir'] | None = None

class Search(BaseModel):
    model_config = ConfigDict(extra='forbid')
    queries: list[Query] = Field(min_length=1, max_length=30)

@app.get('/health', dependencies=[Depends(authenticate)])
def health():
    return {'ready': True, 'count': collection().count(), 'model': 'text-embedding-3-large', 'dimensions': 3072}

@app.post('/search', dependencies=[Depends(authenticate)])
def search(body: Search):
    results = []
    for query in body.queries:
        result = collection().query(query_embeddings=[query.embedding], n_results=3,
            where={'source': query.source} if query.source else None,
            include=['documents', 'metadatas', 'distances'])
        results.append([{'id': ident, 'text': doc[:6000], 'truncated': len(doc)>6000,
                         'metadata': meta, 'distance': distance}
            for ident, doc, meta, distance in zip(result['ids'][0], result['documents'][0],
                result['metadatas'][0], result['distances'][0])])
    return {'results': results}
