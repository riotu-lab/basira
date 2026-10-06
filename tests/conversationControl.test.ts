import {it,expect} from 'vitest';
import {conversationControl,unfinishedSpokenFragment} from '../server/conversationControl';
it.each([['أهلًا صديقي.','greeting'],['Hello my friend.','greeting'],['لأن... نحن عندنا... لحظة أكمل فكرتي.','pause'],['والله لا أعرف، الصراحة ولكن سوف أبحث في الموضوع إن كان هذا جيدًا معك.','defer'],['I don’t know honestly. I would like to research that.','defer']])('recognizes explicit control: %s',(text,result)=>expect(conversationControl(text)).toBe(result));
it.each(['أهلًا، أعتقد أن الفكرة هي التمييز بين المرسل والمرسل إليه.','I know that I do not know everything, but here is my answer.','لا أوافق على هذا الاستنتاج.'])('leaves substantive content to grounded generation: %s',text=>expect(conversationControl(text)).toBeUndefined());
it.each(['نعم، سؤال آخر من فضلك.','Yes, another question please.'])('honours an explicit skip: %s',text=>expect(conversationControl(text)).toBe('skip'));

it.each(['في الحقيقة لا أعرف، ولكن.','سوف أقول إن.','I do not know, but.'])('waits for a trailing connective: %s',text=>expect(conversationControl(text)).toBe('pause'));
it.each([['هل تسمعني؟','presence'],['هل فهمتني؟','understanding'],['هل لديك سؤال آخر؟','skip'],['Can you hear me?','presence'],['Do you have another question?','skip'],['أعد السؤال','repeat']])('routes recovery controls: %s',(text,result)=>expect(conversationControl(text)).toBe(result));

it.each(['إن الله عز وجل يتحكم في كل.','انظروا.','إن.','I think that.'])('holds unfinished syntax: %s',text=>expect(unfinishedSpokenFragment(text)).toBe(true));
it.each(['إن الله عز وجل يتحكم في كل شيء.','هذا لا يتعارض مع وجود الإله.','I gave it my all.'])('does not hold complete syntax: %s',text=>expect(unfinishedSpokenFragment(text)).toBe(false));
it('repeats the actual question on the reported repeat request',()=>expect(conversationControl('هل تستطيع أن تسألني مرة أخرى؟')).toBe('repeat'));
