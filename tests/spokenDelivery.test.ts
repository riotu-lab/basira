// @vitest-environment node
import {it,expect} from 'vitest';
import {measureDelivery} from '../src/spokenDelivery';
const rate=16000;
function signal(){const x=new Float32Array(rate*10);for(let i=rate;i<rate*9;i++)if(i<rate*4||i>=rate*5)x[i]=.15*Math.sin(i*.2);return x;}
it('measures duration and internal low-volume gap while excluding leading/trailing silence',()=>{
 const m=measureDelivery(signal(),rate,'One two three four five six seven eight nine ten.','clip');
 expect(m.duration).toBe(10);expect(m.windowSeconds).toBeCloseTo(8);expect(m.gaps).toEqual([{start:4,end:5}]);expect(m.wordsPerMinute).toBe(75);
});
it('does not assign pace to silence or very short clips',()=>{
 const m=measureDelivery(new Float32Array(rate*10),rate,'Hallucinated words should not turn silence into measured speech.','silent');expect(m.status).toBe('insufficient_signal');expect(m.wordsPerMinute).toBeNull();expect(m.gaps).toEqual([]);
 expect(measureDelivery(signal().slice(0,rate*2),rate,'one two three four five','short').wordsPerMinute).toBeNull();
});
it('counts only transcript tokens in a narrow list, not ambiguous meaningful words',()=>{
 const m=measureDelivery(signal(),rate,'Um, I like this. Uh, well, يعني هذا واضح. أممم','clip');expect(m.fillers).toEqual([{token:'um',count:1},{token:'uh',count:1},{token:'أممم',count:1}]);expect(m.wordCount).toBeGreaterThan(5);
});
it('handles Arabic words and does not manufacture a universal good/bad pace score',()=>{
 const m=measureDelivery(signal(),rate,'هذه إجابة قصيرة وواضحة عن الفكرة التي يشرحها المؤلف.','clip');expect(m.wordCount).toBe(9);expect(m).not.toHaveProperty('score');expect(m).not.toHaveProperty('confidence');
});
it('rejects unusable sample rates and excessive recordings',()=>{
 expect(()=>measureDelivery(new Float32Array(100),0,'','x')).toThrow();expect(()=>measureDelivery(new Float32Array(rate*61),rate,'','x')).toThrow();
});
