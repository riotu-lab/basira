import type { Lang, Turn } from './content';

export const CRITERIA = ['understanding', 'respect'] as const;
export type Criterion = (typeof CRITERIA)[number];
export type Finding = {
  id: string;
  criterion: Criterion;
  observation: string;
  suggestion: string;
  evidence: { turnId: string; quote: string };
  questionTurnId: string;
  sourceId: 'quran-16-125';
};
export type Feedback = { findings: Finding[]; summary: string; status?: 'insufficient_delivery'|'wording_only'; wording?: {turnId:string;quote:string;suggestion:string} };
export type Attempt = {
  id: string;
  language: Lang;
  turns: Turn[];
  mode: 'demo' | 'ai';
  feedback?: Feedback;
};
export type Comparison = {
  criterion: Criterion;
  originalQuote: string;
  retryQuote: string;
  originalObservation: string;
  retryObservation: string;
  conclusion: 'clearer' | 'similar' | 'less_clear' | 'insufficient_evidence';
  explanation: string;
};
export type Practice = { original: Attempt; finding: Finding; question: Turn };
export const SOURCES = [{
  id: 'quran-16-125' as const,
  url: 'https://quran.com/16/125',
  original: 'وَجَادِلْهُم بِالَّتِي هِيَ أَحْسَنُ',
  title: { ar: 'سورة النحل · الآية ١٢٥', en: 'Surah An-Nahl · 16:125' },
  scope: 'A principle of considerate dialogue. It does not directly prescribe an open-question technique, prove a score, or establish any claim about this user’s beliefs.',
}];
export const criteria = {
  understanding: { ar: 'فهم قصد السؤال', en: 'Understanding the question' },
  respect: { ar: 'احترام الطرف الآخر', en: 'Respectful wording' },
};
export const outcomes = {
  clearer: { ar: 'أوضح في هذه المحاولة', en: 'Clearer in this attempt' },
  similar: { ar: 'لا فرق واضح', en: 'No clear difference' },
  less_clear: { ar: 'أقل وضوحًا في هذه المحاولة', en: 'Less clear in this attempt' },
  insufficient_evidence: { ar: 'الدليل غير كافٍ للمقارنة', en: 'Not enough evidence to compare' },
};
