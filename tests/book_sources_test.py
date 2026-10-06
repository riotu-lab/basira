"""Offline source-ingestion tests. Fixture content is not a religious source."""
import importlib.util,json,re,sqlite3,tempfile,unittest,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def load(name,file):
    spec=importlib.util.spec_from_file_location(name,ROOT/'scripts/sources'/file)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
books=load('books','import-books.py');drafts=load('drafts','prepare-book-drafts.py')

class SourceIngestionTests(unittest.TestCase):
    def test_markdown_preserves_text_and_original_line_locators(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'source.md'
            path.write_text('\n**سؤال المصدر**\n\nجواب المصدر كما ورد\n',encoding='utf-8')
            pages=books.extract_pages(path,'md')
            self.assertEqual(pages,[{'label':'Markdown line 2','text':'**سؤال المصدر**'},{'label':'Markdown line 4','text':'جواب المصدر كما ورد'}])
            self.assertTrue(all(books.usable(p) for p in pages))

    def test_manifest_preserves_all_eight_current_urls(self):
        resources=json.loads((ROOT/'data/training/resources.json').read_text())['resources']
        self.assertTrue(all(r['originalUrl'].startswith('https://') for r in resources))
        self.assertEqual(len({r['originalUrl'] for r in resources}),8)
        self.assertEqual([r['id'] for r in resources],['hindu-dawah','hindu-dialogue','christian-dialogue','christian-google-doc','atheism-objections','atheism-invitation','judaism-old-testament','judaism-ifham'])
        self.assertEqual(len(resources),8)
        for tradition in ['hinduism','christianity','atheism','judaism']:
            self.assertEqual(sum(r['tradition']==tradition for r in resources),2)
        self.assertEqual(len(set(r['id'] for r in resources)),8)
    def test_html_cannot_be_misidentified_as_a_book(self):
        self.assertEqual(books.detect_format(b'<!DOCTYPE html><html>Sign in</html>'),'html')
        self.assertEqual(books.detect_format(b'%PDF-1.7 example'),'pdf')
        with self.assertRaises(ValueError):books.check_url('http://d1.islamhouse.com/book.pdf')
        with self.assertRaises(ValueError):books.check_url('https://unrelated.example/book.pdf')
    def test_no_text_and_private_font_garbage_require_ocr(self):
        self.assertFalse(books.usable({'text':''}))
        self.assertFalse(books.usable({'text':'word '*70+'\ue001'*100}))
        self.assertTrue(books.usable({'text':'Original extracted text. '*10}))
        self.assertTrue(books.usable({'label':'DOCX paragraph 1','text':'لماذا يوجد شر؟'}))
    def test_pdf_extraction_keeps_page_locations_and_detects_scanned_page(self):
        import pymupdf
        with tempfile.TemporaryDirectory() as tmp:
            file=Path(tmp)/'fixture.pdf';pdf=pymupdf.open()
            page=pdf.new_page();page.insert_text((50,50),'Synthetic page text for source extraction tests. '*2)
            pdf.new_page();pdf.save(file);pdf.close()
            pages=books.extract_pages(file,'pdf')
            self.assertEqual([p['label'] for p in pages],['PDF 1','PDF 2'])
            self.assertIn('Synthetic',pages[0]['text']);self.assertFalse(books.usable(pages[1]))
    def test_docx_uses_paragraph_locators_not_invented_pages(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'fixture.docx'
            with zipfile.ZipFile(path,'w') as doc:
                doc.writestr('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>النص الأصلي</w:t></w:r></w:p></w:body></w:document>')
            self.assertEqual(books.extract_pages(path,'docx'),[{'label':'DOCX paragraph 1','text':'النص الأصلي'}])
    def test_chunks_preserve_exact_text_and_skip_unreadable_pages(self):
        text='Exact fixture passage. '*200
        pages=[{'label':'PDF 4','text':text},{'label':'PDF 5','text':''}]
        result=list(books.chunks(pages))
        self.assertGreater(len(result),1)
        for chunk in result:
            self.assertEqual(chunk['text'],text[chunk['start']:chunk['end']]);self.assertEqual(chunk['label'],'PDF 4')
    def test_retrieval_is_filtered_grounded_and_returns_empty_for_no_match(self):
        with tempfile.TemporaryDirectory() as tmp:
            output=Path(tmp)
            for id,tradition,text in [('a','hinduism','الإِيمَان والعمل أساس المثال '),('b','atheism','Evidence discussion fixture ' )]:
                books.write_json(output/id/'pages.json',{'title':'Synthetic fixture','downloadedUrl':'https://example.org/source','sha256':'fixture-sha','pages':[{'label':'PDF 3','text':text*20}]})
            resources=[{'id':'a','tradition':'hinduism'},{'id':'b','tradition':'atheism'}]
            self.assertGreater(books.index_documents(output,resources),0)
            found=books.search(output,'الايمان','hinduism')
            self.assertEqual(found[0]['source_id'],'a');self.assertEqual(found[0]['locator'],'PDF 3')
            self.assertIn('الإِيمَان',found[0]['text'])
            self.assertEqual(books.search(output,'الايمان','atheism'),[])
            self.assertEqual(books.search(output,'unfindableterm'),[])
    def test_windows_keep_adjacent_pages_and_do_not_bridge_missing_text(self):
        pages=[{'label':f'PDF {i}','text':'Source fixture sentence. '*8} for i in range(1,5)]
        grouped=drafts.windows(pages,limit=600)
        self.assertGreater(len(grouped),1)
        self.assertIn('PDF 1',grouped[0]['label'])
        self.assertTrue(all(len(g['text'])<=600 for g in grouped))
        pages[1]['text']=''
        groups=drafts.windows(pages)
        self.assertEqual(groups[0]['label'],'PDF 1')
        self.assertNotIn('PDF 2',' '.join(g['label'] for g in groups))

if __name__=='__main__':unittest.main()
