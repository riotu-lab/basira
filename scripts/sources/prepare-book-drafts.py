#!/usr/bin/env python3
"""Prepare bounded page windows for draft-book-questions.ts; never call a model or publish."""
import argparse, importlib.util, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('book_import',Path(__file__).with_name('import-books.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

def windows(pages,limit=16000):
    groups=[];pending=[];size=0
    for page in pages:
        if not module.usable(page):
            if pending:groups.append(pending);pending=[];size=0
            continue
        # Preserve source text verbatim; oversized pages require explicit subdivision/review.
        if len(page['text'])>limit:
            if pending:groups.append(pending);pending=[];size=0
            continue
        if pending and size+len(page['text'])+2>limit:
            groups.append(pending)
            # One-page overlap preserves Q/A that straddles the window boundary.
            last=pending[-1]
            pending=[last] if len(last['text'])+len(page['text'])+2<=limit else []
            size=sum(len(p['text'])+2 for p in pending)
        pending.append(page);size+=len(page['text'])+2
    if pending:groups.append(pending)
    return [{'label':' → '.join([g[0]['label'],g[-1]['label']]) if len(g)>1 else g[0]['label'],'text':'\n\n'.join(p['text'] for p in g)} for g in groups]

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',type=Path,default=ROOT/'.local/book-sources')
    args=parser.parse_args();prepared=[];blocked=[]
    resources=json.loads((ROOT/'data/training/resources.json').read_text())['resources']
    for resource in resources:
        path=args.input/resource['id']/'pages.json'
        if not path.exists():blocked.append({'id':resource['id'],'reason':'not_downloaded'});continue
        book=json.loads(path.read_text())
        if not book.get('author'):blocked.append({'id':resource['id'],'reason':'source_title_author_need_verification'});continue
        grouped=windows(book['pages'])
        if not grouped:blocked.append({'id':resource['id'],'reason':'ocr_or_text_correction_required'});continue
        target=path.parent/'draft-input.json'
        module.write_json(target,{'tradition':resource['tradition'],'extractionScope':resource.get('extractionScope',''),'title':book['title'],'author':book['author'],'url':book['downloadedUrl'],'permission':book['rights'],'pages':grouped,'sourceSha256':book['sha256'],'identityCheck':book['identityCheck'],'status':'draft_input_not_approved'})
        prepared.append({'id':resource['id'],'input':str(target),'windows':len(grouped)})
    module.write_json(args.input/'draft-input-status.json',{'prepared':prepared,'blocked':blocked})
    print(json.dumps({'prepared':prepared,'blocked':blocked},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
