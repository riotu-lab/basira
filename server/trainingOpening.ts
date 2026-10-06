import {randomInt} from 'node:crypto';
import type {Lang} from '../src/content.js';
import type {Tradition} from '../src/referencePracticeTypes.js';

// Persona background belongs to the selected role, never inferred from the learner.
const backgrounds:Record<Tradition,Record<Lang,string>>={
 christianity:{ar:'أنا مسيحي',en:"I’m Christian"},
 judaism:{ar:'أنا يهودي',en:"I’m Jewish"},
 hinduism:{ar:'أنا هندوسي',en:"I’m Hindu"},
 atheism:{ar:'أنا لا أؤمن بوجود إله',en:"I don’t believe in a god"},
};
export function trainingOpening(language:Lang,tradition:Tradition,question:string,contentReview=false):string{
 const background=backgrounds[tradition][language];
 const choices=contentReview
  ?language==='ar'?['أهلًا بك، لنتحدث قليلًا عن هذه النقطة.','مرحبًا، يسعدني أن نناقش هذه الفكرة.','أهلًا، لدي سؤال حول هذه النقطة.']:['Hello, let’s talk about this point.','Hi, I’d like to discuss this idea with you.','Hello, I have a question about this point.']
  :language==='ar'?[`أهلًا، ${background}، ولدي سؤال أود أن أسمع رأيك فيه.`,`مرحبًا بك، ${background}، وأحب أن أفهم وجهة نظرك في سؤال يشغلني.`,`أهلًا، يسعدني أن نتحدث. ${background}، ولدي استفسار أود أن أناقشه معك.`]:[`Hi, ${background}, and I have a question I’d like your thoughts on.`,`Hello, ${background}. There’s something I’d like to understand from your perspective.`,`Hi, it’s good to talk with you. ${background}, and I’d like to ask you something.`];
 return `${choices[randomInt(choices.length)]} ${question}`;
}
