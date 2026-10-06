import {locateOriginalSpan} from './contentStructure.js';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import type {Lang} from '../src/content.js';
import type {ContentFinding,ExtractedClaim,Reference,ReviewUnit} from '../src/contentReviewTypes.js';
import {ApiError} from './validation.js';

// The download prepends basmala to surah openings. Verse excerpts select the
// verbatim verse portion (except 1:1); the archived source is unchanged.
// Normalization is a search index only. Stored/displayed scripture is never changed.
export function normalizeArabic(s:string){return s.normalize('NFC').replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/g,'').replace(/ٱ/g,'ا').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();}
const digits=(s:string)=>s.replace(/[٠-٩۰-۹]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.includes(c)?'٠١٢٣٤٥٦٧٨٩'.indexOf(c):'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)));
type Verse={surah:number;ayah:number;text:string;normalized:string};
let cache:{verses:Verse[];names:Map<string,number>}|undefined;
function corpus(){
 if(cache)return cache;
 try{
  const raw=readFileSync(new URL('../data/quran/tanzil-simple.txt',import.meta.url),'utf8');
  const manifest=JSON.parse(readFileSync(new URL('../data/quran/manifest.json',import.meta.url),'utf8'));
  if(createHash('sha256').update(raw).digest('hex')!==manifest.sha256)throw Error();
  const verses=raw.split(/\r?\n/).filter(l=>/^\d+\|\d+\|/.test(l)).map(l=>{const [s,a,...t]=l.split('|');const rawText=t.join('|');const text=Number(s)>1&&Number(a)===1?rawText.replace(/^بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ\s+/,''):rawText;return {surah:Number(s),ayah:Number(a),text,normalized:normalizeArabic(text)};});
  if(verses.length!==6236)throw Error();
  const metadata=readFileSync(new URL('../data/quran/quran-data.xml',import.meta.url),'utf8');
  const names=new Map<string,number>();
  for(const m of metadata.matchAll(/<sura\s+([^>]+)>/g)){
    const attrs=Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]*)"/g)].map(v=>[v[1],v[2]]));
    for(const name of [attrs.name,attrs.tname,attrs.ename])if(name)names.set(normalizeArabic(name).toLowerCase(),Number(attrs.index));
  }
  return cache={verses,names};
 }catch{throw new ApiError('source_collection_unavailable',503);}
}
export function sourceCoverage(language:Lang){return language==='ar'?'النطاق: ٦٢٣٦ آية عربية من تنزيل، الإصدار 1.1. فحص الاقتباس والنسبة فقط؛ لا يشمل توثيق الحديث أو التفسير أو الفتاوى أو صحة الترجمات. قد يفوت الاستخراج الآلي بعض الادعاءات. عدم العثور على دليل لا يعني أن الادعاء خطأ.':'Coverage: 6,236 Arabic Quran verses, Tanzil 1.1. Quotation and attribution checks only; no hadith authentication, tafsir, rulings, or translation verification. Automated extraction can miss claims. Missing evidence does not establish that a claim is false.';}
function ref(v:Verse):Reference{return {id:`quran-${v.surah}-${v.ayah}`,title:`القرآن / Quran ${v.surah}:${v.ayah}`,url:`https://tanzil.net/#${v.surah}:${v.ayah}`,excerpt:v.text,provider:'Tanzil Project · Arabic Simple 1.1'};}
// Citation spelling normalization is separate from the unchanged scripture index.
const citationText=(s:string)=>normalizeArabic(digits(s)).toLowerCase().replace(/[أإآ]/g,'ا');
const arabicOrdinals:Record<string,number>={الاولى:1,الثانية:2,الثالثة:3,الرابعة:4,الخامسة:5,السادسة:6,السابعة:7,الثامنة:8,التاسعة:9,العاشرة:10};
function citedVerse(citation:string){
 const {verses,names}=corpus(),s=digits(citation);const numeric=s.match(/(?:^|\D)(\d{1,3})\s*[:：]\s*(\d{1,3})(?!\d)/);
 if(numeric)return verses.find(v=>v.surah===Number(numeric[1])&&v.ayah===Number(numeric[2]));
 const normalized=citationText(s);
 const named=[...names].filter(([name])=>(` ${normalized} `).includes(` ${citationText(name)} `));
 const surahs=[...new Set(named.map(([,surah])=>surah))];
 if(surahs.length!==1)return;
 const n=normalized.match(/(?:^|\s)(?:الاية|اية|verse|ayah)\s+(\d{1,3})(?:\s|$)/i)||normalized.match(/(?:^|\s)(\d{1,3})(?:\s|$)/);
 // Do not mistake "الثانية عشرة" or "الأولى والعشرون" for 2 or 1.
 const ordinal=normalized.match(/(?:^|\s)(?:الاية|اية)\s+(الاولى|الثانية|الثالثة|الرابعة|الخامسة|السادسة|السابعة|الثامنة|التاسعة|العاشرة)(?=$|\s+(?:من|في)\s+سورة)/);
 const ayah=n?Number(n[1]):ordinal?arabicOrdinals[ordinal[1]]:undefined;
 if(ayah)return verses.find(v=>v.surah===surahs[0]&&v.ayah===ayah);
}
export function validateUnits(input:unknown):ReviewUnit[]{
 if(!Array.isArray(input)||!input.length||input.length>100)throw new ApiError('invalid_content');
 let total=0;const ids=new Set<string>();
 const units=input.map(u=>{
  if(!u||typeof u.id!=='string'||u.id.length>100||ids.has(u.id)||!['text','audio','frame'].includes(u.kind)||typeof u.text!=='string'||!u.text.trim()||u.text.length>20000)throw new ApiError('invalid_content');
  if(u.kind!=='text'&&(!Number.isFinite(u.start)||u.start<0||!Number.isFinite(u.end)||u.end<u.start))throw new ApiError('invalid_content');
  ids.add(u.id);total+=u.text.length;
  return {id:u.id,text:u.text,originalText:typeof u.originalText==='string'?u.originalText:u.text,kind:u.kind,start:u.start,end:u.end,confirmed:u.kind==='text'||u.confirmed===true,frameId:u.frameId} as ReviewUnit;
 });
 if(total>20000)throw new ApiError('content_too_long',413);return units;
}
// Resolve spacing differences to original characters; never repair model wording.
function originalClaim(units:ReviewUnit[],claim:ExtractedClaim):ExtractedClaim{
 const unit=units.find(u=>u.id===claim?.unitId);
 if(!unit||typeof claim.passage!=='string'||!claim.passage.trim()||typeof claim.quote!=='string'||typeof claim.citation!=='string')throw new ApiError('invalid_content_evidence',502);
 const passage=locateOriginalSpan(unit.text,claim.passage).text;
 const part=(v:string)=>!v||passage.includes(v)?v:locateOriginalSpan(passage,v).text;
 return {...claim,passage,quote:part(claim.quote),citation:part(claim.citation)};
}
export function resolveClaims(units:ReviewUnit[],claims:ExtractedClaim[],language:Lang):ContentFinding[]{
 if(!Array.isArray(claims)||claims.length>30)throw new ApiError('invalid_content_evidence',502);
 const {verses}=corpus(),ar=language==='ar';const used=new Set<string>();
 return claims.map((claim,index)=>{
  const c=originalClaim(units,claim);
  const unit=units.find(u=>u.id===c.unitId);
  if(!unit||typeof c.passage!=='string'||!c.passage.trim()||typeof c.quote!=='string'||typeof c.citation!=='string'||!['quran_quote','hadith_attribution','religious_claim','interpretation','translation'].includes(c.kind))throw new ApiError('invalid_content_evidence',502);
  const start=unit.text.indexOf(c.passage);
  if(start<0||unit.text.indexOf(c.passage,start+1)!==-1||(c.quote&&!c.passage.includes(c.quote))||(c.citation&&!c.passage.includes(c.citation)))throw new ApiError('invalid_content_evidence',502);
  const identity=`${unit.id}:${start}:${c.passage.length}`;if(used.has(identity))throw new ApiError('invalid_content_evidence',502);used.add(identity);
  const f:ContentFinding={id:`finding-${index+1}`,unitId:unit.id,start,end:start+c.passage.length,passage:c.passage,quote:c.quote,category:'insufficient_evidence',explanation:ar?'لا توجد أدلة كافية ضمن المجموعة الحالية للحكم على هذا الادعاء. هذا لا يثبت خطأه.':'The current collection does not provide enough evidence to judge this claim. This does not establish that it is false.',reference:null,correction:null,uncertain:unit.kind!=='text'&&!unit.confirmed,decision:'pending',reviewerNote:'',editedCorrection:'',practiceEligible:false};
  const ruling=/\b(forbidden|mandatory|obligatory|permitted|halal|haram)\b|حرام|حلال|واجب|لا يجوز|يجوز|يحرم/i.test(c.passage);
  if((c.kind==='interpretation'||c.kind==='religious_claim')&&ruling){f.category='specialist_review';f.explanation=ar?'يتضمن هذا المقطع حكمًا دينيًا يحتاج إلى مختص وسياق أوسع. فحص الاقتباسات وحده لا يثبت هذا الحكم أو ينفيه.':'This passage contains a religious ruling requiring specialist context. Quotation checks alone cannot establish or disprove it.';return f;}
  if(c.kind==='interpretation'){f.category='out_of_scope';f.explanation=ar?'هذا تعليق أو تأمل في المعنى، وليس اقتباسًا مباشرًا. فحصنا يختص بصيغة الاقتباس ونسبته؛ لم نتحقق من هذا المعنى، ولم نرصد خطأ فيه.':'This is commentary or reflection on meaning, rather than a direct quotation. Our check covers quotation wording and attribution; this meaning was not verified or identified as an error.';return f;}
  if(c.kind!=='quran_quote'||!/[\u0600-\u06ff]/.test(c.quote))return f;
  if(/…|\.\.\./.test(c.quote)){f.category='specialist_review';f.explanation=ar?'يتضمن الاقتباس علامة اختصار. راجع الأجزاء المحذوفة والسياق؛ لا نعدّ الاختصار خطأ تلقائيًا.':'The quotation contains an omission marker. Review omitted portions and context; abbreviation is not automatically an error.';return f;}
  const quote=normalizeArabic(c.quote);
  const citation=c.citation.replace(c.quote,' ').trim();
  // A model may extract only the verse label; recover its chapter solely from
  // the same original passage. Never override a complete but invalid citation.
  const partialLabel=/^(?:الاية|اية|verse|ayah)\s+(?:[0-9]+|الاولى|الثانية|الثالثة|الرابعة|الخامسة|السادسة|السابعة|الثامنة|التاسعة|العاشرة)$/.test(citationText(citation));
  const cited=c.citation?(citedVerse(citation)||(partialLabel?citedVerse(c.passage.replace(c.quote,' ')):undefined)):undefined;
  if(quote.length<10||quote.split(' ').length<3){f.explanation=ar?'الاقتباس أقصر من أن يحدد مصدرًا موثوقًا بمفرده.':'The quotation is too short to identify a reliable source by itself.';return f;}
  const matches=verses.filter(v=>(` ${v.normalized} `).includes(` ${quote} `));
  if(c.citation&&!cited){
    if(matches.length===1)f.reference=ref(matches[0]);
    f.explanation=ar?'تعذّر تحديد الآية من الإحالة المكتوبة. أي مرجع معروض هو تطابق نصي مرشّح فقط، ولا يؤكد الإحالة أو يبطل الادعاء.':'The written citation could not be resolved. Any displayed reference is only a candidate text match; it does not confirm the attribution or establish that the claim is false.';
    return f;
  }
  if(cited){
    f.reference=ref(cited);
    if((` ${cited.normalized} `).includes(` ${quote} `)){f.category='textual_match';f.explanation=ar?'المقطع موجود في الآية المذكورة عند تجاهل التشكيل وعلامات الوقف. هذا ليس تقييمًا لتفسيره أو سياقه.':'The excerpt occurs in the cited verse after ignoring diacritics and pause marks. This does not assess interpretation or context.';}
    else if(matches.length===1){f.category='unsupported_attribution';f.relatedReference=ref(matches[0]);f.explanation=ar?'النص لا يقع في الآية المنسوب إليها، ويوجد تطابق في المرجع الآخر المعروض. راجع النسبة والسياق.':'The wording is absent from the cited verse and matches the other reference shown. Check the attribution and context.';f.correction=`${ar?'راجع الإحالة إلى':'Check the citation against'} ${matches[0].surah}:${matches[0].ayah}`;f.practiceEligible=true;}
    else{f.category='textual_mismatch';f.explanation=ar?'صيغة الاقتباس المباشر لا تطابق مقطعًا متصلًا من الآية المذكورة. قد يكون اقتباسًا مختصرًا أو مشكلة استخراج؛ قارن المرجع قبل التعديل.':'This direct quotation does not match a contiguous excerpt of the cited verse. It may be an abbreviation or extraction issue; compare the reference before editing.';f.practiceEligible=true;
      const sourceWords=cited.text.split(/\s+/).filter(w=>normalizeArabic(w)),queryWords=quote.split(' ');
      const candidates=sourceWords.map((_,i)=>sourceWords.slice(i,i+queryWords.length)).filter(w=>w.length===queryWords.length).map(words=>({text:words.join(' '),score:words.filter((w,i)=>normalizeArabic(w)===queryWords[i]).length/queryWords.length})).filter(v=>v.score>=.75);
      if(candidates.length===1)f.correction=candidates[0].text;
    }
  }else if(matches.length===1){f.category='textual_match';f.reference=ref(matches[0]);f.explanation=ar?'وجدنا هذا المقطع في المرجع المعروض، بعد تجاهل التشكيل وعلامات الوقف. لم نتحقق من التفسير أو السياق.':'This excerpt matches the reference shown, ignoring diacritics and pause marks. Interpretation and context have not been verified.';}
  else if(matches.length>1){f.explanation=ar?'المقطع يتكرر في أكثر من آية؛ أضف مرجعًا محددًا قبل توثيق النسبة.':'This excerpt occurs in multiple verses. Supply a specific reference before confirming its attribution.';}
  // Never fabricate a source for a failed retrieval or a proposed correction.
  return f;
 });
}

