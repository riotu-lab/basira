// Explicit conversation controls, not factual answers or inferred emotions.
// Keep matches narrow so a substantive answer still goes through grounded generation.
export function conversationControl(text:string):'greeting'|'pause'|'defer'|'skip'|undefined{
 const t=text.normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/’/g,"'").trim();
 if(t.length>220)return;
 if(/^(?:(?:نعم|حسنا)[،.\s]*)?(?:سؤال اخر|لننتقل (?:الى|الي) سؤال اخر|تجاوز هذا السؤال)(?: من فضلك)?[.!،\s]*$/.test(t)||/^(?:(?:yes|okay)[,. ]*)?(?:another question|skip (?:this|the) question|let's move on)(?: please)?[!. ]*$/.test(t))return 'skip';
 if(/^(?:hello|hi|hey)(?: my (?:friend|dear friend))?[!. ,]*$/.test(t)||/^(?:اهلا|اهلا بك|مرحبا|السلام عليكم)(?:\s+(?:صديقي|يا صديقي|صديقي العزيز))?[.!،\s]*$/.test(t))return 'greeting';
 if(/(?:لحظة.*اكمل|دعني اكمل|انتظر.*اكمل|اعطني (?:لحظة|وقتا)|let me finish|give me (?:a moment|a second)|wait.*finish my thought)/.test(t))return 'pause';
 if(/^(?:(?:و?والله|في الحقيقة|بصراحة|الصراحة)[،\s]*)?(?:انا )?لا (?:اعرف|ادري)(?:[،.\s]|$)/.test(t)||/^(?:honestly[, ]*)?i (?:don't|do not) know(?:[., ]|$)/.test(t))return 'defer';
}
