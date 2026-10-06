#!/usr/bin/env python3
"""Import the active teammate-supplied references. No model calls, credentials or publishing.
Keep binaries, extraction and the search index under ignored .local/book-sources/.
"""
import argparse, hashlib, html, json, re, socket, sqlite3, sys, urllib.error, urllib.parse, urllib.request, zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[2]
MAX_BYTES = 50 * 1024 * 1024
ALLOWED_HOSTS = {'d1.islamhouse.com', 'www.alukah.net', 'alukah.net', 'islamhouse.com', 'islamcontent.com', 'docs.google.com', 'drive.google.com', 'drive.usercontent.google.com', 'dawa.center'}

def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(path)

def normalize(text):
    text = re.sub(r'[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06edـ]', '', text)
    return re.sub(r'[^\w\s]', ' ', text.translate(str.maketrans('أإآٱى', 'ااااي'))).lower()

def classify_error(error):
    if isinstance(error, urllib.error.HTTPError):
        return 'authentication_or_access' if error.code in (401, 403) else f'http_{error.code}'
    reason = getattr(error, 'reason', error)
    if isinstance(reason, socket.gaierror): return 'network_dns'
    if isinstance(reason, PermissionError): return 'environment_permission'
    if isinstance(reason, TimeoutError): return 'network_timeout'
    return 'network_or_tls'

def check_url(url):
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != 'https' or parsed.hostname not in ALLOWED_HOSTS or parsed.username or parsed.password:
        raise ValueError('Unapproved source destination')

class SourceRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        check_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)

def fetch(url):
    check_url(url)
    opener = urllib.request.build_opener(SourceRedirect)
    with opener.open(urllib.request.Request(url, headers={'User-Agent':'Basira-source-import/1.0'}), timeout=30) as response:
        if int(response.headers.get('Content-Length', '0')) > MAX_BYTES: raise ValueError('source_size_limit')
        body = response.read(MAX_BYTES + 1)
        if len(body) > MAX_BYTES: raise ValueError('source_size_limit')
        return body, response.geturl()

def detect_format(body):
    if body.startswith(b'%PDF-'): return 'pdf'
    if body.startswith(b'PK\x03\x04'): return 'docx'
    text = body[:1000].decode('utf-8', errors='ignore').lower()
    return 'html' if '<html' in text or '<!doctype' in text else 'txt'

