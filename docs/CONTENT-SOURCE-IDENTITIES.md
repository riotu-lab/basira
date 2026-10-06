# Content source identities

Checked 6 October 2026. Machine-readable audit: `data/content/source-identities.json`.

## Result

The source families are no longer wholly unknown. The archive's **search/search.py** explicitly names الموسوعة العقدية, الموسوعة الفقهية and التفسير المحرر. The earlier inventory correctly found no bibliographic metadata keys, but missed this declaration and the creed introduction's institutional attribution.

That identifies leads, not every imported passage, its exact edition, or permission to reuse it. No runtime passage has been promoted to `identified` through this audit. Existing source-practice eligibility and production data are unchanged.

| Imported group | Declared work and identity evidence | Compiler / publisher | Exact imported edition |
|---|---|---|---|
| aqeeda: 8,796 | الموسوعة العقدية; `aqeeda-00001` explicitly describes the Dorar compilation | Scientific department, Dorar al-Saniyyah; institution named internally | Unknown; older electronic catalogue is a lead |
| fiqh: 1,078 | الموسوعة الفقهية; archive declaration and a corresponding secondary catalogue/table of contents | Catalogue attributes the compilation to researchers supervised by علوي بن عبد القادر السقاف, published on Dorar | Unknown; catalogue describes three automatically paginated parts, downloaded Rabi I 1433 AH |
| tafsir: 28,868 | التفسير المحرر; opening and closing sample passages correspond to official pages | Dorar scientific department | Unknown web snapshot; no printed edition assigned |

Official work pages: [creed](https://dorar.net/aqeeda), [fiqh](https://dorar.net/feqhia), [tafsir](https://dorar.net/tafseer). The [official FAQ](https://dorar.net/feedback) identifies the scientific department as the compiler of the encyclopedias. These institutional facts do not establish the exact provenance of every imported record.

## Passage checks and attribution caveats

- `aqeeda-00001`: internal introduction names مؤسسة الدرر السنية and describes collecting material from more than 140 references. The [older electronic catalogue](https://islamport.com/l/aqd/587/1.htm) is a snapshot lead, not a verified edition assignment.
- `fiqh-00000`: opening purification content and headings correspond to the [electronic fiqh catalogue](https://www.islamarchive.cc/ketab_content/4641). However, [IslamHouse](https://islamhouse.com/ar/articles/707270/) attributes the same purification topic to Muhammad ibn Ibrahim al-Tuwayjiri's *Mukhtasar al-Fiqh al-Islami*, fifteenth edition. It would be incorrect to assign that author's name to the whole imported group on this basis.
- `tafsir-00000`: names of al-Fatiha and their evidence correspond to the [official introduction](https://dorar.net/tafseer/1).
- `tafsir-28867`: the closing discussion corresponds to the [official al-Nas commentary](https://dorar.net/tafseer/114/1), scientific-benefits section.
- The sampled tafsir imports omit bibliographic/hadith footnotes visible on the official pages. These are sample correspondences, **not complete exact-text validation**. Identifying the compilation does not recover missing references or authenticate every quoted hadith.

## Permissions: unresolved with a concrete restriction

The [official FAQ](https://dorar.net/feedback), under its question about downloadable encyclopedias, restricts them to site search/browsing and states that copying for separate use is not permitted. The site also carries a rights-reserved notice. No separate permission grant accompanies the imported archive.

Therefore the imported collection is **not permission-cleared**. Public availability, an unofficial mirror, purchased access, or a matching passage is not evidence of a reuse grant. This audit does not determine whether the teammate holds a separate applicable agreement.

To close this issue, obtain from the corpus contributor:

1. Original files and `build_vectordb.py` or equivalent ingestion configuration, including original URLs and download/snapshot dates.
2. Permission/license evidence covering this corpus and Basira's storage, embedding, excerpt display and processing through external providers; alternatively replace the collection with explicitly permitted sources.
3. Edition-specific passage/locator checks, including preservation of omitted footnotes.

No permission request was sent to anyone, no external data was deleted, and no collection was represented as approved.

## Reproducible inventory

Run `python3 scripts/sources/audit-content-provenance.py`. It opens SQLite read-only, checks each group's complete sequential ID coverage, and hashes every document. The full 38,742-record ID/hash inventory stays in ignored `.local/content-rag/provenance-inventory.json`; the source register stores only counts, boundaries, aggregate fingerprints and checked sample hashes. It contains no embeddings, source-body dump or credentials.

ID bounds: `aqeeda-00000`–`aqeeda-08795`, `fiqh-00000`–`fiqh-01077`, `tafsir-00000`–`tafsir-28867`. These bounds record archive membership, **not verified attribution of every record**.

## Identified Quran collection

Tanzil Arabic Quran, Simple edition 1.1, 6,236 verses: provenance, SHA-256 and license URLs are in `data/quran/manifest.json`; checksum mismatch fails loading. [Text license](https://tanzil.net/docs/Text_License): CC BY 3.0 with verbatim-text and attribution requirements. Existing notices remain. This separate verified corpus is unaffected by the imported encyclopedia permissions issue.
