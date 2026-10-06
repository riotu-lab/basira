// Explicit conversation controls, not factual answers or inferred emotions.
// Keep matches narrow so a substantive answer still goes through grounded generation.
export function conversationControl(text:string):'greeting'|'pause'|'defer'|'skip'|'presence'|'understanding'|'repeat'|'replay'|undefined{
 const t=text.normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/’/g,"'").trim();
 if(t.length>220)return;
 if(/^(?:اعد الرد الاخير|كرر الرد الاخير|كرر اخر رد|repeat (?:your |the )?last (?:reply|response)|replay (?:your |the )?last (?:reply|response))[?؟.!،\s]*$/.test(t))return 'replay';
 if(/^(?:هل (?:تستطيع|يمكنك) ان تسالني مرة اخرى|هل يمكنك اعادة السؤال|can you ask me (?:that )?again)[?؟.!،\s]*$/.test(t))return 'repeat';
 if(/^(?:هل (?:تسمعني|انت معي)|تسمعني|are you (?:there|still there)|can you hear me)[?؟.!،\s]*$/.test(t))return 'presence';
 if(/^(?:هل فهمتني|فهمتني|do you understand(?: me)?|did you understand(?: me)?)[?؟.!،\s]*$/.test(t))return 'understanding';
 if(/^(?:اعد (?:السؤال|سؤالك)|كرر (?:السؤال|سؤالك)|repeat (?:the|your) question)(?: please| من فضلك)?[?؟.!،\s]*$/.test(t))return 'repeat';
 if(/^(?:هل لديك سؤال اخر|هل عندك سؤال اخر|do you have another question|can we (?:move on|try another question))[?؟.!،\s]*$/.test(t))return 'skip';
 // A trailing conjunction overrides an earlier admission of uncertainty.
 if(/(?:^|\s)(?:ولكن|لكن|لان|ان|و|but|because|and|so)[.،,…—–!؟?\s]*$/.test(t))return 'pause';

 if(/^(?:(?:نعم|حسنا)[،.\s]*)?(?:سؤال اخر|لننتقل (?:الى|الي) سؤال اخر|تجاوز هذا السؤال)(?: من فضلك)?[.!،\s]*$/.test(t)||/^(?:(?:yes|okay)[,. ]*)?(?:another question|skip (?:this|the) question|let's move on)(?: please)?[!. ]*$/.test(t))return 'skip';
 if(/^(?:hello|hi|hey)(?: my (?:friend|dear friend))?[!. ,]*$/.test(t)||/^(?:اهلا|اهلا بك|مرحبا|السلام عليكم)(?:\s+(?:صديقي|يا صديقي|صديقي العزيز))?[.!،\s]*$/.test(t))return 'greeting';
 if(/(?:لحظة.*اكمل|دعني اكمل|انتظر.*اكمل|اعطني (?:لحظة|وقتا)|let me finish|give me (?:a moment|a second)|wait.*finish my thought)/.test(t))return 'pause';
 if(/^(?:(?:و?والله|في الحقيقة|بصراحة|الصراحة)[،\s]*)?(?:انا )?لا (?:اعرف|ادري)(?:[،.\s]|$)/.test(t)||/^(?:honestly[, ]*)?i (?:don't|do not) know(?:[., ]|$)/.test(t))return 'defer';
}

// Obvious unfinished syntax is a fast guard; complete short answers still reach semantic checking.
export function unfinishedSpokenFragment(text:string){
 const t=text.normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/[.،,…—–!؟?\s]+$/g,'').trim();
 return /(?:^|\s)(?:كل|بعض|في|على|من|الى|عن|ان|الـ)$/.test(t)||/^(?:انظر|انظروا|اه|ام|uh|um|well|look)$/.test(t)||/\b(?:controls? every|depends on|because of|i think that)$/.test(t);
}