def extract_pages(path, kind):
    if kind == 'md':
        # Keep the supplied text verbatim and cite lines, not invented Word pages.
        return [{'label':f'Markdown line {i+1}', 'text':line}
                for i,line in enumerate(path.read_text(encoding='utf-8-sig').split('\n')) if line.strip()]
    if kind == 'pdf':
        import pymupdf
        with pymupdf.open(path) as doc:
            return [{'label':f'PDF {i+1}', 'text':page.get_text(sort=True)} for i, page in enumerate(doc)]
    if kind == 'docx':
        with zipfile.ZipFile(path) as archive:
            info = archive.getinfo('word/document.xml')
            if info.file_size > 80 * 1024 * 1024: raise ValueError('docx_expanded_size_limit')
            root = ET.fromstring(archive.read(info))
            ns = {'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            # DOCX paragraphs are stable locators; do not fabricate PDF page numbers.
            return [{'label':f'DOCX paragraph {i+1}', 'text':''.join(p.itertext())}
                    for i,p in enumerate(root.findall('.//w:p',ns))]
    if kind == 'txt':
        text = path.read_text(encoding='utf-8-sig')
        if '<html' in text[:1000].lower(): raise ValueError('login_or_html_response')
        return [{'label':f'Text paragraph {i+1}', 'text':p} for i,p in enumerate(re.split(r'\n\s*\n',text))]
    raise ValueError('No document body found; landing page is not book content')

def usable(page):
    text = page['text']
    letters = re.findall(r'[^\W\d_]', text, re.UNICODE)
    broken = len(re.findall(r'[\ue000-\uf8ff\ufffd]', text))
    # Scanned/garbled pages require OCR or manual correction; never index them as good text.
    minimum = 2 if page.get('label','').startswith(('DOCX paragraph ', 'Text paragraph ', 'Markdown line ')) else 50
    return len(letters) >= minimum and broken / max(1,len(text)) < 0.02

def chunks(pages, size=1800, overlap=200):
    for page in pages:
        if not usable(page): continue
        text=page['text']
        start=0
        while start < len(text):
            end=min(start+size,len(text))
            if end < len(text):
                boundary=text.rfind(' ',start+size//2,end)
                if boundary>start:end=boundary
            yield {'label':page['label'],'start':start,'end':end,'text':text[start:end]}
            if end==len(text):break
            start=max(start+1,end-overlap)

def index_documents(output, manifest):
    database=output/'index.sqlite'
    temporary=output/'index.sqlite.tmp'
    if temporary.exists():temporary.unlink()
    conn=sqlite3.connect(temporary)
    conn.execute('CREATE VIRTUAL TABLE passages USING fts5(search_text, text UNINDEXED, source_id UNINDEXED, tradition UNINDEXED, title UNINDEXED, url UNINDEXED, locator UNINDEXED, sha256 UNINDEXED)')
    count=0
    for source in manifest:
        path=output/source['id']/'pages.json'
        if not path.exists():continue
        data=json.loads(path.read_text())
        for chunk in chunks(data['pages']):
            conn.execute('INSERT INTO passages VALUES (?,?,?,?,?,?,?,?)', (normalize(chunk['text']),chunk['text'],source['id'],source['tradition'],data['title'],data['downloadedUrl'],chunk['label'],data['sha256']))
            count+=1
    conn.commit();conn.close();temporary.replace(database)
    return count

def search(output, query, tradition=None):
    path=output/'index.sqlite'
    if not path.exists():raise ValueError('No index exists. Run the import first.')
    tokens=re.findall(r'\w+',normalize(query))[:24]
    if not tokens:return []
    expression=' OR '.join('"'+token+'"' for token in tokens)
    conn=sqlite3.connect(path);conn.row_factory=sqlite3.Row
    sql='SELECT source_id,tradition,title,url,locator,text,sha256 FROM passages WHERE passages MATCH ?'
    args=[expression]
    if tradition:sql+=' AND tradition=?';args.append(tradition)
    sql+=' ORDER BY bm25(passages) LIMIT 5'
    rows=[dict(row) for row in conn.execute(sql,args)];conn.close();return rows

def import_source(source, output):
    folder=output/source['id'];folder.mkdir(parents=True,exist_ok=True)
    page_file=folder/'pages.json'
    if source.get('localPath'):
        local=(ROOT/source['localPath']).resolve()
        if not local.is_relative_to((ROOT/'.local/book-sources').resolve()):raise ValueError('local_source_outside_private_collection')
        if local.is_file():
            if local.stat().st_size>MAX_BYTES:raise ValueError('source_size_limit')
            body=local.read_bytes();digest=hashlib.sha256(body).hexdigest()
            pages=extract_pages(local,source['localFormat']);good=sum(map(usable,pages))
            data={**source,'downloadedUrl':source['originalUrl'],'retrievedAt':datetime.now(timezone.utc).isoformat(),'sha256':digest,'format':source['localFormat'],'status':'extracted_unreviewed' if good else 'ocr_required','pages':pages,'usablePages':good,'skippedLocators':[p['label'] for p in pages if not usable(p)],'identityCheck':'User-supplied copy of linked document; title/author from text; remote equivalence not independently checked'}
            write_json(page_file,data)
            return {'id':source['id'],'status':data['status'],'origin':'user_supplied_local','pages':len(pages),'usablePages':good}
    if page_file.exists():
        data=json.loads(page_file.read_text())
        return {'id':source['id'],'status':'cached','pages':len(data['pages']),'usablePages':sum(map(usable,data['pages']))}
    original={'url':source['originalUrl'],'format':source['format'],'identity':'Original teammate URL'}
    attempts=[]
    for candidate in [original,*source['alternatives']]:
        url=candidate['url']
        # An edit page is never mistaken for exported document content.
        if candidate['format']=='google_doc':
            attempts.append({'url':url,'status':'use_official_export'});continue
        try:
            body,final_url=fetch(url)
            kind=detect_format(body)
            if kind=='html':
                text=body.decode('utf-8',errors='replace')
                links=[urllib.parse.urljoin(final_url,html.unescape(x)) for x in re.findall(r'href=[\"\x27]([^\"\x27]+)',text,re.I)]
                links=list(dict.fromkeys(x for x in links if re.search(r'\.(pdf|docx)(?:$|[?#])',x,re.I)))
                if candidate['format']!='html' or len(links)!=1:raise ValueError('landing_page_without_unique_document')
                body,final_url=fetch(links[0]);kind=detect_format(body)
            if kind not in ('pdf','docx','txt') or (kind=='txt' and candidate['format']!='txt'):raise ValueError('unexpected_document_format')
            path=folder/f'original.{kind}';path.write_bytes(body)
            pages=extract_pages(path,kind)
            if not pages:raise ValueError('no_extracted_pages')
            good=sum(map(usable,pages))
            data={**source,'downloadedUrl':final_url,'retrievedAt':datetime.now(timezone.utc).isoformat(),'sha256':hashlib.sha256(body).hexdigest(),'format':kind,'status':'extracted_unreviewed' if good else 'ocr_required','pages':pages,'usablePages':good,'skippedLocators':[p['label'] for p in pages if not usable(p)],'identityCheck':candidate['identity']}
            write_json(page_file,data)
            return {'id':source['id'],'status':data['status'],'downloadedUrl':final_url,'pages':len(pages),'usablePages':good,'attempts':attempts}
        except (OSError,ValueError,zipfile.BadZipFile,ET.ParseError,ImportError,RuntimeError) as error:
            category=classify_error(error) if isinstance(error,(urllib.error.URLError,TimeoutError,PermissionError)) else str(error)[:160]
            attempts.append({'url':url,'status':'failed','category':category})
            # Do not repeatedly probe alternative URLs after a runtime connectivity failure.
            if category in ('network_dns','environment_permission'):break
    return {'id':source['id'],'status':'blocked','attempts':attempts}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=ROOT/'.local/book-sources')
    parser.add_argument('--search');parser.add_argument('--tradition')
    parser.add_argument('--only',help='Import only one resource ID')
    args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    if args.search:
        print(json.dumps(search(args.output,args.search,args.tradition),ensure_ascii=False,indent=2));return
    manifest=json.loads((ROOT/'data/training/resources.json').read_text())['resources']
    if args.only and not any(s['id']==args.only for s in manifest):raise ValueError('Unknown resource ID')
    results=[]
    for source in manifest:
        if args.only and args.only!=source['id']:continue
        result=import_source(source,args.output);results.append(result)
        print(json.dumps(result,ensure_ascii=False),flush=True)
        write_json(args.output/'status.json',{'checkedAt':datetime.now(timezone.utc).isoformat(),'resources':results})
    count=index_documents(args.output,manifest)
    write_json(args.output/'status.json',{'checkedAt':datetime.now(timezone.utc).isoformat(),'resources':results,'indexedChunks':count,'retrieval':'local lexical BM25; not yet connected to live assessment'})
    print(json.dumps({'indexedChunks':count,'statusFile':str(args.output/'status.json')}))
    if any(r['status']=='blocked' for r in results):sys.exit(2)

if __name__=='__main__':
    try:main()
    except (OSError,ValueError,sqlite3.Error) as error:
        print(json.dumps({'error':str(error)}),file=sys.stderr);sys.exit(1)
