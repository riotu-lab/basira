import {it,expect} from 'vitest';
import {conversationControl} from '../server/conversationControl';
it.each([['أهلًا صديقي.','greeting'],['Hello my friend.','greeting'],['لأن... نحن عندنا... لحظة أكمل فكرتي.','pause'],['والله لا أعرف، الصراحة ولكن سوف أبحث في الموضوع إن كان هذا جيدًا معك.','defer'],['I don’t know honestly. I would like to research that.','defer']])('recognizes explicit control: %s',(text,result)=>expect(conversationControl(text)).toBe(result));
it.each(['أهلًا، أعتقد أن الفكرة هي التمييز بين المرسل والمرسل إليه.','I know that I do not know everything, but here is my answer.','لا أوافق على هذا الاستنتاج.'])('leaves substantive content to grounded generation: %s',text=>expect(conversationControl(text)).toBeUndefined());
it.each(['نعم، سؤال آخر من فضلك.','Yes, another question please.'])('honours an explicit skip: %s',text=>expect(conversationControl(text)).toBe('skip'));
