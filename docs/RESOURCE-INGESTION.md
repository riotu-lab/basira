# Eight training sources — current retrieval and import status

> **Successful download retry, 4 October 2026:** All eight active resources are now local. Both new Judaism PDFs were downloaded and their stored hashes verified. The 153-page Old Testament book yielded extractable text; the 216-page ifham book needs OCR. The active index contains 3,517 chunks and six books have draft inputs. Earlier DNS-failure notes below are historical. No new training questions were generated.

Source catalog updated 2026-10-04; see `data/training/resources.json`. The catalog preserves all eight original links in document order: two each for Hinduism, Christianity, atheism and Judaism.

## Current resources

| Resource ID | Title | Local status |
| --- | --- | --- |
| `hindu-dawah` | دعوة الهندوس إلى الإسلام | Cached; 775 PDF pages, no usable extracted pages; OCR required |
| `hindu-dialogue` | حوار هادئ بين هندوسي ومسلم | Cached; 24 of 35 PDF pages pass extraction checks |
| `christian-dialogue` | حوار هادئ بين نصراني ومسلم | Cached; 56 of 65 PDF pages pass extraction checks; alternative-edition identity still requires review |
| `christian-google-doc` | مائة سؤال في النصرانية ليس لها إجابة | User-supplied Markdown and Word retained; 533 usable Markdown lines indexed |
| `atheism-objections` | الرد على أشهر شبهات الملحدين | Cached DOCX; 2,551 usable paragraph units, not PDF pages |
| `atheism-invitation` | كيف تدعو ملحدًا؟ | Cached; 10 of 65 PDF pages pass extraction checks; substantial text gaps |
| `judaism-old-testament` | هل العهد القديم كلمة الله؟ — منقذ بن محمود السقار | Downloaded; 153 PDF pages pass extraction checks |
| `judaism-ifham` | بذل المجهود في إفحام اليهود (ت: طويلة) — السموأل بن يحي المغربي | Downloaded; 216 PDF pages, no usable text; OCR required |

New Judaism source records and their actual download links:

- [Record 2125](https://dawa.center/file/2125), [PDF download](https://dawa.center/file/2125/download).
- [Record 590](https://dawa.center/file/590?lang=ar), [PDF download](https://dawa.center/file/590/download), [publisher preview PDF](https://dawa.center/storage/files/597a92de6e667.pdf).

The research browser could read the first PDF and both publisher records, but that does not put book files in the repository. Runtime downloads failed DNS for both new records; the research download of record 590 returned HTTP 403. No security controls were bypassed.

The old `people-of-book` entry was removed from the active catalog. Its local directory was preserved at `.local/retired-book-sources/people-of-book/`, outside active ingestion and draft preparation. The rebuilt index contains **3,517 chunks** from the current collection, with no retired-source passages. Six resources have draft inputs; no new question/answer extraction was run.

Full books remain private in `.local/`; public availability is not a redistribution license. The Google document uses the user's supplied local copy and is no longer an ingestion blocker.

## One command to unblock retrieval

From the normal terminal in the Basira repository:

```bash
npm run sources:books
```

This makes ordinary HTTPS downloads, extracts locally and builds a **local lexical BM25 retrieval index**. It does not invoke a paid model, use API credentials, change the application, or publish books. It resumes from completed `pages.json` files. Exit code 2 means at least one resource is blocked; successful resources are retained.

Python 3 and PyMuPDF are required (both available in the inspected development environment). If PyMuPDF is missing elsewhere, install `scripts/sources/requirements.txt` in your usual Python environment. No extra hosted dependency is introduced.

Outputs are under ignored `.local/book-sources/`:

- `status.json`: exact per-resource attempt/status, download URL and indexed chunk count.
- `<resource-id>/original.pdf` or `.docx` / `.txt`: original downloaded bytes.
- `<resource-id>/pages.json`: actual extracted text, locators, SHA-256, source metadata and unreadable-page list.
- `index.sqlite`: normalized search text with original passages, source IDs, context, URL and page/paragraph locators.

PDF locators are actual PDF pages. DOCX/text exports use paragraph locators rather than invented pagination. Empty or damaged pages are omitted from retrieval and recorded for OCR/correction. Short DOCX question headings are preserved. Originals and full book text stay out of Git and deployment; public availability alone is not treated as a redistribution license.

Search the imported passages:

```bash
npm run sources:books -- --search "معنى الإسلام" --tradition hinduism
```

An empty result remains empty. The index is a retrieval component, **not yet wired to live answer generation or publication verification**. It does not validate a claim merely because a book mentions it.

## Prepare question extraction after downloads succeed

```bash
npm run sources:book-drafts
```

This prepares bounded, overlapping adjacent-page windows at `<resource-id>/draft-input.json`. It preserves original text and does not bridge missing/OCR-required pages. It skips resources lacking verified author/title metadata. Its report lists every skipped resource.

The existing model extraction command can then process one prepared book:

```bash
node --import tsx scripts/sources/draft-book-questions.ts .local/book-sources/hindu-dialogue/draft-input.json .local/book-sources/hindu-dialogue/question-drafts.json
```

That separate command uses the configured text-model API and consumes ordinary API credit. It produces drafts, with exact supporting source excerpts, rather than silently publishing answers. Review completeness, attribution, source interpretation and English translations; deduplicate overlaps and assign canonical key points before adding source-checked questions to the live bank. Unknown book identity and missing source text must not be filled in from model memory.

## Verification

Nine offline tests cover all eight current links and two resources per background, PDF/DOCX extraction, real locator retention, unreadable text, exact chunk spans, Arabic normalization, context-filtered retrieval, empty results, and draft window boundaries. These use synthetic local documents; they are not successful internet downloads or live model calls.
