#!/usr/bin/env python3
"""Return a source window; render PDF pages for VLM reading, never run OCR."""
import base64,json,sys,hashlib
from pathlib import Path
import pymupdf
root=Path(__file__).resolve().parents[2]
source_id=sys.argv[1];offset=int(sys.argv[2])
manifest=json.loads((root/'data/training/resources.json').read_text())['resources']
source=next(s for s in manifest if s['id']==source_id)
folder=root/'.local/book-sources'/source_id
book=json.loads((folder/'pages.json').read_text())
original=root/source['localPath'] if source.get('localPath') else folder/('original.'+book['format'])
if hashlib.sha256(original.read_bytes()).hexdigest()!=book['sha256']:
    raise ValueError('Source bytes changed; re-ingest before extraction')
units=[]
if book['format']=='pdf':
    with pymupdf.open(folder/'original.pdf') as pdf:
        end=min(offset+4,len(pdf))
        for i in range(offset,end):
            page=pdf[i];scale=min(3,2400/max(page.rect.width,page.rect.height))
            pix=page.get_pixmap(matrix=pymupdf.Matrix(scale,scale),alpha=False)
            units.append({'label':f'PDF {i+1}','image':'data:image/png;base64,'+base64.b64encode(pix.tobytes('png')).decode()})
        next_offset=end-1 if end<len(pdf) else end
        done=end>=len(pdf)
else:
    pages=book['pages'];end=offset;size=0
    while end<len(pages) and (size<14000 or end==offset):
        page=pages[end]
        units.append({'label':page['label'],'text':page['text']})
        size+=len(page['text']);end+=1
    next_offset=max(offset+1,end-2) if end<len(pages) else end
    done=end>=len(pages)
print(json.dumps({'source':source,'sha256':book['sha256'],'units':units,'next':next_offset,'done':done},ensure_ascii=False))
