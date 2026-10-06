// @vitest-environment node
import {expect,it,vi} from 'vitest';
vi.mock('node:crypto',async importOriginal=>({...await importOriginal<typeof import('node:crypto')>(),randomInt:vi.fn(()=>0)}));
import {randomInt} from 'node:crypto';
import {trainingOpening} from '../server/trainingOpening';
it('varies greetings in both languages without changing the source question',()=>{
 for(const language of ['ar','en'] as const)for(const tradition of ['christianity','judaism','hinduism','atheism'] as const){
  const results=new Set<string>();for(let n=0;n<3;n++){vi.mocked(randomInt).mockReturnValue(n as never);const value=trainingOpening(language,tradition,'CANONICAL QUESTION');expect(value.endsWith(' CANONICAL QUESTION')).toBe(true);results.add(value);}expect(results.size).toBe(3);
 }
});
it('does not assign a religious persona to content-review practice',()=>{
 vi.mocked(randomInt).mockReturnValue(0 as never);expect(trainingOpening('ar','judaism','سؤال',true)).toBe('أهلًا بك، لنتحدث قليلًا عن هذه النقطة. سؤال');
});
