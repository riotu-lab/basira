import type {Lang} from './content';
export const QUALITY_CRITERIA={
 relevance:{group:'content',ar:'صلة الإجابة بالسؤال',en:'Relevance to the question'},
 clarity:{group:'communication',ar:'وضوح الفكرة',en:'Clarity'},
 organization:{group:'communication',ar:'ترتيب الأفكار',en:'Organization'},
 concision:{group:'communication',ar:'الإيجاز دون إخلال',en:'Concision'},
 respect:{group:'communication',ar:'احترام المحاور',en:'Respectful engagement'},
 responsiveness:{group:'communication',ar:'التفاعل مع السؤال',en:'Responsiveness'},
 grammar:{group:'language',ar:'سلامة التركيب اللغوي',en:'Grammar'},
 vocabulary:{group:'language',ar:'دقة اختيار الكلمات',en:'Word choice'},
} as const;
export type QualityCriterion=keyof typeof QUALITY_CRITERIA;
export type QualityStatus='effective'|'needs_attention'|'insufficient_evidence'|'possible_transcription_issue';
export type QualityFinding={id:QualityCriterion;status:QualityStatus;explanation:string;suggestion:string;evidence:{passageId:string;turnId?:string;quote:string;start:number;end:number}[]};
export type TrainingQuality={version:1;findings:QualityFinding[];spokenDelivery:'not_assessed'};
export const qualityStatuses:Record<Lang,Record<QualityStatus,string>>={ar:{effective:'نقطة جيدة',needs_attention:'تحتاج إلى عناية',insufficient_evidence:'لا تكفي الأدلة للتقييم',possible_transcription_issue:'قد تكون مسألة تفريغ صوتي'},en:{effective:'Effective',needs_attention:'Needs attention',insufficient_evidence:'Insufficient evidence',possible_transcription_issue:'Possible transcription issue'}};