export function explicitQuotations(units:ReviewUnit[]):ExtractedClaim[]{
 const claims:ExtractedClaim[]=[];
 for(const u of units){
  for(const rawLine of u.text.split('\n')){
   const line=rawLine.trim();if(!line||u.text.indexOf(line)!==u.text.lastIndexOf(line))continue;
   if(u.kind!=='frame'&&!/Qur['’]?an|القرآن|قرآن|قال تعالى|قال الله|سورة/i.test(line))continue;
   if(u.kind==='frame'&&/حديث|رواه|البخاري|مسلم|تفسير|شرح|hadith/i.test(line))continue;
   const citation=line.match(/[0-9٠-٩]{1,3}\s*[:：]\s*[0-9٠-٩]{1,3}/)?.[0];if(!citation)continue;
   const quoted=[...line.matchAll(/[«“"]([^»”"]+)[»”"]/g)].map(m=>m[1]).filter(q=>/[\u0600-\u06ff]/.test(q));
   let quote=quoted.length===1?quoted[0]:'';
   if(!quote&&u.kind==='frame'&&!/معنى|ملخص|بالمعنى|ترجمة|…|\.\.\./.test(line)){
    const candidate=line.replace(citation,'').replace(/^[\s()[\]{}:—–-]+|[\s()[\]{}:—–-]+$/g,'').trim();
    if(!/[a-z]/i.test(candidate)&&normalizeArabic(candidate).split(' ').length>=3)quote=candidate;
   }
   if(quote&&line.includes(quote))claims.push({unitId:u.id,passage:line,quote,citation,kind:'quran_quote'});
  }
 }
 return claims;
}
export function mergeExtractions(units:ReviewUnit[],modelClaims:ExtractedClaim[]):ExtractedClaim[]{
 if(!Array.isArray(modelClaims)||modelClaims.length>30)throw new ApiError('invalid_content_evidence',502);
 const result=modelClaims.map(c=>originalClaim(units,c));
 for(const c of explicitQuotations(units)){
  const unit=units.find(u=>u.id===c.unitId)!;
  const start=unit.text.indexOf(c.passage),end=start+c.passage.length;
  const overlaps=result.filter(m=>{const at=unit.text.indexOf(m.passage);return m.unitId===c.unitId&&at<end&&at+m.passage.length>start;});
  // Explicitly cited, standalone OCR quotations still need text comparison when
  // the language model labels them interpretations. Result remains uncertain.
  if(unit.kind==='frame'&&overlaps.length){for(const overlap of overlaps)result.splice(result.indexOf(overlap),1);result.push(c);}
  else if(!overlaps.length)result.push(c);
 }
 return result;
}

// Resolves an explicit citation only; never treats a semantic neighbour as scripture.
export function identifiedQuranReference(citation:string):Reference|undefined{
 citation=citation.replace(/[«“"]([^»”"]+)[»”"]/g,' ');
 const references=[...digits(citation).matchAll(/(?:^|[^\d])(\d{1,3})\s*[:：]\s*(\d{1,3})(?!\d)/g)].map(m=>m[1]+':'+m[2]);
 if(new Set(references).size>1)return;
 const verse=citedVerse(citation);return verse?ref(verse):undefined;
}
