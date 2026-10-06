// Retain original datasets and saved sessions for audit; exclude disputed records from new training.
export const WITHHELD_TRAINING_QUESTIONS = new Set(['5df09cbb8ae4433656d7']);
export function isSocialAcknowledgment(text:string){
 const t=text.normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/[\p{P}\p{S}]/gu,' ').replace(/\s+/g,' ').trim();
 if(!t)return true;
 return /^(?:(?:شكرا(?: لك| جزيلا)?|صدقت|نعم|حسنا|تمام|اجل|مرحبا|اهلا(?: بك)?|السلام عليكم|thanks|thank you|yes|okay|ok|i see|hello(?: my friend)?|hi)(?:\s+|$))+$/.test(t);
}
