export const AUDIO_CRITERIA={pronunciation:{ar:'وضوح النطق',en:'Pronunciation clarity'},fluency:{ar:'الطلاقة والوقفات',en:'Fluency and pauses'},intonation:{ar:'التنغيم والتأكيد',en:'Intonation and emphasis'}} as const;
export type AudioCriterion=keyof typeof AUDIO_CRITERIA;
export type AudioAssessment={version:1;model:string;language:'ar'|'en';duration:number;findings:{criterion:AudioCriterion;status:'effective'|'practice'|'insufficient_evidence';observation:string;suggestion:string;segments:{id:string;start:number;end:number}[]}[]};
