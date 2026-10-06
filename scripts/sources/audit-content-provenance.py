"""Read-only corpus inventory; no passage text, credentials or embeddings are exported."""
import argparse, collections, hashlib, json, pathlib, sqlite3
p=argparse.ArgumentParser();p.add_argument('--database',default='.local/content-rag/vectordb/chroma.sqlite3');p.add_argument('--output',default='.local/content-rag/provenance-inventory.json');a=p.parse_args()
c=sqlite3.connect(pathlib.Path(a.database).resolve().as_uri()+'?mode=ro',uri=True)
groups=collections.defaultdict(list)
for ident,source,document in c.execute("SELECT e.embedding_id,s.string_value,d.string_value FROM embeddings e JOIN embedding_metadata s ON s.id=e.id AND s.key='source' JOIN embedding_metadata d ON d.id=e.id AND d.key='chroma:document' ORDER BY e.embedding_id"):
 groups[source].append({'id':ident,'sha256':hashlib.sha256(document.encode()).hexdigest()})
result={'schemaVersion':1,'total':sum(map(len,groups.values())),'groups':{}}
for source,rows in groups.items():
 expected=[f'{source}-{i:05}' for i in range(len(rows))]
 if [r['id'] for r in rows]!=expected: raise ValueError('Unexpected source ID sequence: '+source)
 digest=hashlib.sha256(''.join(r['id']+'\t'+r['sha256']+'\n' for r in rows).encode()).hexdigest()
 result['groups'][source]={'count':len(rows),'firstId':rows[0]['id'],'lastId':rows[-1]['id'],'contentFingerprint':digest,'records':rows}
out=pathlib.Path(a.output);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'total':result['total'],'groups':{s:{k:v for k,v in g.items() if k!='records'} for s,g in result['groups'].items()}},ensure_ascii=False))
