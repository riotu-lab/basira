import {useState} from 'react';
import type {Lang} from './content';
import {itemClasses,type ContentStructure} from './contentStructure';
import {reviewCopy} from './reviewCopy';

export function ContentStructurePanel({value,lang}:{value:ContentStructure;lang:Lang}){
 const t=reviewCopy[lang],ar=lang==='ar';
 const [selected,setSelected]=useState('');
 const item=value.items.find(i=>i.id===selected)||value.items[0];
 return <section className="content-structure" aria-label={t.structure}>
  <div className="structure-heading"><span className="eyebrow">{ar?'ما ورد في محتواك':'INSIDE YOUR CONTENT'}</span><h2>{ar?'الاقتباسات والادعاءات':'Quotations & claims'} <small>{value.items.length.toLocaleString(lang)}</small></h2></div>
  <p className="structure-boundary">{ar?'استخراج من المحتوى · لم تُتحقق المصادر بعد':'Extracted from your content · Sources not yet verified'}</p>
  {value.morePossible&&<p className="scope-note" role="status">{t.structurePartial}</p>}
  {!item&&<p>{t.structureEmpty}</p>}
  {value.items.length>1&&<div className="structure-selector" aria-label={ar?'اختر مقطعًا':'Choose a passage'}>{value.items.map((i,index)=><button type="button" key={i.id} aria-pressed={item.id===i.id} onClick={()=>setSelected(i.id)}><span>{(index+1).toLocaleString(lang)} · {itemClasses[i.class][lang]}</span><span dir="auto">{i.passage}</span></button>)}</div>}
  {item&&<article className="structure-detail" key={item.id}>
   <span className="structure-class">{itemClasses[item.class][lang]}</span>
   <div className="structure-passage"><span className="eyebrow">{t.passage}</span><blockquote dir="auto">{item.passage}</blockquote></div>
   <dl>{(['evidence','reasoning','conclusion'] as const).map(key=><div key={key}><dt>{t[key]}{key==='evidence'&&<small>{ar?'النص أو المصدر المستشهد به':'The cited passage or source'}</small>}</dt><dd dir="auto" className={!item[key]?'not-stated':undefined}>{item[key]||t.notStated}</dd></div>)}</dl>
  </article>}
 </section>;
}
