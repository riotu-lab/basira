import {createHmac,timingSafeEqual,createHash} from 'node:crypto';
import {ApiError} from './validation.js';
import {assessmentParts,type AssessedItem} from '../src/contentAssessment.js';
import type {BookQuestion} from '../src/referencePracticeTypes.js';
import type {Lang} from '../src/content.js';
function key(env:NodeJS.ProcessEnv){const k=env.CONTENT_PRACTICE_SECRET||env.OPENAI_API_KEY;if(!k)throw new ApiError('content_practice_unavailable',503);return k;}
const mac=(value:string,env:NodeJS.ProcessEnv)=>createHmac('sha256',key(env)).update('basira-content-practice-v1:'+value).digest('base64url');
export function attachContentPractice(assessment:AssessedItem,language:Lang,env:NodeJS.ProcessEnv,now=Date.now()){
 if(assessment.uncertain||!assessment.parts)return assessment;
 const part=assessmentParts.map(k=>assessment.parts[k]).find(p=>p.status==='inconsistent_with_excerpt'&&p.citations.length&&p.citations.every(c=>c.provenance==='identified'&&c.source==='quran'&&c.reference));
 if(!part)return assessment;
 const citations=part.citations;const source=citations[0].reference!;
 const excerpt=citations.map(c=>c.quote).join('\n');
 const id='content-'+createHash('sha256').update(assessment.item.passage+excerpt).digest('hex').slice(0,24);
 const question:BookQuestion={id,context:'content_review',tradition:'atheism',status:'source_checked',referenceVersion:id,
 question:{ar:`كيف تدعو الكاتب باحترام إلى مراجعة هذا المقطع مع ${source.title}، مع توضيح حدود الملاحظة؟ «${assessment.item.passage}»`,en:`How would you respectfully invite the author to check this passage against ${source.title}, explaining the limits of the finding? “${assessment.item.passage}”`},
 answer:{ar:`أقترح أن نراجع الاقتباس مع ${source.title}. النص المرجعي: «${excerpt}». نقارن ألفاظ المقطع بهذا النص ونصحح الاختلاف في الاقتباس؛ هذه الملاحظة لا تحكم على تفسير الآية أو على الكاتب.`,en:`I suggest checking the quotation against ${source.title}. The original Arabic reference reads: “${excerpt}”. Compare the passage with that wording and correct the quotation difference. This finding does not establish an interpretation or a judgment about the author.`},
 points:[{id:'wording',text:{ar:'يميز ألفاظ الاقتباس عن النص المرجعي دون اختراع نص أو ترجمة.',en:'Distinguishes the quotation from the supplied original wording without inventing text or translation.'}},{id:'attribution',text:{ar:'يحدد المرجع ويدعو إلى مراجعته باحترام.',en:'Identifies the reference and invites respectful checking.'}},{id:'scope',text:{ar:'يحصر الملاحظة في الاقتباس دون فتوى أو حكم على الكاتب.',en:'Limits the finding to quotation comparison, without a ruling or judgment about the author.'}}],
 source:{title:source.title,author:'Tanzil Project (text provider)',url:source.url,pages:source.title,excerpt},evidence:citations.map(c=>({locator:c.locator,quote:c.quote})),evidenceMethod:'Identified Tanzil 1.1 source text; practice of editorial quotation checking only.'};
 const payload=Buffer.from(JSON.stringify({version:1,expires:now+7*86400000,language,question,origin:{passage:assessment.item.passage,explanation:part.explanation,citations}})).toString('base64url');
 if(payload.length>59000)return assessment;
 return {...assessment,practice:{token:payload+'.'+mac(payload,env),question:question.question[language]}};
}
export function openContentPractice(token:unknown,env:NodeJS.ProcessEnv,now=Date.now()){
 if(typeof token!=='string'||token.length>60000)throw new ApiError('invalid_content_practice',400);
 const [payload,signature,...extra]=token.split('.');if(!payload||!signature||extra.length)throw new ApiError('invalid_content_practice',400);
 const expected=Buffer.from(mac(payload,env)),got=Buffer.from(signature);if(got.length!==expected.length||!timingSafeEqual(got,expected))throw new ApiError('invalid_content_practice',400);
 let v:any;try{v=JSON.parse(Buffer.from(payload,'base64url').toString());}catch{throw new ApiError('invalid_content_practice',400);}
 if(v.version!==1||!Number.isFinite(v.expires)||v.expires<now)throw new ApiError('content_practice_expired',409);
 return v as {language:Lang;question:BookQuestion;origin:{passage:string;explanation:string;citations:import('../src/contentAssessment.js').JudgmentCitation[]}};
}
