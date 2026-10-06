import '../lib/output-dirs.mjs';
// Official Tanzil download; retain the original text and its embedded license.
import {writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const url='https://tanzil.net/pub/download/index.php?quranType=simple&outType=txt-2&marks=true&sajdah=true&agree=true';
const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
if(!response.ok)throw Error(`Source HTTP ${response.status}`);
const raw=await response.text();
const verses=raw.split(/\r?\n/).filter(l=>/^\d+\|\d+\|/.test(l));
if(verses.length!==6236||!raw.includes('Tanzil'))throw Error('Unexpected Quran corpus or missing attribution; nothing written');
const metadataUrl='https://tanzil.net/res/text/metadata/quran-data.xml';
const meta=await fetch(metadataUrl,{signal:AbortSignal.timeout(20000)});
if(!meta.ok)throw Error(`Metadata HTTP ${meta.status}`);
const metadata=await meta.text();if(!metadata.includes('<sura ')){console.log(metadata.slice(0,1200));throw Error('Unexpected metadata');}
mkdirSync('data/quran',{recursive:true});
writeFileSync('data/quran/tanzil-simple.txt',raw);
writeFileSync('data/quran/quran-data.xml',metadata);
writeFileSync('data/quran/manifest.json',JSON.stringify({provider:'Tanzil Project',edition:'Simple 1.1',url,metadataUrl,license:'CC BY 3.0, verbatim text; see embedded notice',licenseUrl:'https://tanzil.net/docs/Text_License',retrievedAt:new Date().toISOString(),verses:verses.length,sha256:createHash('sha256').update(raw).digest('hex')},null,2));
console.log(`Saved ${verses.length} Arabic verses verbatim with license and checksum. No translations, hadith or tafsir included.`);
