// @vitest-environment node
import {describe,it,expect} from 'vitest';
import {questionBank,bookQuestion,validateReferenceAssessment} from '../server/referencePractice';
import {prepareArguments,validateArgumentJudgments} from '../server/argumentReview';
import {validateBookPages,validateBookDrafts} from '../server/bookDrafts';
import type {ContentFinding,ReviewUnit} from '../src/contentReviewTypes';
const question=questionBank()[0];
const answer='Belief in one God and worship.';
function assessment(){return {spokenFeedback:'You explained belief. Add the remaining points.',points:question.points.map((p,i)=>({id:p.id,status:i?'missing':'covered',answerQuote:i?'':'Belief in one God',explanation:'Compared with the author’s reference.'}))};}
describe('Reference practice evidence guards (no provider calls)',()=>{
 it('loads only available sourced questions; does not fabricate an unavailable context',()=>{expect(questionBank().length).toBeGreaterThan(0);expect(()=>bookQuestion('invented')).toThrow();});
 it('derives partial from omissions rather than accepting an invented verdict',()=>{expect(validateReferenceAssessment({...assessment(),verdict:'consistent'},question,answer).verdict).toBe('partial');});
 it('rejects invented learner quotes and duplicate criteria',()=>{const a=assessment();a.points[0].answerQuote='invented';expect(()=>validateReferenceAssessment(a,question,answer)).toThrow();a.points[0]=a.points[1];expect(()=>validateReferenceAssessment(a,question,answer)).toThrow();});
 it('does not accept a claimed omission attached to words the learner did say',()=>{const a=assessment();a.points[1].answerQuote='Belief';expect(()=>validateReferenceAssessment(a,question,answer)).toThrow();});
});
const unit:ReviewUnit={id:'u1',kind:'audio',text:'quote because reasoning therefore conclusion',originalText:'original',confirmed:false,start:0,end:8};
const raw=[{unitId:'u1',passage:unit.text,evidenceKind:'revelation',evidence:'quote',reasoning:'reasoning',conclusion:'conclusion'}];
const finding={unitId:'u1',category:'textual_match',quote:'quote',reference:{id:'quran-112-1',title:'Quran 112:1',url:'https://tanzil.net/#112:1',excerpt:'قل هو الله أحد',provider:'Tanzil'}} as ContentFinding;
function judgments(refs:string[]=[]){const part={status:'supported',explanation:'Matches the reference.',referenceIds:refs};return {items:[{id:'argument-1',evidence:part,reasoning:part,conclusion:part}]};}
describe('Argument review grounded passages and limited retrieval',()=>{
 it('rejects invented source passages and inferred parts',()=>{expect(()=>prepareArguments([{...raw[0],passage:'invented'}],[unit],[],'en')).toThrow();expect(()=>prepareArguments([{...raw[0],reasoning:'inference absent'}],[unit],[],'en')).toThrow();});
 it('cannot turn missing retrieval into support or contradiction',()=>{const result=validateArgumentJudgments(judgments(),prepareArguments(raw,[unit],[],'en'),'en');expect(result.items[0].evidence.status).toBe('insufficient_evidence');expect(result.items[0].uncertain).toBe(true);});
 it('allows wording checks but cannot approve reasoning from Quran wording alone',()=>{const result=validateArgumentJudgments(judgments(['quran-112-1']),prepareArguments(raw,[unit],[finding],'ar'),'ar');expect(result.items[0].evidence.status).toBe('supported');expect(result.items[0].reasoning.status).toBe('specialist_review');expect(result.items[0].conclusion.status).toBe('specialist_review');});
 it('rejects fabricated citations even when the extraction passage exists',()=>{expect(()=>validateArgumentJudgments(judgments(['invented']),prepareArguments(raw,[unit],[finding],'en'),'en')).toThrow();});
 it('does not promote a candidate citation into verified evidence',()=>{const items=prepareArguments(raw,[unit],[{...finding,category:'insufficient_evidence'}],'en');expect(items[0].references).toEqual([]);});
 it('preserves absent parts instead of generating implicit conclusions',()=>{const result=validateArgumentJudgments(judgments(['quran-112-1']),prepareArguments([{...raw[0],conclusion:''}],[unit],[finding],'en'),'en');expect(result.items[0].conclusion.passage).toBe('');expect(result.items[0].conclusion.status).toBe('insufficient_evidence');});
});
describe('Local book draft importer',()=>{
 const book={tradition:'hinduism',title:'User supplied source',author:'Author',url:'https://example.org/book',permission:'Permission recorded by the team',pages:[{label:'PDF 3–4',text:'An exact source passage'}]};
 it('requires provenance and exact supporting text and leaves every result a draft',()=>{const b=validateBookPages(book);const output=validateBookDrafts({items:[{question:'Question?',answer:'Answer',evidenceQuote:'exact source'}]},b,b.pages[0]);expect(output[0].status).toBe('draft');expect(output[0].source.pages).toBe('PDF 3–4');expect(()=>validateBookPages({...book,permission:''})).toThrow();expect(()=>validateBookDrafts({items:[{question:'Q',answer:'A',evidenceQuote:'invented'}]},b,b.pages[0])).toThrow();});
 it('accepts no valid question without manufacturing one',()=>{const b=validateBookPages(book);expect(validateBookDrafts({items:[]},b,b.pages[0])).toEqual([]);});
});
