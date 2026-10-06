"""Compare stratified local corpus samples with the private managed index."""
import os,json,urllib.request
from pathlib import Path
from urllib.parse import quote
import chromadb,numpy as np
from dotenv import dotenv_values
root=Path(__file__).resolve().parents[2];e={**dotenv_values(root/'.env'),**os.environ}
url=e['UPSTASH_VECTOR_REST_URL'].rstrip('/');token=e['UPSTASH_VECTOR_REST_TOKEN'];ns=quote(e.get('UPSTASH_VECTOR_NAMESPACE') or 'basira-content-v1',safe='')
def call(path,body=None):
 req=urllib.request.Request(url+path,data=json.dumps(body).encode() if body is not None else None,headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=40) as r:return json.load(r)['result']
c=chromadb.PersistentClient(path=e.get('CONTENT_RAG_DB_PATH') or str(root/'.local/content-rag/vectordb'),settings=chromadb.Settings(anonymized_telemetry=False)).get_collection('islamthon',embedding_function=None)
info=call('/info');state=info['namespaces'][e.get('UPSTASH_VECTOR_NAMESPACE') or 'basira-content-v1']
assert state['vectorCount']==c.count()==38742 and state.get('pendingVectorCount',0)==0,'index_count_mismatch'
results=[]
for source in ['aqeeda','fiqh','tafsir']:
 all_ids=c.get(where={'source':source},include=[])['ids']
 selected=[all_ids[i] for i in np.linspace(0,len(all_ids)-1,10,dtype=int)]
 samples=c.get(ids=selected,include=['embeddings','documents','metadatas'])
 positions=range(len(samples['ids']))
 ids=samples['ids']
 remote=call('/fetch/'+ns,{'ids':ids,'includeData':True,'includeMetadata':True,'includeVectors':True})
 for i,row in zip(positions,remote):
  assert row and row['id']==samples['ids'][i],'missing_id'
  assert row['data']==samples['documents'][i],'passage_changed'
  assert row['metadata']=={**samples['metadatas'][i],'basira_corpus':'islamthon-v1'},'metadata_changed'
  assert np.allclose(row['vector'],samples['embeddings'][i],rtol=1e-6,atol=1e-8),'vector_changed'
 query=call('/query/'+ns,{'vector':samples['embeddings'][positions[0]].tolist(),'topK':3,'includeMetadata':True,'includeData':True,'filter':"source = '"+source+"'"})
 assert len(query)>0 and query[0]['score']>.9999,'self_query_failed'
 assert all(r['metadata']['source']==source for r in query),'source_filter_failed'
 results.append({'source':source,'exactPassageMetadataVectorSamples':10,'filteredSelfQuery':True})
report={'total':state['vectorCount'],'pending':0,'samples':results,'allRecordsCompared':False}
(root/'artifacts/reports').mkdir(parents=True,exist_ok=True)
(root/'artifacts/reports/upstash-integrity.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
