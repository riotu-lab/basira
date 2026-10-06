"""Resumable private Chroma -> Upstash migration; preserves original vectors and passages.
Run with .local/rag-venv/bin/python scripts/migrations/content-vector.py
No embeddings are regenerated; retries upsert the same stable IDs. Never logs credentials.
"""
import hashlib,json,os,time,urllib.request,urllib.error
from pathlib import Path
import chromadb
from dotenv import dotenv_values
root=Path(__file__).resolve().parents[2]
e={**dotenv_values(root/'.env'),**os.environ}
url=e.get('UPSTASH_VECTOR_REST_URL','').rstrip('/')
token=e.get('UPSTASH_VECTOR_REST_TOKEN','')
from urllib.parse import urlparse,quote
u=urlparse(url)
if u.scheme!='https' or not (u.hostname or '').endswith('.upstash.io') or u.path or u.username or u.password or u.query or u.fragment or not token:raise SystemExit('invalid_vector_configuration')
namespace=e.get('UPSTASH_VECTOR_NAMESPACE') or 'basira-content-v1'
def call(path,body=None):
 for attempt in range(4):
  try:
   req=urllib.request.Request(url+path,data=json.dumps(body,ensure_ascii=False).encode() if body is not None else None,headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'})
   with urllib.request.urlopen(req,timeout=60) as response:result=json.load(response)
   if 'error' in result:raise SystemExit('vector_api_error')
   return result['result']
  except urllib.error.HTTPError as ex:
   if ex.code not in [429,500,502,503,504]:raise SystemExit('vector_http_'+str(ex.code))
  except (urllib.error.URLError,TimeoutError):pass
  time.sleep(2**attempt)
 raise SystemExit('vector_request_failed_after_retries')
info=call('/info')
if info.get('dimension')!=3072 or info.get('similarityFunction')!='COSINE':raise SystemExit('incompatible_index')
db=e.get('CONTENT_RAG_DB_PATH') or str(root/'.local/content-rag/vectordb')
if not Path(db,'chroma.sqlite3').is_file():raise SystemExit('local_corpus_missing')
c=chromadb.PersistentClient(path=db,settings=chromadb.Settings(anonymized_telemetry=False)).get_collection('islamthon',embedding_function=None)
if c.count()!=38742:raise SystemExit('unexpected_corpus_count')
checkpoint=root/'.local/content-rag/upstash-migration.json'
identity=hashlib.sha256((url+'|'+namespace+'|'+str(Path(db).resolve())).encode()).hexdigest()
saved=json.loads(checkpoint.read_text()) if checkpoint.exists() else {}
offset=saved.get('offset',0) if saved.get('identity')==identity else 0
print(json.dumps({'stage':'start','total':c.count(),'resumeOffset':offset}),flush=True)
from concurrent.futures import ThreadPoolExecutor
with ThreadPoolExecutor(max_workers=4) as pool:
 while offset<c.count():
  futures=[];window_count=0
  for batch_offset in range(offset,min(offset+400,c.count()),100):
   batch=c.get(limit=100,offset=batch_offset,include=['embeddings','documents','metadatas'])
   rows=[]
   for ident,vector,doc,meta in zip(batch['ids'],batch['embeddings'],batch['documents'],batch['metadatas']):
    if len(vector)!=3072 or meta.get('source') not in ['aqeeda','fiqh','tafsir'] or not doc:raise SystemExit('invalid_corpus_record')
    rows.append({'id':ident,'vector':vector.tolist(),'data':doc,'metadata':{**meta,'basira_corpus':'islamthon-v1'}})
   if not rows:raise SystemExit('empty_batch')
   window_count+=len(rows)
   futures.append(pool.submit(call,'/upsert/'+quote(namespace,safe=''),rows))
  for future in futures:
   if future.result()!='Success':raise SystemExit('upsert_not_confirmed')
  # Advance only after every batch in this bounded window is acknowledged.
  offset+=window_count
  checkpoint.parent.mkdir(parents=True,exist_ok=True)
  tmp=checkpoint.with_suffix('.tmp');tmp.write_text(json.dumps({'identity':identity,'offset':offset,'total':c.count()}));tmp.replace(checkpoint)
  print(json.dumps({'stage':'migrated','count':offset,'total':c.count()}),flush=True)
for attempt in range(30):
 info=call('/info');ns=info.get('namespaces',{}).get(namespace,{})
 if ns.get('vectorCount')==c.count() and not ns.get('pendingVectorCount'):break
 time.sleep(2)
else:raise SystemExit('index_not_ready_yet_rerun_to_verify')
print(json.dumps({'stage':'complete','count':ns['vectorCount'],'pending':ns.get('pendingVectorCount',0)}),flush=True)
