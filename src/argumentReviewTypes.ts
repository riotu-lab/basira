import type {Reference} from './contentReviewTypes';
export type ArgumentStatus='supported'|'partially_supported'|'contradicted'|'insufficient_evidence'|'specialist_review';
export type ArgumentPart={passage:string;status:ArgumentStatus;explanation:string;referenceIds:string[]};
export type ArgumentReview={id:string;unitId:string;passage:string;evidenceKind:'revelation'|'poetry'|'scholarly'|'historical'|'other';evidence:ArgumentPart;reasoning:ArgumentPart;conclusion:ArgumentPart;references:Reference[];uncertain:boolean;decision:'pending'|'accepted'|'rejected'|'edited';reviewerNote:string};
export type RetrievalStatus={provider:'islamic_content'|'turath';status:'available'|'limited'|'no_evidence'|'failed';error?:string};
export type ArgumentReport={items:ArgumentReview[];summary:string;retrieval:'local_quran_only'|'local_and_mcp';retrievalStatuses?:RetrievalStatus[];incomplete:boolean};
export const argumentLabels={ar:{title:'الدليل والاستدلال والنتيجة',evidence:'الدليل',reasoning:'طريقة الاستدلال',conclusion:'النتيجة',supported:'يدعمه المرجع ضمن النطاق',partially_supported:'دعم جزئي',contradicted:'يخالف المرجع',insufficient_evidence:'أدلة غير كافية',specialist_review:'يحتاج مراجعة مختص',revelation:'وحي: قرآن أو حديث',poetry:'شعر',scholarly:'نقل علمي أو تراثي',historical:'تاريخ',other:'أخرى'},en:{title:'Evidence, reasoning and conclusion',evidence:'Evidence',reasoning:'Reasoning',conclusion:'Conclusion',supported:'Supported within source scope',partially_supported:'Partially supported',contradicted:'Conflicts with reference',insufficient_evidence:'Insufficient evidence',specialist_review:'Specialist review needed',revelation:'Revelation: Quran or hadith',poetry:'Poetry',scholarly:'Scholarly/traditional transmission',historical:'Historical',other:'Other'}};

export function retrievalStatusText(status:RetrievalStatus,lang:'ar'|'en'){
 const provider=status.provider==='turath'?(lang==='ar'?'تراث':'Turath AI'):(lang==='ar'?'المحتوى الإسلامي':'Islamic Content');
 const states={ar:{available:'استُرجعت نصوص مرجعية',limited:'استُرجعت نصوص؛ البحث محدود',no_evidence:'لم يُسترجع دليل كافٍ؛ لا يعني أن الادعاء خطأ',failed:'تعذّر استرجاع المراجع؛ لم يُحكم على الادعاء بسبب ذلك'},en:{available:'Source passages retrieved',limited:'Sources retrieved; search was limited',no_evidence:'No sufficient evidence retrieved; this does not establish falsehood',failed:'Reference retrieval unavailable; this was not used as a verdict'}};
 return `${provider}: ${states[lang][status.status]}`;
}
