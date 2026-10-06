#!/usr/bin/env python3
"""Export reviewed Q&A candidates to JSON, JSONL, Markdown and searchable SQLite.
Exports the application's live Q&A files; does not claim human religious approval.
"""
import hashlib,json,re,sqlite3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
TRADITIONS=['hinduism','christianity','atheism','judaism']
def normalized(text):
    return re.sub(r'[^\w\s]','',re.sub(r'[\u064b-\u065f\u0670ـ]','',text)).strip()
def validate(q,tradition,resources):
    if q.get('personaReview',{}).get('version')==3 and not all(q.get('roleVerification',{}).get(k) is True for k in ['direction','selfContained','sourceFaithful','criteriaPreserved','bilingual']):raise ValueError('role_verification_missing')
    if not q.get('personaReview',{}).get('reviewed') or q['personaReview'].get('addressee')!='muslim_guide':raise ValueError('persona_review_missing')
    if q['tradition']!=tradition or not q['persona']['simulated']:raise ValueError('background_mismatch')
    for key in ['question','answer']:
        if any(not isinstance(q[key].get(lang),str) or not q[key][lang].strip() for lang in ['ar','en']):raise ValueError('missing_bilingual_text')
    if not 2<=len(q['points'])<=5 or len({p['id'] for p in q['points']})!=len(q['points']):raise ValueError('invalid_criteria')
    if any(not p['text'].get(lang,'').strip() for p in q['points'] for lang in ['ar','en']):raise ValueError('missing_criterion_translation')
    source=resources.get(q['source']['id'])
    if not source or source['tradition']!=tradition or q['source']['url']!=source['originalUrl']:raise ValueError('source_mismatch')
    if not q.get('modelReview',{}).get('faithful') or q['status']!='draft_requires_human_review':raise ValueError('unreviewed_model_record')
    if not q.get('evidence') or any(not e.get('quote','').strip() or not e.get('locator','').strip() for e in q['evidence']):raise ValueError('missing_evidence')
    return q

def main():
    resources={s['id']:s for s in json.loads((ROOT/'data/training/resources.json').read_text())['resources']}
    out=ROOT/'data/training/qa';out.mkdir(parents=True,exist_ok=True)
    temp=out/'qa.sqlite.tmp';temp.unlink(missing_ok=True)
    conn=sqlite3.connect(temp)
    conn.execute('CREATE TABLE questions(id TEXT PRIMARY KEY, background TEXT, question_ar TEXT, question_en TEXT, answer_ar TEXT, answer_en TEXT, topic TEXT, source_id TEXT, record_json TEXT)')
    conn.execute('CREATE VIRTUAL TABLE question_search USING fts5(id UNINDEXED, background UNINDEXED, question_ar, question_en, answer_ar, answer_en, topic)')
    snapshot_path=out/'deduplication.json'
    snapshot=json.loads(snapshot_path.read_text()) if snapshot_path.exists() else {}
    audits={}
    summary={};all_ids=set()
    for tradition in TRADITIONS:
        path=ROOT/f'data/training/drafts/{tradition}.json'
        original=json.loads(path.read_text()) if path.exists() else {'questions':[],'rejected':[]}
        dedup=ROOT/f'.local/qa-extraction/dedup-{tradition}.json'
        excluded=set()
        audit=json.loads(dedup.read_text()) if dedup.exists() else snapshot.get(tradition)
        if original['questions'] and not audit:raise ValueError('duplicate_audit_missing:'+tradition)
        if audit:
            audits[tradition]=audit
            audit_input=[{'id':q['id'],'question':q['question']['ar'],'answer':q['answer']['ar'],'topic':q['topic']} for q in original['questions']]
            digest=hashlib.sha256(json.dumps(audit_input,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
            if audit.get('inputHash')!=digest:raise ValueError('stale_duplicate_audit:'+tradition)
            excluded=set(audit.get('excludeIds',[]))
            if not excluded.issubset({q['id'] for q in original['questions']}):raise ValueError('unknown_duplicate_ids')
        records=[];seen=set()
        for q in original['questions']:
            validate(q,tradition,resources)
            local=ROOT/'.local/book-sources'/q['source']['id']/'pages.json'
            if local.exists():
                book=json.loads(local.read_text())
                if book['sha256']!=q['source']['sha256']:raise ValueError('source_hash_mismatch')
                if q['evidenceMethod']=='exact_text_match':
                    units={p['label']:p['text'] for p in book['pages']}
                    if any(e['quote'] not in units.get(e['locator'],'') for e in q['evidence']):raise ValueError('text_evidence_mismatch')
            if q['id'] in excluded:continue
            key=normalized(q['question']['ar'])
            if key in seen:continue
            seen.add(key)
            if q['id'] in all_ids:raise ValueError('duplicate_id')
            all_ids.add(q['id']);records.append(q)
        payload={'version':1,'background':tradition,'reviewStatus':'model_reviewed_human_review_pending','targetMinimum':50,'targetMaximum':100,'count':len(records),'targetMet':50<=len(records)<=100,'questions':records}
        (out/f'{tradition}.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n')
        (out/f'{tradition}.jsonl').write_text(''.join(json.dumps(q,ensure_ascii=False)+'\n' for q in records))
        lines=[f'# {tradition} — مراجعة قاعدة الأسئلة والأجوبة',f'عدد السجلات: {len(records)}. راجعتها النماذج آليًا؛ لا تزال مراجعة المختص مطلوبة.','']
        for i,q in enumerate(records,1):
            lines.extend([f'## {i}. {q["question"]["ar"]}',q['answer']['ar'],'',f'**المصدر:** {q["source"]["title"]} — {q["source"]["author"]}',q['source']['url'],'**معايير الإجابة:**',*[f'- {p["text"]["ar"]}' for p in q['points']],'**الشواهد:**',*[f'- {e["locator"]}: {e["quote"]}' for e in q['evidence']],f'**طريقة التحقق:** {q["evidenceMethod"]}',f'**المعرف:** `{q["id"]}`',''])
            conn.execute('INSERT INTO questions VALUES (?,?,?,?,?,?,?,?,?)',(q['id'],tradition,q['question']['ar'],q['question']['en'],q['answer']['ar'],q['answer']['en'],q['topic'],q['source']['id'],json.dumps(q,ensure_ascii=False)))
            conn.execute('INSERT INTO question_search VALUES (?,?,?,?,?,?,?)',(q['id'],tradition,normalized(q['question']['ar']),q['question']['en'],normalized(q['answer']['ar']),q['answer']['en'],q['topic']))
        (out/f'{tradition}.md').write_text('\n'.join(lines))
        summary[tradition]={'count':len(records),'targetMet':payload['targetMet'],'sourceIds':sorted({q['source']['id'] for q in records}),'modelRejected':len(original['rejected']),'deduplicated':len(original['questions'])-len(records)}
    conn.commit();conn.close();temp.replace(out/'qa.sqlite')
    snapshot_path.write_text(json.dumps(audits,ensure_ascii=False,indent=2)+'\n')
    (out/'status.json').write_text(json.dumps({'backgrounds':summary,'humanReviewed':False,'liveBankChanged':True},ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(summary,ensure_ascii=False))
if __name__=='__main__':main()
